import { useEffect, useRef, useState, useCallback } from 'react'
import { App, Spin } from 'antd'
import dayjs from 'dayjs'
import { publicGet, privatePost } from '@/api/api'
import type { ChatMessage, WsEventType } from '@/types/auction'
import type { ErrorResponse } from '@/types/api'

interface ChatMessagePayload {
  id: number
  auction_id: number
  user_id: number | null
  message_type: 'user' | 'system_bid' | 'system_extension' | 'system_end'
  content: string
  sender_label: string | null
  sent_at: string
}

interface RoomChatProps {
  auctionId: string
  auctionStatus: string
  isLoggedIn: boolean
  subscribe: (eventType: WsEventType, callback: (payload: unknown) => void) => void
  unsubscribe: (eventType: WsEventType, callback: (payload: unknown) => void) => void
}

function isSystem(msg: ChatMessage): boolean {
  return msg.message_type !== 'user'
}

export function RoomChat({ auctionId, auctionStatus, isLoggedIn, subscribe, unsubscribe }: RoomChatProps) {
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
        const res = await publicGet<{ items: ChatMessage[] }>(
          `/auctions/${auctionId}/chat`
        )
        if (!cancelled && res.data?.items) {
          setMessages(res.data.items)
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

    const msg: ChatMessage = {
      id: p.id,
      auction_id: p.auction_id,
      user_id: p.user_id,
      message_type: p.message_type,
      content: p.content,
      sender_label: p.sender_label,
      sent_at: p.sent_at,
    }

    setMessages((prev) => [...prev, msg])
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
    if (!content || sending) return

    setSending(true)
    try {
      await privatePost(`/auctions/${auctionId}/chat`, { content })
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
              const sys = isSystem(msg)
              const time = dayjs(msg.sent_at).format('HH:mm')
              const label = msg.sender_label ?? 'system'
              if (sys) {
                return (
                  <div key={msg.id} className="chat-msg chat-msg--system">
                    <span className="chat-msg__content">{msg.content}</span>
                  </div>
                )
              }
              return (
                <div key={msg.id} className="chat-msg">
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
          const sys = isSystem(msg)
          const time = dayjs(msg.sent_at).format('HH:mm')
          const label = msg.sender_label ?? 'system'

          if (sys) {
            return (
              <div key={msg.id} className="chat-msg chat-msg--system" aria-label={`Tin hệ thống lúc ${time}`}>
                <span className="chat-msg__content">{msg.content}</span>
              </div>
            )
          }

          return (
            <div key={msg.id} className="chat-msg" aria-label={`Tin nhắn từ ${label} lúc ${time}`}>
              <span className="chat-msg__sender">{label}</span>
              <span className="chat-msg__content">{msg.content}</span>
              <span className="chat-msg__time">{time}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-footer">
        {isLoggedIn ? (
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
          <div className="chat-gate">Đăng nhập để chat</div>
        )}
      </div>
    </div>
  )
}
