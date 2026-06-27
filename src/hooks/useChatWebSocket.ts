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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function numberField(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number') return value
  }
  return undefined
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

function normalizeChatEvent(raw: unknown): ChatWsEvent | null {
  const record = asRecord(raw)
  if (!record || typeof record.type !== 'string') return null

  const type = record.type as ChatWsEventType
  const event: ChatWsEvent = {
    type,
    conversation_id: numberField(record, 'conversation_id', 'ConversationID'),
    user_id: numberField(record, 'user_id', 'UserID'),
  }

  if (type !== 'chat.message' && type !== 'message.new') return event

  const payload = asRecord(record.data) ?? asRecord(record.message)
  if (!payload) return event

  const id = numberField(payload, 'id', 'ID')
  const conversationId = numberField(payload, 'conversation_id', 'ConversationID')
  const senderId = numberField(payload, 'sender_id', 'SenderID')
  const content = stringField(payload, 'content', 'Content')
  const createdAt = stringField(payload, 'created_at', 'CreatedAt')
  if (
    id === undefined ||
    conversationId === undefined ||
    senderId === undefined ||
    content === undefined ||
    createdAt === undefined
  ) {
    return event
  }

  event.conversation_id ??= conversationId
  event.data = {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    content,
    image_url:
      stringField(payload, 'image_url', 'ImageURL') ??
      (payload.image_url === null || payload.ImageURL === null ? null : undefined),
    has_violation:
      typeof payload.has_violation === 'boolean'
        ? payload.has_violation
        : typeof payload.HasViolation === 'boolean'
          ? payload.HasViolation
          : false,
    violation_type:
      stringField(payload, 'violation_type', 'ViolationType') ??
      (payload.violation_type === null || payload.ViolationType === null ? null : undefined),
    created_at: createdAt,
  }
  return event
}

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
          const event = normalizeChatEvent(raw)
          if (event) dispatch(event)
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
