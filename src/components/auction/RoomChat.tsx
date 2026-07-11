import { useEffect, useRef, useState, useCallback } from 'react'
import { App, Spin } from 'antd'
import dayjs from 'dayjs'
import { publicGet, privatePost } from '@/api/api'
import { formatParticipantLabel } from '@/utils/auctionIdentity'
import type { ChatMessage, WsEventType } from '@/types/auction'
import type { ErrorResponse } from '@/types/api'

interface ChatMessagePayload {
  id: number
  auction_id: number
  user_id: number | null
  message_type?: 'user' | 'system_bid' | 'system_extension' | 'system_end'
  content: string
  sender_label?: string | null
  sent_at?: string
  created_at?: string
}

interface ChatMessageResponse {
  id: number
  auction_id: number
  user_id: number | null
  message_type?: 'user' | 'system_bid' | 'system_extension' | 'system_end'
  content: string
  sender_label?: string | null
  sent_at?: string
  created_at?: string
}

type ChatListResponse = ChatMessageResponse[] | { items?: ChatMessageResponse[] }

interface RoomChatProps {
  auctionId: string
  auctionStatus: string
  isLoggedIn: boolean
  currentUserId: string | null
  roomReady: boolean
  subscribe: (eventType: WsEventType, callback: (payload: unknown) => void) => void
  unsubscribe: (eventType: WsEventType, callback: (payload: unknown) => void) => void
}

function isUserMessage(msg: ChatMessage): boolean {
  return msg.message_type === 'user'
}

function sortMessages(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort((a, b) => {
    const timeA = dayjs(a.sent_at).valueOf()
    const timeB = dayjs(b.sent_at).valueOf()
    if (timeA !== timeB) return timeA - timeB
    return a.id - b.id
  })
}

function appendUniqueMessage(next: ChatMessage) {
  return (prev: ChatMessage[]) => {
    if (prev.some((msg) => msg.id === next.id)) {
      return prev
    }
    return sortMessages([...prev, next])
  }
}

function normalizeChatMessage(raw: ChatMessageResponse | ChatMessagePayload, fallbackSentAt?: string): ChatMessage {
  return {
    id: raw.id,
    auction_id: raw.auction_id,
    user_id: raw.user_id,
    message_type: raw.message_type ?? 'user',
    content: raw.content,
    sender_label: raw.sender_label ?? null,
    sent_at: raw.sent_at ?? raw.created_at ?? fallbackSentAt ?? new Date().toISOString(),
  }
}

function isOwnMessage(msg: ChatMessage, currentUserId: string | null): boolean {
  return currentUserId !== null && msg.user_id !== null && String(msg.user_id) === currentUserId
}

function getSenderLabel(msg: ChatMessage, currentUserId: string | null): string {
  if (isOwnMessage(msg, currentUserId)) return 'Bạn'
  if (msg.sender_label && !/^(system|hệ thống)$/i.test(msg.sender_label.trim())) {
    return formatParticipantLabel(msg.sender_label)
  }
  if (msg.user_id) return `Người dùng #${msg.user_id}`
  return 'Người tham gia'
}

export function RoomChat({
  auctionId,
  auctionStatus,
  isLoggedIn,
  currentUserId,
  roomReady,
  subscribe,
  unsubscribe,
}: RoomChatProps) {
  const { message } = App.useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isChatActive = auctionStatus === 'active'

  useEffect(() => {
    let cancelled = false

    async function fetchMessages() {
      setLoading(true)
      try {
        const res = await publicGet<ChatListResponse>(
          `/auctions/${auctionId}/chat`
        )
        if (!cancelled) {
          const rawItems = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
          setMessages(sortMessages(
            rawItems
              .map((item) => normalizeChatMessage(item, res.timestamp))
              .filter(isUserMessage),
          ))
        }
      } catch {
        // Chat not available yet — not an error for the user
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (isChatActive) {
      fetchMessages()
    } else {
      setLoading(false)
    }
    return () => { cancelled = true }
  }, [auctionId, isChatActive])

  const handleChatMessage = useCallback((payload: unknown) => {
    const p = payload as ChatMessagePayload
    if (!p || typeof p !== 'object') return

    const next = normalizeChatMessage(p)
    if (!isUserMessage(next)) return
    setMessages(appendUniqueMessage(next))
  }, [])

  useEffect(() => {
    subscribe('chat.message', handleChatMessage)
    return () => unsubscribe('chat.message', handleChatMessage)
  }, [subscribe, unsubscribe, handleChatMessage])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [messages.length])

  async function handleSend() {
    const content = inputValue.trim()
    if (!content || sending || !roomReady) return

    setSending(true)
    try {
      const res = await privatePost<ChatMessageResponse>(`/auctions/${auctionId}/chat`, { content })
      if (res.data) {
        const msg = normalizeChatMessage(res.data, res.timestamp)
        if (isUserMessage(msg)) {
          setMessages(appendUniqueMessage({
            ...msg,
            sender_label: msg.sender_label ?? 'Bạn',
          }))
        }
      }
      setInputValue('')
      inputRef.current?.focus()
    } catch (err) {
      const e = err as ErrorResponse
      const errorMsg = e?.error ?? 'Không thể gửi tin nhắn. Vui lòng thử lại.'
      message.error(errorMsg)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="tab-content tab-content--center" aria-label="Đang tải chat">
        <Spin size="small" />
      </div>
    )
  }

  if (!isChatActive) {
    const statusMsg = auctionStatus === 'scheduled'
      ? 'Phòng chat sẽ mở khi phiên đấu giá bắt đầu.'
      : 'Phiên đấu giá đã kết thúc, không thể gửi tin nhắn.'

    return (
      <div className="chat-container" aria-label="Khu vực chat">
        <div className="tab-content auction-chat-messages" role="log" aria-live="polite">
          {messages.length > 0 ? (
            messages.map((msg) => {
              const time = dayjs(msg.sent_at).format('HH:mm')
              const label = getSenderLabel(msg, currentUserId)
              const mine = isOwnMessage(msg, currentUserId)
              return (
                <div key={msg.id} className={`chat-msg${mine ? ' chat-msg--mine' : ' chat-msg--other'}`}>
                  <span className="chat-msg__sender">{label}</span>
                  <span className="chat-msg__content">{msg.content}</span>
                  <span className="chat-msg__time">{time}</span>
                </div>
              )
            })
          ) : (
            <div className="tab-content--empty">Chưa có tin nhắn nào</div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-footer">
          <div className="chat-gate">{statusMsg}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-container" aria-label="Khu vực chat">
      <div className="tab-content auction-chat-messages" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="tab-content--empty">Chưa có tin nhắn nào</div>
        )}
        {messages.map((msg) => {
          const time = dayjs(msg.sent_at).format('HH:mm')
          const label = getSenderLabel(msg, currentUserId)
          const mine = isOwnMessage(msg, currentUserId)

          return (
            <div
              key={msg.id}
              className={`chat-msg${mine ? ' chat-msg--mine' : ' chat-msg--other'}`}
              aria-label={`Tin nhắn từ ${label} lúc ${time}`}
            >
              <span className="chat-msg__sender">{label}</span>
              <span className="chat-msg__content">{msg.content}</span>
              <span className="chat-msg__time">{time}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-footer">
        {isLoggedIn && roomReady ? (
          <>
            <div className="chat-input" role="form" aria-label="Gửi tin nhắn">
              <input
                ref={inputRef}
                type="text"
                className="chat-input__field"
                placeholder="Hỏi người bán..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
                disabled={sending}
                aria-label="Nhập tin nhắn"
              />
              <button
                type="button"
                className="chat-input__send"
                onClick={handleSend}
                disabled={sending || inputValue.trim().length === 0}
                aria-label="Gửi tin nhắn"
              >
                Gửi
              </button>
            </div>
            <div className="chat-rate-note">Tối đa 30 tin/phút</div>
          </>
        ) : (
          <div className="chat-gate">
            {isLoggedIn ? 'Đang kết nối vào phòng đấu giá…' : 'Đăng nhập để chat'}
          </div>
        )}
      </div>
    </div>
  )
}
