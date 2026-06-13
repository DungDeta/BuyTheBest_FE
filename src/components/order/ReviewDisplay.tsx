import dayjs from 'dayjs'
import type { OrderReview } from '@/types/order'

interface ReviewDisplayProps {
  review: OrderReview
  sellerName: string
}

export function ReviewDisplay({ review, sellerName }: ReviewDisplayProps) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{ fontSize: 20, color: '#cc6d00', letterSpacing: 2 }}
          aria-label={`${review.rating} trên 5 sao`}
        >
          {'★'.repeat(review.rating)}
          <span style={{ color: 'var(--color-border)' }}>{'☆'.repeat(5 - review.rating)}</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
          {dayjs(review.created_at).format('DD/MM/YYYY')}
        </span>
      </div>

      {review.comment && (
        <p style={{ margin: '0 0 12px', color: 'var(--color-muted)', lineHeight: 1.6 }}>
          {review.comment}
        </p>
      )}

      {review.seller_reply && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border)',
            paddingLeft: 14,
            borderLeft: '3px solid var(--color-border-strong)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--color-muted)',
              marginBottom: 6,
            }}
          >
            Phản hồi từ {sellerName}:
          </div>
          <p style={{ margin: '0 0 6px', lineHeight: 1.6 }}>{review.seller_reply}</p>
          {review.reply_at && (
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
              {dayjs(review.reply_at).format('DD/MM/YYYY')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
