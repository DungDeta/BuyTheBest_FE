import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import type {
  AuctionConnectionState,
  AuctionRoomMembershipState,
  ParticipantPayload,
  RoomJoinedPayload,
  RoomJoinFailedPayload,
  WsEvent,
  WsEventType,
} from '@/types/auction'

type EventCallback = (payload: unknown) => void

export interface UseAuctionWebSocketResult {
  isConnected: boolean
  connectionState: AuctionConnectionState
  membershipState: AuctionRoomMembershipState
  joinError: string | null
  lastEvent: WsEvent | null
  participantCount: number | null
  currentParticipantId: number | null
  currentBidderLabel: string | null
  serverNow: string | null
  subscribe: (eventType: WsEventType, callback: EventCallback) => void
  unsubscribe: (eventType: WsEventType, callback: EventCallback) => void
}

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws'
const MAX_ATTEMPTS = 5
const MAX_BACKOFF_MS = 30_000

export function useAuctionWebSocket(auctionId: string | null): UseAuctionWebSocketResult {
  const accessToken = useAuthStore((state) => (
    state.isAuthenticated() ? state.accessToken : null
  ))
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<AuctionConnectionState>('idle')
  const [membershipState, setMembershipState] = useState<AuctionRoomMembershipState>(
    accessToken ? 'joining' : 'guest',
  )
  const [joinError, setJoinError] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null)
  const [participantCount, setParticipantCount] = useState<number | null>(null)
  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null)
  const [currentBidderLabel, setCurrentBidderLabel] = useState<string | null>(null)
  const [serverNow, setServerNow] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listenersRef = useRef<Map<WsEventType, Set<EventCallback>>>(new Map())
  const auctionIdRef = useRef(auctionId)

  useEffect(() => {
    auctionIdRef.current = auctionId
  }, [auctionId])

  const subscribe = useCallback((eventType: WsEventType, callback: EventCallback) => {
    const map = listenersRef.current
    if (!map.has(eventType)) {
      map.set(eventType, new Set())
    }
    map.get(eventType)!.add(callback)
  }, [])

  const unsubscribe = useCallback((eventType: WsEventType, callback: EventCallback) => {
    listenersRef.current.get(eventType)?.delete(callback)
  }, [])

  const dispatch = useCallback((event: WsEvent) => {
    if (event.type === 'room.joined') {
      const p = event.payload as RoomJoinedPayload
      setParticipantCount(p.participant_count)
      setCurrentParticipantId(
        typeof p.participant_id === 'number' && p.participant_id > 0
          ? p.participant_id
          : null,
      )
      setCurrentBidderLabel(p.bidder_label ?? null)
      setServerNow(p.server_time ?? null)
      setMembershipState('joined')
      setJoinError(null)
      attemptsRef.current = 0
    }

    if (event.type === 'room.join_failed') {
      const p = event.payload as RoomJoinFailedPayload
      setMembershipState('failed')
      setJoinError(p.message ?? 'Không thể tham gia phòng đấu giá')
    }

    if (event.type === 'participant.joined' || event.type === 'participant.left') {
      const p = event.payload as ParticipantPayload
      if (typeof p?.participant_count === 'number') {
        setParticipantCount(p.participant_count)
      }
    }

    setLastEvent(event)

    listenersRef.current.get(event.type)?.forEach((cb) => {
      cb(event.payload)
    })
  }, [])

  useEffect(() => {
    setLastEvent(null)
    setParticipantCount(null)
    setCurrentParticipantId(null)
    setCurrentBidderLabel(null)
    setServerNow(null)
    setJoinError(null)
    setMembershipState(accessToken ? 'joining' : 'guest')

    if (auctionId === null) {
      setConnectionState('idle')
      setIsConnected(false)
      return
    }

    let cancelled = false

    function connect() {
      if (cancelled) return

      const id = auctionIdRef.current
      if (id === null) return

      setConnectionState(attemptsRef.current === 0 ? 'connecting' : 'reconnecting')
      setMembershipState(accessToken ? 'joining' : 'guest')
      const query = accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
      const url = `${WS_BASE}/auctions/${id}${query}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) {
          ws.close()
          return
        }
        if (!accessToken) {
          attemptsRef.current = 0
        }
        setIsConnected(true)
        setConnectionState('connected')
      }

      ws.onmessage = (msg: MessageEvent<unknown>) => {
        if (cancelled) return
        try {
          const raw: unknown = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data
          if (
            raw !== null &&
            typeof raw === 'object' &&
            'type' in raw &&
            typeof (raw as Record<string, unknown>).type === 'string'
          ) {
            const record = raw as Record<string, unknown>
            const event = 'payload' in record
              ? raw as WsEvent
              : {
                  type: record.type as WsEventType,
                  payload: Object.fromEntries(
                    Object.entries(record).filter(([key]) => key !== 'type'),
                  ),
                }
            dispatch(event)
          }
        } catch {
        }
      }

      ws.onerror = () => {
      }

      ws.onclose = () => {
        if (cancelled) return
        setIsConnected(false)

        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setConnectionState('failed')
          if (accessToken) {
            setMembershipState('failed')
            setJoinError((current) => current ?? 'Không thể tham gia phòng đấu giá')
          }
          return
        }

        const backoff = Math.min(1000 * 2 ** attemptsRef.current, MAX_BACKOFF_MS)
        attemptsRef.current += 1
        setConnectionState('reconnecting')

        reconnectTimerRef.current = setTimeout(() => {
          if (!cancelled) connect()
        }, backoff)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current !== null) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
      setIsConnected(false)
      setConnectionState('idle')
      setMembershipState(accessToken ? 'joining' : 'guest')
      attemptsRef.current = 0
    }
  }, [accessToken, auctionId, dispatch])

  return {
    isConnected,
    connectionState,
    membershipState,
    joinError,
    lastEvent,
    participantCount,
    currentParticipantId,
    currentBidderLabel,
    serverNow,
    subscribe,
    unsubscribe,
  }
}
