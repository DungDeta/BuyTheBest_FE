import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws'
const MAX_ATTEMPTS = 10
const MAX_BACKOFF_MS = 30_000

export interface UseNotificationsResult {
  unreadCount: number
  isConnected: boolean
}

interface NotificationWsMessage {
  type: string
  count?: number
}

export function useNotifications(): UseNotificationsResult {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!accessToken) return

    let cancelled = false

    function connect() {
      if (cancelled) return

      const currentToken = useAuthStore.getState().accessToken
      if (!currentToken) return

      const url = `${WS_BASE}/notifications?token=${currentToken}`
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
          const raw: unknown =
            typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data
          if (
            raw !== null &&
            typeof raw === 'object' &&
            'type' in raw &&
            typeof (raw as Record<string, unknown>).type === 'string'
          ) {
            const parsed = raw as NotificationWsMessage
            if (parsed.type === 'notification') {
              setUnreadCount((prev) => prev + 1)
            } else if (parsed.type === 'unread_count' && typeof parsed.count === 'number') {
              setUnreadCount(parsed.count)
            }
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
  }, [accessToken])

  return { unreadCount, isConnected }
}
