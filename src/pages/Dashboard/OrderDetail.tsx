import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, App, Button, Modal, Select, Spin } from 'antd'
import dayjs from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import { DisputeSection } from '@/components/order/DisputeSection'
import { EscrowTimeline } from '@/components/order/EscrowTimeline'
import { OpenDisputeForm } from '@/components/order/OpenDisputeForm'
import { OrderProductThumb } from '@/components/order/OrderProductThumb'
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge'
import { ReviewSection } from '@/components/order/ReviewSection'
import { ShipModal } from '@/components/order/ShipModal'
import {
  getOrderCancelReasonLabel,
  getOrderProductConditionLabel,
  getOrderBuyerName,
  getOrderProductImageUrl,
  getOrderProductTitle,
  getOrderSellerName,
} from '@/utils/orderDisplay'
import type {
  EscrowStatus,
  Order,
  OrderDispute,
  OrderPayment,
  OrderReview,
  OrderShipment,
  PaymentStatus,
  ShipmentStatus,
} from '@/types/order'
import './post-win.css'

type OrderDetailResponse = Order | { order: Order }

type PaymentStatusResponse = Omit<OrderPayment, 'id'> & {
  id?: number
  order_id?: string
}

type ShipmentResponse = Omit<OrderShipment, 'id'> & {
  id?: number
  order_id?: string
  created_at?: string
}

const CANCEL_REASON_OPTIONS = [
  { value: 'changed_mind', label: 'Đổi ý không mua nữa' },
  { value: 'wrong_bid', label: 'Đặt nhầm hoặc nhập sai giá' },
  { value: 'payment_issue', label: 'Gặp vấn đề thanh toán' },
  { value: 'found_alternative', label: 'Đã mua sản phẩm khác' },
  { value: 'other', label: 'Lý do khác' },
]

const CANCEL_DETAIL_MAX_LENGTH = 160

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  initiated: 'Chờ thanh toán',
  success: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
}

const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  pending: 'Chưa giữ tiền',
  held: 'Đang giữ tiền',
  released: 'Đã giải ngân',
  refunded: 'Đã hoàn tiền',
  partial_refund: 'Đã hoàn một phần',
  disputed: 'Tạm giữ do khiếu nại',
}

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Chưa gửi hàng',
  shipped: 'Đã gửi hàng',
  in_transit: 'Đang vận chuyển',
  delivered: 'Đã giao hàng',
  failed: 'Giao hàng thất bại',
}

function extractOrder(data: OrderDetailResponse | undefined): Order | null {
  if (!data) return null
  if ('order' in data) return data.order
  return data
}

function normalizePayment(data: PaymentStatusResponse): OrderPayment {
  return {
    id: data.id ?? 0,
    provider: data.provider,
    amount: data.amount,
    platform_fee: data.platform_fee,
    refund_amount: data.refund_amount ?? 0,
    seller_amount: data.seller_amount,
    status: data.status,
    escrow_status: data.escrow_status,
    auto_release_at: data.auto_release_at,
    completed_at: data.completed_at,
  }
}

function normalizeShipment(data: ShipmentResponse): OrderShipment {
  return {
    id: data.id ?? 0,
    tracking_number: data.tracking_number,
    carrier: data.carrier,
    status: data.status,
    shipped_at: data.shipped_at,
    delivered_at: data.delivered_at,
    buyer_confirmed_at: data.buyer_confirmed_at,
  }
}

export function Component() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const currentUserId = useAuthStore((s) => s.user?.id ?? null)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReasonType, setCancelReasonType] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const cancelReasonRef = useRef('')

  const fetchOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const res = await privateGet<OrderDetailResponse>(`/orders/${id}`)
      const fetched = extractOrder(res.data)
      if (fetched) {
        const reviewRequest =
          fetched.status === 'delivered' || fetched.status === 'completed'
            ? privateGet<OrderReview>(`/orders/${fetched.id}/review`)
            : Promise.resolve(null)
        const [paymentResult, shipmentResult, disputeResult, reviewResult] = await Promise.allSettled([
          privateGet<PaymentStatusResponse>(`/orders/${fetched.id}/payment`),
          privateGet<ShipmentResponse>(`/orders/${fetched.id}/shipment`),
          privateGet<OrderDispute>(`/orders/${fetched.id}/dispute`),
          reviewRequest,
        ])

        const hydrated: Order = { ...fetched }
        if (paymentResult.status === 'fulfilled' && paymentResult.value.data) {
          hydrated.payment = normalizePayment(paymentResult.value.data)
        }
        if (shipmentResult.status === 'fulfilled' && shipmentResult.value.data) {
          hydrated.shipment = normalizeShipment(shipmentResult.value.data)
        }
        if (reviewResult.status === 'fulfilled' && reviewResult.value?.data) {
          hydrated.review = reviewResult.value.data
        }
        if (disputeResult.status === 'fulfilled' && disputeResult.value.data) {
          hydrated.dispute = disputeResult.value.data
        }
        setOrder(hydrated)
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  async function handleCancelConfirm() {
    if (!order) return
    if (!cancelReasonType) {
      message.warning('Vui lòng chọn lý do huỷ đơn.')
      return
    }
    setActionLoading(true)
    try {
      const reasonLabel =
        CANCEL_REASON_OPTIONS.find((option) => option.value === cancelReasonType)?.label ?? cancelReasonType
      const detail = cancelReasonRef.current.trim()
      const reason = detail ? `${reasonLabel}: ${detail}` : reasonLabel
      await privatePost(`/orders/${order.id}/cancel`, { reason })
      message.success('Đã huỷ đơn hàng')
      setCancelModalOpen(false)
      setCancelReasonType(null)
      setCancelReason('')
      cancelReasonRef.current = ''
      await fetchOrder()
    } catch {
      message.error('Không thể huỷ đơn hàng. Vui lòng thử lại.')
    } finally {
      setActionLoading(false)
    }
  }

  function handleCancelOrder() {
    if (!order) return
    setCancelReasonType(null)
    setCancelReason('')
    cancelReasonRef.current = ''
    setCancelModalOpen(true)
  }

  function handleConfirmReceipt() {
    if (!order) return
    modal.confirm({
      title: 'Xác nhận nhận hàng',
      content: 'Xác nhận bạn đã nhận được hàng? Đơn hàng sẽ chuyển sang trạng thái đã giao, bạn vẫn có thể mở khiếu nại trong 30 ngày trước khi escrow tự động giải ngân.',
      okText: 'Xác nhận',
      cancelText: 'Chưa',
      onOk: async () => {
        setActionLoading(true)
        try {
          await privatePost(`/orders/${order.id}/confirm-delivery`, {})
          message.success('Đã xác nhận nhận hàng')
          await fetchOrder()
        } catch {
          message.error('Không thể xác nhận. Vui lòng thử lại.')
        } finally {
          setActionLoading(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }} aria-label="Đang tải">
        <Spin size="large" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
        <p style={{ color: 'var(--color-muted)', marginBottom: 16 }}>
          Đơn hàng không tồn tại hoặc bạn không có quyền truy cập.
        </p>
        <Link to="/orders" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          ← Quay lại đơn hàng
        </Link>
      </div>
    )
  }

  const imageUrl = getOrderProductImageUrl(order)
  const title = getOrderProductTitle(order)
  const sellerName = getOrderSellerName(order)
  const buyerName = getOrderBuyerName(order)
  const productDescription = (order.product?.description ?? order.auction?.product?.description)?.trim()
  const productCondition = getOrderProductConditionLabel(
    order.product?.condition ?? order.auction?.product?.condition,
  )
  const shortId = order.id.slice(0, 12).toUpperCase()
  const buyer = order.viewer_role === 'buyer'
  const seller = order.viewer_role === 'seller'
  const hasActiveDispute = Boolean(order.dispute) || order.payment?.escrow_status === 'disputed'
  const disputeReferenceAt =
    order.shipment?.delivered_at ??
    order.delivered_at
  const canOpenDispute = Boolean(
    buyer &&
      !hasActiveDispute &&
      order.payment?.escrow_status === 'held' &&
      order.status === 'delivered' &&
      disputeReferenceAt &&
      dayjs().diff(dayjs(disputeReferenceAt), 'day', true) <= 30,
  )
  const isDeliveredEscrowHeld = Boolean(
    buyer &&
      order.status === 'delivered' &&
      order.payment?.escrow_status === 'held' &&
      !hasActiveDispute,
  )
  const autoReleaseText = order.payment?.auto_release_at
    ? dayjs(order.payment.auto_release_at).format('DD/MM/YYYY HH:mm')
    : null
  const escrowDeadlineLabel = order.status === 'shipped'
    ? 'Tự động ghi nhận giao hàng'
    : 'Tự động giải ngân'
  const hasShipmentActivity = Boolean(
    order.shipment &&
      (
        order.shipment.status !== 'pending' ||
        order.shipment.tracking_number ||
        (order.shipment.carrier && order.shipment.carrier !== 'other')
      ),
  )

  return (
    <div className="order-detail">
      <nav
        className="room-breadcrumb"
        aria-label="Breadcrumb"
        style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 13 }}
      >
        <Link to="/dashboard">Dashboard</Link>
        <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--color-muted)' }}>/</span>
        <Link to="/orders">Đơn hàng</Link>
        <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--color-muted)' }}>/</span>
        <span aria-current="page">#{shortId}</span>
      </nav>

      <div className="order-detail__header">
        <div>
          <h1 className="order-detail__title">Đơn hàng #{shortId}</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            Tạo lúc {dayjs(order.created_at).format('DD/MM/YYYY HH:mm')}
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <EscrowTimeline status={order.status} />

      {order.status === 'cancelled' && (
        <div className="detail-section detail-section--danger" role="status">
          <div className="detail-section__title">Thông tin hủy đơn</div>
          <div className="shipment-info">
            <div className="shipment-info__item">
              <div className="shipment-info__label">Thời gian hủy</div>
              <div className="shipment-info__value">
                {order.cancelled_at
                  ? dayjs(order.cancelled_at).format('DD/MM/YYYY HH:mm')
                  : 'Chưa ghi nhận'}
              </div>
            </div>
            <div className="shipment-info__item">
              <div className="shipment-info__label">Lý do</div>
              <div className="shipment-info__value">
                {getOrderCancelReasonLabel(order.cancel_reason) || 'Không có lý do'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="detail-section">
        <div className="detail-section__title">Sản phẩm</div>
        <div className="product-line">
          <OrderProductThumb className="product-line__thumb" src={imageUrl} title={title} />
          <div>
            <div className="product-line__title">{title}</div>
            <div className="product-line__meta">
              {sellerName && <>Người bán: <strong>{sellerName}</strong></>}
              {buyerName && (
                <>
                  {sellerName ? ' · ' : ''}
                  Người mua: <strong>{buyerName}</strong>
                </>
              )}
              {productCondition && (
                <>
                  {(sellerName || buyerName) ? ' · ' : ''}
                  Tình trạng: <strong>{productCondition}</strong>
                </>
              )}
            </div>
            {productDescription && (
              <p className="product-line__description">{productDescription}</p>
            )}
          </div>
          <div className="product-line__price">
            {order.final_price.toLocaleString('vi-VN') + ' ₫'}
          </div>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section__title">Giao nhận</div>
        <div className="shipment-info">
          {hasShipmentActivity && order.shipment && (
            <>
              <div className="shipment-info__item">
                <div className="shipment-info__label">Trạng thái vận chuyển</div>
                <div className="shipment-info__value">
                  {SHIPMENT_STATUS_LABELS[order.shipment.status]}
                </div>
              </div>
              {order.shipment.carrier && order.shipment.carrier !== 'other' && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Đơn vị vận chuyển</div>
                  <div className="shipment-info__value">{order.shipment.carrier}</div>
              </div>
              )}
              {order.shipment.tracking_number && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Mã vận đơn</div>
                <div className="shipment-info__value" style={{ fontFamily: 'var(--font-mono)' }}>
                    {order.shipment.tracking_number}
                </div>
              </div>
              )}
              {order.shipment.shipped_at && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Ngày giao</div>
                <div className="shipment-info__value">
                    {dayjs(order.shipment.shipped_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
              )}
              {order.shipment.delivered_at && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Ngày nhận</div>
                <div className="shipment-info__value">
                    {dayjs(order.shipment.delivered_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
              )}
            </>
          )}
          {!hasShipmentActivity && (
            <div className="shipment-info__item">
              <div className="shipment-info__label">Trạng thái vận chuyển</div>
              <div className="shipment-info__value">Chưa gửi hàng</div>
            </div>
          )}
          <div className="shipment-info__item" style={{ gridColumn: '1 / -1' }}>
            <div className="shipment-info__label">Địa chỉ giao hàng</div>
            <div className="shipment-info__value">
              {order.shipping_address ? (
                <>
                  {order.shipping_name && <span>{order.shipping_name} · </span>}
                  {order.shipping_phone && <span>{order.shipping_phone} · </span>}
                  {order.shipping_address}
                </>
              ) : (
                <span className="detail-empty">Chưa cập nhật địa chỉ giao hàng</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {order.payment && (
        <div className="detail-section">
          <div className="detail-section__title">Thanh toán</div>
          <div className="shipment-info">
            <div className="shipment-info__item">
              <div className="shipment-info__label">Trạng thái thanh toán</div>
              <div className="shipment-info__value">
                {PAYMENT_STATUS_LABELS[order.payment.status]}
              </div>
            </div>
            <div className="shipment-info__item">
              <div className="shipment-info__label">Cổng thanh toán</div>
              <div className="shipment-info__value">
                {order.payment.provider ? order.payment.provider.toUpperCase() : 'Chưa chọn'}
              </div>
            </div>
            <div className="shipment-info__item">
              <div className="shipment-info__label">Người mua thanh toán</div>
              <div className="shipment-info__value">
                {order.payment.amount.toLocaleString('vi-VN') + ' ₫'}
              </div>
            </div>
            <div className="shipment-info__item">
              <div className="shipment-info__label">Phí nền tảng</div>
              <div className="shipment-info__value">
                {order.payment.platform_fee.toLocaleString('vi-VN') + ' ₫'}
              </div>
            </div>
            <div className="shipment-info__item">
              <div className="shipment-info__label">Người bán nhận</div>
              <div className="shipment-info__value">
                {order.payment.seller_amount.toLocaleString('vi-VN') + ' ₫'}
              </div>
            </div>
            {order.payment.refund_amount > 0 && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Hoàn cho người mua</div>
                <div className="shipment-info__value">
                  {order.payment.refund_amount.toLocaleString('vi-VN') + ' ₫'}
                </div>
              </div>
            )}
            <div className="shipment-info__item">
              <div className="shipment-info__label">Trạng thái Escrow</div>
              <div className="shipment-info__value">
                {ESCROW_STATUS_LABELS[order.payment.escrow_status]}
              </div>
            </div>
            <div className="shipment-info__item">
              <div className="shipment-info__label">Thời gian thanh toán</div>
              <div className="shipment-info__value">
                {order.paid_at
                  ? dayjs(order.paid_at).format('DD/MM/YYYY HH:mm')
                  : 'Chưa thanh toán'}
              </div>
            </div>
            {order.payment.auto_release_at && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">{escrowDeadlineLabel}</div>
                <div className="shipment-info__value">
                  {dayjs(order.payment.auto_release_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {seller && order.payment?.escrow_status === 'held' && (
        <div className="detail-section">
          <div className="detail-section__title">Tiền chờ giải ngân</div>
          <div className="shipment-info">
            <div className="shipment-info__item">
              <div className="shipment-info__label">Số tiền</div>
              <div className="shipment-info__value">
                {order.payment.seller_amount.toLocaleString('vi-VN') + ' ₫'}
              </div>
            </div>
            <div className="shipment-info__item">
              <div className="shipment-info__label">Phí sàn</div>
              <div className="shipment-info__value">
                {order.payment.platform_fee.toLocaleString('vi-VN') + ' ₫'}
              </div>
            </div>
            {order.payment.auto_release_at && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">{escrowDeadlineLabel}</div>
                <div className="shipment-info__value">
                  {dayjs(order.payment.auto_release_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
            )}
            <div
              className="shipment-info__item"
              style={{ gridColumn: '1 / -1' }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: '#e8f5e9',
                  border: '1px solid #118c4f',
                  borderRadius: 3,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: '#118c4f',
                  lineHeight: 1.6,
                }}
              >
                Tiền được giữ trong escrow suốt quá trình giao hàng. Khi giao hàng được ghi nhận,
                thời hạn khiếu nại 30 ngày bắt đầu; sau đó hệ thống mới tự động giải ngân nếu không có tranh chấp.
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="order-detail__actions" style={{ marginTop: 8, marginBottom: 18 }}>
        {buyer && order.status === 'pending_payment' && (
          <>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate(`/orders/${order.id}/checkout`)}
            >
              Thanh toán ngay
            </Button>
            <Button
              danger
              size="large"
              loading={actionLoading}
              onClick={handleCancelOrder}
            >
              Huỷ đơn
            </Button>
          </>
        )}

        {seller && order.status === 'paid' && (
          <Button
            type="primary"
            size="large"
            onClick={() => setShipModalOpen(true)}
          >
            Đã gửi hàng
          </Button>
        )}

        {buyer && order.status === 'shipped' && !hasActiveDispute && (
          <Button
            type="primary"
            size="large"
            loading={actionLoading}
            onClick={handleConfirmReceipt}
          >
            Đã nhận hàng
          </Button>
        )}

        {canOpenDispute && (
          <Button
            size="large"
            danger
            onClick={() => {
              document.getElementById('open-dispute-form')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }}
          >
            Mở khiếu nại
          </Button>
        )}
      </div>

      {isDeliveredEscrowHeld && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Escrow đang được giữ trong thời hạn khiếu nại"
          description={
            autoReleaseText
              ? `Bạn có thể mở khiếu nại trong thời hạn cho phép. Nếu không có khiếu nại, hệ thống sẽ tự động giải ngân cho người bán vào ${autoReleaseText}; sau đó bạn có thể đánh giá người bán.`
              : 'Bạn có thể mở khiếu nại trong thời hạn cho phép. Sau khi escrow được giải ngân, bạn có thể đánh giá người bán.'
          }
        />
      )}

      {order.payment?.escrow_status === 'disputed' && !order.dispute && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Đơn hàng đang có khiếu nại"
          description="Có khiếu nại đang xử lý. Vui lòng liên hệ hỗ trợ nếu cần thêm thông tin."
        />
      )}

      {order.dispute && currentUserId && (
        <DisputeSection
          dispute={order.dispute}
          currentUserId={currentUserId}
          buyerId={order.buyer_id}
          sellerId={order.seller_id}
          isBuyer={buyer}
          isSeller={seller}
          payment={order.payment}
          onUpdate={fetchOrder}
        />
      )}

      {canOpenDispute && <OpenDisputeForm orderId={order.id} onSuccess={fetchOrder} />}

      <ReviewSection
        orderId={order.id}
        review={order.review}
        isBuyer={buyer}
        isSeller={seller}
        orderStatus={order.status}
        escrowStatus={order.payment?.escrow_status}
        sellerName={sellerName ?? 'Người bán'}
        onUpdate={fetchOrder}
      />

      <Modal
        title="Huỷ đơn hàng"
        open={cancelModalOpen}
        onCancel={() => {
          setCancelModalOpen(false)
          setCancelReasonType(null)
          setCancelReason('')
          cancelReasonRef.current = ''
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setCancelModalOpen(false)
              setCancelReasonType(null)
              setCancelReason('')
              cancelReasonRef.current = ''
            }}
            disabled={actionLoading}
          >
            Không
          </Button>,
          <Button
            key="ok"
            danger
            type="primary"
            loading={actionLoading}
            onClick={handleCancelConfirm}
          >
            Huỷ đơn
          </Button>,
        ]}
        destroyOnHidden
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 12 }}>
          Bạn có chắc muốn huỷ đơn hàng này?
        </p>
        <div
          style={{
            padding: '10px 12px',
            border: '1px solid #cc6d00',
            background: '#fff8e1',
            color: '#8a4b00',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          Huỷ đơn sẽ được ghi nhận vào lịch sử giao dịch và có thể ảnh hưởng điểm uy tín nếu lặp lại.
        </div>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 12 }}>
          Lý do huỷ <span style={{ color: '#c7302b' }}>*</span>
          <Select
            value={cancelReasonType ?? undefined}
            onChange={setCancelReasonType}
            options={CANCEL_REASON_OPTIONS}
            placeholder="Chọn lý do huỷ"
            disabled={actionLoading}
            style={{ display: 'block', width: '100%', marginTop: 6 }}
          />
        </label>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
          Mô tả thêm
          <textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value)
              cancelReasonRef.current = e.target.value
            }}
            placeholder="Nhập lý do huỷ đơn…"
            maxLength={CANCEL_DETAIL_MAX_LENGTH}
            disabled={actionLoading}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              resize: 'vertical',
              padding: '8px 10px',
              border: '1.5px solid var(--color-border-strong)',
              borderRadius: 2,
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          <span className="field-hint">
            {cancelReason.length}/{CANCEL_DETAIL_MAX_LENGTH} ký tự
          </span>
        </label>
      </Modal>

      <ShipModal
        orderId={order.id}
        open={shipModalOpen}
        onClose={() => setShipModalOpen(false)}
        onSuccess={() => {
          setShipModalOpen(false)
          fetchOrder()
        }}
      />
    </div>
  )
}
