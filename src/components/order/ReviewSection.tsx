import { ReviewDisplay } from '@/components/order/ReviewDisplay'
import { ReviewForm } from '@/components/order/ReviewForm'
import { SellerReplyForm } from '@/components/order/SellerReplyForm'
import type { EscrowStatus, OrderReview, OrderStatus } from '@/types/order'

interface ReviewSectionProps {
  orderId: string
  review: OrderReview | null | undefined
  isBuyer: boolean
  isSeller: boolean
  orderStatus: OrderStatus
  escrowStatus?: EscrowStatus | null
  sellerName: string
  onUpdate: () => void
}

export function ReviewSection({
  orderId,
  review,
  isBuyer,
  isSeller,
  orderStatus,
  escrowStatus,
  sellerName,
  onUpdate,
}: ReviewSectionProps) {
  const showReviewForm =
    !review &&
    isBuyer &&
    escrowStatus === 'released' &&
    (orderStatus === 'delivered' || orderStatus === 'completed')
  const showReplyForm = !!review && isSeller && !review.seller_reply
  const showDisplay = !!review

  if (!showDisplay && !showReviewForm) return null

  return (
    <div className="detail-section">
      <div className="detail-section__title">Đánh giá</div>

      {showDisplay && (
        <ReviewDisplay review={review} sellerName={sellerName} />
      )}

      {showReviewForm && (
        <ReviewForm orderId={orderId} sellerName={sellerName} onSuccess={onUpdate} />
      )}

      {showReplyForm && (
        <SellerReplyForm orderId={orderId} onSuccess={onUpdate} />
      )}
    </div>
  )
}
