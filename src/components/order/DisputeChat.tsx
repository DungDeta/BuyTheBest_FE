import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Spin } from 'antd'
import dayjs from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import type { DisputeMessage, DisputeStatus } from '@/types/order'

interface DisputeChatProps {
  disputeId: string
  currentUserId: string
  currentUserRole: Exclude<DisputeChatRole, 'admin'>
  buyerId?: number
  sellerId?: number
  disputeStatus?: DisputeStatus
}

type MessagesResponse = DisputeMessage[] | { data: DisputeMessage[] }

interface SendMessageBody {
  content: string
}

type DisputeChatRole = 'buyer' | 'seller' | 'admin'

function extractMessages(data: MessagesResponse | undefined): DisputeMessage[] {
  if (!data) return []
  return Array.isArray(data) ? data : data.data
}

function roleOf(
  msg: DisputeMessage,
  currentUserId: string,
  buyerId?: number,
  sellerId?: number,
): DisputeChatRole {
  if (msg.is_admin) return 'admin'
  if (buyerId != null && msg.sender_id === buyerId) return 'buyer'
  if (sellerId != null && msg.sender_id === sellerId) return 'seller'
  if (String(msg.sender_id) === currentUserId) return 'buyer'
  return 'seller'
}

function isSelfMessage(
  msg: DisputeMessage,
  currentUserId: string,
  buyerId: number | undefined,
  sellerId: number | undefined,
  currentUserRole: DisputeChatRole,
): boolean {
  if (msg.is_admin) return false
  if (currentUserRole === 'buyer' && buyerId != null) return msg.sender_id === buyerId
  if (currentUserRole === 'seller' && sellerId != null) return msg.sender_id === sellerId
  return String(msg.sender_id) === currentUserId
}

const ROLE_LABELS: Record<DisputeChatRole, string> = {
  buyer: 'Người mua',
  seller: 'Người bán',
  admin: 'Quản trị viên',
}

export function DisputeChat({
  disputeId,
  currentUserId,
  currentUserRole,
  buyerId,
  sellerId,
  disputeStatus,
}: DisputeChatProps) {
  const { message } = App.useApp()
  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await privateGet<MessagesResponse>(`/disputes/${disputeId}/messages`, {
        limit: 50,
        offset: 0,
      })
      setMessages(extractMessages(res.data))
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [disputeId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 1 || trimmed.length > 2000) return
    setSending(true)
    try {
      const body: SendMessageBody = { content: trimmed }
      await privatePost(`/disputes/${disputeId}/messages`, body)
      setText('')
      await fetchMessages()
    } catch {
      message.error('Không thể gửi tin nhắn. Vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }} aria-label="Đang tải tin nhắn">
        <Spin />
      </div>
    )
  }

  return (
    <div>
      <div className="dispute-chat" role="log" aria-label="Tin nhắn khiếu nại" aria-live="polite">
        {messages.length === 0 && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', textAlign: 'center', padding: '16px 0' }}>
            Chưa có tin nhắn nào.
          </p>
        )}
        {messages.map((msg) => {
          const role = roleOf(msg, currentUserId, buyerId, sellerId)
          const isSelf = isSelfMessage(msg, currentUserId, buyerId, sellerId, currentUserRole)
          const msgCls = [
            'dispute-msg',
            isSelf ? 'dispute-msg--self' : '',
            msg.is_admin ? 'dispute-msg--admin' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div key={msg.id} className={msgCls}>
              <div
                className={`dispute-msg__avatar dispute-msg__avatar--${role}`}
                aria-hidden="true"
              >
                {ROLE_LABELS[role][0]}
              </div>
              <div className="dispute-msg__bubble">
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                  <span className="dispute-msg__who">{ROLE_LABELS[role]}</span>
                  <span className={`dispute-msg__role dispute-msg__role--${role}`}>
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="dispute-msg__ts">
                    {dayjs(msg.sent_at).format('DD/MM/YYYY HH:mm')}
                  </span>
                </div>
                <div className="dispute-msg__text">{msg.content}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="dispute-input">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disputeStatus === 'resolved' || disputeStatus === 'closed'
              ? 'Khiếu nại đã kết thúc, không thể gửi tin nhắn.'
              : 'Nhập tin nhắn… (Ctrl+Enter để gửi)'
          }
          maxLength={2000}
          aria-label="Nhập tin nhắn"
          disabled={sending || disputeStatus === 'resolved' || disputeStatus === 'closed'}
        />
        <Button
          type="primary"
          onClick={handleSend}
          loading={sending}
          disabled={text.trim().length === 0 || disputeStatus === 'resolved' || disputeStatus === 'closed'}
          aria-label="Gửi tin nhắn"
        >
          Gửi
        </Button>
      </div>
    </div>
  )
}
