import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  getOrderBuyerName,
  getOrderProductImageUrl,
  getOrderProductTitle,
  getOrderSellerName,
} from '@/utils/orderDisplay'
import type { Order, OrderDispute, OrderPayment, OrderReview, OrderShipment } from '@/types/order'
import './post-win.css'

type OrderDetailResponse = Order | { order: Order }
type RoleTab = 'buyer' | 'seller'

interface RouteState {
  role?: RoleTab
}

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
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
  const stateRole = (location.state as RouteState | null)?.role
  const queryRole = searchParams.get('role')
  const sessionRole = id ? sessionStorage.getItem(`order-role:${id}`) : null
  const routeRole: RoleTab | null =
    stateRole === 'buyer' || stateRole === 'seller'
      ? stateRole
      : queryRole === 'buyer' || queryRole === 'seller'
        ? queryRole
        : sessionRole === 'buyer' || sessionRole === 'seller'
          ? sessionRole
          : null

  const fetchOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const res = await privateGet<OrderDetailResponse>(`/orders/${id}`)
      const fetched = extractOrder(res.data)
      if (fetched) {
        const reviewRequest =
          fetched.status === 'completed'
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

  function isBuyer() {
    if (!order) return false
    if (routeRole === 'buyer') return true
    const buyerId = order.buyer?.id ?? order.buyer_id
    return currentUserId !== null && String(buyerId) === String(currentUserId)
  }

  function isSellerRole() {
    if (!order) return false
    if (routeRole === 'seller') return true
    const sellerId = order.auction?.seller?.id ?? order.seller?.id ?? order.seller_id
    return currentUserId !== null && String(sellerId) === String(currentUserId)
  }

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
      content: 'Xác nhận bạn đã nhận được hàng? Tiền sẽ được giải phóng cho người bán.',
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
  const shortId = order.id.slice(0, 12).toUpperCase()
  const buyer = isBuyer()
  const seller = isSellerRole()
  const hasActiveDispute = Boolean(order.dispute) || order.payment?.escrow_status === 'disputed'

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
            </div>
          </div>
          <div className="product-line__price">
            {order.final_price.toLocaleString('vi-VN') + ' ₫'}
          </div>
        </div>
      </div>

      {(order.shipment || order.shipping_address) && (
        <div className="detail-section">
          <div className="detail-section__title">Vận chuyển</div>
          <div className="shipment-info">
            {order.shipment?.carrier && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Đơn vị vận chuyển</div>
                <div className="shipment-info__value">{order.shipment?.carrier}</div>
              </div>
            )}
            {order.shipment?.tracking_number && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Mã vận đơn</div>
                <div className="shipment-info__value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {order.shipment?.tracking_number}
                </div>
              </div>
            )}
            {order.shipment?.shipped_at && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Ngày giao</div>
                <div className="shipment-info__value">
                  {dayjs(order.shipment?.shipped_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
            )}
            {order.shipment?.delivered_at && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Ngày nhận</div>
                <div className="shipment-info__value">
                  {dayjs(order.shipment?.delivered_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
            )}
            {order.shipping_address && (
              <div className="shipment-info__item" style={{ gridColumn: '1 / -1' }}>
                <div className="shipment-info__label">Địa chỉ giao hàng</div>
                <div className="shipment-info__value">
                  {order.shipping_name && <span>{order.shipping_name} · </span>}
                  {order.shipping_phone && <span>{order.shipping_phone} · </span>}
                  {order.shipping_address}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {order.payment && (
        <div className="detail-section">
          <div className="detail-section__title">Thanh toán</div>
          <div className="shipment-info">
            <div className="shipment-info__item">
              <div className="shipment-info__label">Tổng tiền</div>
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
            <div className="shipment-info__item">
              <div className="shipment-info__label">Trạng thái Escrow</div>
              <div
                className="shipment-info__value"
                style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: 12 }}
              >
                {order.payment.escrow_status}
              </div>
            </div>
            {order.payment.auto_release_at && (
              <div className="shipment-info__item">
                <div className="shipment-info__label">Tự động giải phóng</div>
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
                <div className="shipment-info__label">Giải ngân tự động</div>
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
                Tiền sẽ được chuyển vào tài khoản sau khi buyer xác nhận hoặc sau 7 ngày.
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
            Đánh dấu đã giao
          </Button>
        )}

        {buyer && order.status === 'shipped' && !hasActiveDispute && (
          <Button
            type="primary"
            size="large"
            loading={actionLoading}
            onClick={handleConfirmReceipt}
          >
            Xác nhận nhận hàng
          </Button>
        )}

        {buyer && (order.status === 'shipped' || order.status === 'delivered') && !hasActiveDispute && (
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
          orderId={order.id}
          currentUserId={currentUserId}
          buyerId={order.buyer_id}
          sellerId={order.seller_id}
          isBuyer={buyer}
          isSeller={seller}
          onUpdate={fetchOrder}
        />
      )}

      {!hasActiveDispute &&
        buyer &&
        (order.status === 'shipped' || order.status === 'delivered') && (
          <OpenDisputeForm orderId={order.id} onSuccess={fetchOrder} />
        )}

      <ReviewSection
        orderId={order.id}
        review={order.review}
        isBuyer={buyer}
        isSeller={seller}
        orderStatus={order.status}
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
            maxLength={500}
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
