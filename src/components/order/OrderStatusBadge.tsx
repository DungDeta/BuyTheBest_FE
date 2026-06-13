import type { OrderStatus } from '@/types/order'

interface OrderStatusBadgeProps {
  status: OrderStatus
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  refunded: 'Đã hoàn tiền',
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <span className={`order-status order-status--${status}`} aria-label={STATUS_LABELS[status]}>
      {STATUS_LABELS[status]}
    </span>
  )
}
