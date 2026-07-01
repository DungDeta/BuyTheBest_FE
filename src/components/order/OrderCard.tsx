import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { OrderStatusBadge } from './OrderStatusBadge'
import { OrderProductThumb } from './OrderProductThumb'
import {
  getOrderBuyerName,
  getOrderProductImageUrl,
  getOrderProductTitle,
  getOrderSellerName,
} from '@/utils/orderDisplay'
import type { Order } from '@/types/order'

interface OrderCardProps {
  order: Order
  role: 'buyer' | 'seller'
}

export function OrderCard({ order, role }: OrderCardProps) {
  const navigate = useNavigate()

  const imageUrl = getOrderProductImageUrl(order)
  const title = getOrderProductTitle(order)
  const sellerName = getOrderSellerName(order) ?? '-'
  const buyerName = getOrderBuyerName(order) ?? '-'
  const counterparty = role === 'buyer' ? sellerName : buyerName
  const counterpartyLabel = role === 'buyer' ? 'Người bán' : 'Người mua'

  function handleClick() {
    navigate(`/orders/${order.id}?role=${role}`, { state: { role } })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/orders/${order.id}?role=${role}`, { state: { role } })
    }
  }

  return (
    <div
      className="order-card"
      role="button"
      tabIndex={0}
      aria-label={`Đơn hàng: ${title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer' }}
    >
      <OrderProductThumb className="order-card__thumb" src={imageUrl} title={title} />

      <div className="order-card__info">
        <div className="order-card__title">{title}</div>
        <div className="order-card__facts" aria-label="Thông tin đơn hàng">
          <span className="order-card__fact">
            <span className="order-card__fact-label">Mã đơn</span>
            <strong>#{order.id.slice(0, 12).toUpperCase()}</strong>
          </span>
          <span className="order-card__fact">
            <span className="order-card__fact-label">Ngày tạo</span>
            <strong>{dayjs(order.created_at).format('DD/MM/YYYY HH:mm')}</strong>
          </span>
          <span className="order-card__fact order-card__fact--counterparty">
            <span className="order-card__fact-label">{counterpartyLabel}</span>
            <strong>{counterparty}</strong>
          </span>
        </div>
      </div>

      <div className="order-card__summary">
        <span className="order-card__total">
          <span className="order-card__fact-label">Tổng giá trị</span>
          <strong className="order-card__price">
            {order.final_price.toLocaleString('vi-VN') + ' ₫'}
          </strong>
        </span>
        <span className="order-card__status">
          <OrderStatusBadge status={order.status} />
        </span>
      </div>
    </div>
  )
}
