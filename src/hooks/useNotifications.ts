import { useState, useEffect, useRef } from 'react'
import { privateGet } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { Notification } from '@/types/notification'

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws'
const MAX_ATTEMPTS = 10
const MAX_BACKOFF_MS = 30_000

export interface UseNotificationsResult {
  unreadCount: number
  isConnected: boolean
  latestNotification: Notification | null
}

interface NotificationWsMessage {
  type: string
  count?: number
  unread_count?: number
  notification?: Notification | LegacyNotification
}

interface LegacyNotification {
  ID?: number
  EventType?: string
  Title?: string
  Content?: string
  Link?: string | null
  IsRead?: boolean
  ReadAt?: string | null
  CreatedAt?: string
}

interface UnreadCountResponse {
  unread_count: number
}

function normalizeNotification(
  value: Notification | LegacyNotification | undefined,
): Notification | null {
  if (!value) return null
  if ('id' in value && typeof value.id === 'number') {
    return value as Notification
  }
  const legacy = value as LegacyNotification
  if (typeof legacy.ID !== 'number' || typeof legacy.EventType !== 'string') {
    return null
  }
  return {
    id: legacy.ID,
    event_type: legacy.EventType,
    title: legacy.Title ?? '',
    content: legacy.Content ?? '',
    link: legacy.Link,
    is_read: legacy.IsRead ?? false,
    read_at: legacy.ReadAt,
    created_at: legacy.CreatedAt ?? new Date().toISOString(),
  }
}

export function useNotifications(): UseNotificationsResult {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!accessToken) {
      setUnreadCount(0)
      setLatestNotification(null)
      return
    }

    let cancelled = false

    void privateGet<UnreadCountResponse>('/notifications/unread-count')
      .then((response) => {
        if (!cancelled) {
          setUnreadCount(response.data?.unread_count ?? 0)
        }
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0)
      })

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
            if (parsed.type === 'notification.new' || parsed.type === 'notification') {
              const notification = normalizeNotification(parsed.notification)
              if (notification) setLatestNotification(notification)
              if (typeof parsed.unread_count === 'number') {
                setUnreadCount(parsed.unread_count)
              } else {
                setUnreadCount((prev) => prev + 1)
              }
            } else if (
              parsed.type === 'notification.unread_count' ||
              parsed.type === 'unread_count'
            ) {
              const count =
                typeof parsed.unread_count === 'number'
                  ? parsed.unread_count
                  : parsed.count
              if (typeof count === 'number') setUnreadCount(count)
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

  return { unreadCount, isConnected, latestNotification }
}
