import { useState } from 'react'
import { App, Button } from 'antd'
import { privatePost } from '@/api/api'
import type { ReviewReplyRequest } from '@/types/order'

interface SellerReplyFormProps {
  orderId: string
  onSuccess: () => void
}

const MAX_REPLY = 500

export function SellerReplyForm({ orderId, onSuccess }: SellerReplyFormProps) {
  const { message } = App.useApp()
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const replyLen = reply.trim().length
  const canSubmit = replyLen > 0 && replyLen <= MAX_REPLY

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const body: ReviewReplyRequest = { reply: reply.trim() }
      await privatePost(`/orders/${orderId}/review/reply`, body)
      message.success('Đã gửi phản hồi thành công')
      onSuccess()
    } catch {
      message.error('Không thể gửi phản hồi. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: '16px',
        background: 'var(--color-bg)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 3,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        Phản hồi đánh giá
      </div>

      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor="seller-reply"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Nội dung phản hồi
        </label>
        <textarea
          id="seller-reply"
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Viết phản hồi của bạn…"
          maxLength={MAX_REPLY}
          disabled={submitting}
          aria-describedby="seller-reply-hint"
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '10px 12px',
            border: '1.5px solid var(--color-border-strong)',
            borderRadius: 2,
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        <div
          id="seller-reply-hint"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            marginTop: 4,
            color: 'var(--color-muted)',
          }}
        >
          {reply.length} / {MAX_REPLY}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        >
          Gửi phản hồi
        </Button>
      </div>
    </div>
  )
}
