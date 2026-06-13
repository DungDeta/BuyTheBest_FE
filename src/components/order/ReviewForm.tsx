import { useState } from 'react'
import { App, Button } from 'antd'
import { privatePost } from '@/api/api'
import type { ReviewRequest } from '@/types/order'

interface ReviewFormProps {
  orderId: string
  sellerName: string
  onSuccess: () => void
}

const MAX_COMMENT = 1000
const STARS = [1, 2, 3, 4, 5]

export function ReviewForm({ orderId, sellerName, onSuccess }: ReviewFormProps) {
  const { message } = App.useApp()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState(false)

  const commentLen = comment.length
  const displayRating = hovered > 0 ? hovered : rating

  async function handleSubmit() {
    if (rating === 0) {
      setRatingError(true)
      return
    }
    setRatingError(false)
    setSubmitting(true)
    try {
      const body: ReviewRequest = {
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }
      await privatePost(`/orders/${orderId}/review`, body)
      message.success('Đã gửi đánh giá thành công')
      onSuccess()
    } catch {
      message.error('Không thể gửi đánh giá. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="review-form">
      <div className="review-form__title">Đánh giá người bán: {sellerName}</div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 8,
          }}
        >
          Xếp hạng <span style={{ color: '#c7302b' }}>*</span>
        </div>
        <div className="review-form__stars" role="group" aria-label="Chọn xếp hạng">
          {STARS.map((star) => (
            <button
              key={star}
              type="button"
              className={`review-form__star${displayRating >= star ? ' review-form__star--active' : ''}`}
              onClick={() => {
                setRating(star)
                setRatingError(false)
              }}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              disabled={submitting}
              aria-label={`${star} sao`}
              aria-pressed={rating === star}
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >
              {displayRating >= star ? '★' : '☆'}
            </button>
          ))}
        </div>
        {ratingError && (
          <div
            role="alert"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c7302b', marginTop: 4 }}
          >
            Vui lòng chọn xếp hạng
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="review-comment"
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
          Nhận xét <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(tùy chọn)</span>
        </label>
        <textarea
          id="review-comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn về người bán…"
          maxLength={MAX_COMMENT}
          disabled={submitting}
          aria-describedby="review-comment-hint"
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
          id="review-comment-hint"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            marginTop: 4,
            color: 'var(--color-muted)',
          }}
        >
          {commentLen} / {MAX_COMMENT}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting}
        >
          Gửi đánh giá
        </Button>
      </div>
    </div>
  )
}
