import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import type { ChatWsEvent, ChatWsEventType } from '@/types/chat'

type EventCallback = (event: ChatWsEvent) => void

export interface UseChatWebSocketResult {
  isConnected: boolean
  sendTypingStart: (conversationId: number) => void
  sendTypingStop: (conversationId: number) => void
  sendReadReceipt: (conversationId: number) => void
  subscribe: (eventType: ChatWsEventType, callback: EventCallback) => void
  unsubscribe: (eventType: ChatWsEventType, callback: EventCallback) => void
}

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws'
const MAX_ATTEMPTS = 10
const MAX_BACKOFF_MS = 30_000

export function useChatWebSocket(conversationId: number | null): UseChatWebSocketResult {
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listenersRef = useRef<Map<ChatWsEventType, Set<EventCallback>>>(new Map())

  const subscribe = useCallback((eventType: ChatWsEventType, callback: EventCallback) => {
    const map = listenersRef.current
    if (!map.has(eventType)) {
      map.set(eventType, new Set())
    }
    map.get(eventType)!.add(callback)
  }, [])

  const unsubscribe = useCallback((eventType: ChatWsEventType, callback: EventCallback) => {
    listenersRef.current.get(eventType)?.delete(callback)
  }, [])

  const dispatch = useCallback((event: ChatWsEvent) => {
    listenersRef.current.get(event.type)?.forEach((cb) => {
      cb(event)
    })
  }, [])

  const sendJson = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }, [])

  const sendTypingStart = useCallback((conversationId: number) => {
    sendJson({ type: 'typing.start', conversation_id: conversationId })
  }, [sendJson])

  const sendTypingStop = useCallback((conversationId: number) => {
    sendJson({ type: 'typing.stop', conversation_id: conversationId })
  }, [sendJson])

  const sendReadReceipt = useCallback((conversationId: number) => {
    sendJson({ type: 'read.receipt', conversation_id: conversationId })
  }, [sendJson])

  useEffect(() => {
    const token = useAuthStore.getState().accessToken
    if (!token || !conversationId) return

    let cancelled = false

    function connect() {
      if (cancelled) return

      const currentToken = useAuthStore.getState().accessToken
      if (!currentToken) return

      const url = `${WS_BASE}/chat?token=${currentToken}&conversation_id=${conversationId}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) {
          ws.close()
          return
        }
        attemptsRef.current = 0
        setIsConnected(true)
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
            dispatch(raw as ChatWsEvent)
          }
        } catch {
        }
      }

      ws.onerror = () => {
      }

      ws.onclose = () => {
        if (cancelled) return
        setIsConnected(false)

        if (attemptsRef.current >= MAX_ATTEMPTS) return

        const backoff = Math.min(1000 * 2 ** attemptsRef.current, MAX_BACKOFF_MS)
        attemptsRef.current += 1

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
      attemptsRef.current = 0
    }
  }, [conversationId, dispatch])

  return { isConnected, sendTypingStart, sendTypingStop, sendReadReceipt, subscribe, unsubscribe }
}
