import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Input, Spin } from 'antd'
import dayjs from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import { useCountdown } from '@/hooks/useCountdown'
import { EscrowTimeline } from '@/components/order/EscrowTimeline'
import { OrderProductThumb } from '@/components/order/OrderProductThumb'
import { PaymentCallbackContent } from './PaymentCallback'
import {
  getOrderAuctionModeLabel,
  getOrderProductImageUrl,
  getOrderProductTitle,
} from '@/utils/orderDisplay'
import type { Order, AddressRequest, OrderPayment } from '@/types/order'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './post-win.css'

type OrderDetailResponse = Order | { order: Order }

interface PayResponse {
  payment_url: string
}

type PaymentStatusResponse = Omit<OrderPayment, 'id'> & {
  id?: number
  order_id?: string
}

type PaymentMethod = 'vnpay' | 'stripe' | 'bank'

const MISSING_DEADLINE = new Date(0).toISOString()

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

function WinBanner({
  deadline,
  countdown,
}: {
  deadline: string
  countdown: ReturnType<typeof useCountdown>
}) {
  const padded = (n: number) => String(n).padStart(2, '0')
  const display = countdown.isExpired
    ? 'Hết hạn'
    : `${padded(countdown.hours)}:${padded(countdown.minutes)}:${padded(countdown.seconds)}`

  return (
    <div className={`win-banner${countdown.isExpired ? ' win-banner--expired' : ''}`} role="alert">
      <div className="win-banner__icon" aria-hidden="true">✓</div>
      <div>
        <div className="win-banner__title">Bạn đã thắng phiên đấu giá!</div>
        <div className="win-banner__sub">
          Hoàn tất thanh toán trước{' '}
          {dayjs(deadline).format('DD/MM/YYYY HH:mm')} để xác nhận đơn hàng.
        </div>
      </div>
      <div className="win-banner__countdown" aria-live="polite" aria-atomic="true">
        <div className="win-banner__countdown-label">Còn lại</div>
        <div
          className="win-banner__countdown-value"
          style={{
            color: countdown.isUrgent
              ? '#c7302b'
              : countdown.isWarning
                ? '#cc6d00'
                : '#118c4f',
          }}
        >
          {display}
        </div>
      </div>
    </div>
  )
}

interface AddressSectionProps {
  order: Order
  onSaved: (name: string, phone: string, address: string) => void
}

function AddressSection({ order, onSaved }: AddressSectionProps) {
  const { message } = App.useApp()
  const hasAddress =
    Boolean(order.shipping_name) &&
    Boolean(order.shipping_phone) &&
    Boolean(order.shipping_address)

  const [editing, setEditing] = useState(!hasAddress)
  const [name, setName] = useState(order.shipping_name ?? '')
  const [phone, setPhone] = useState(order.shipping_phone ?? '')
  const [address, setAddress] = useState(order.shipping_address ?? '')
  const [errors, setErrors] = useState<{
    name?: string
    phone?: string
    address?: string
  }>({})
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const nextErrors: typeof errors = {}
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedAddress = address.trim()
    const phoneDigits = trimmedPhone.replace(/\D/g, '')

    if (!trimmedName) nextErrors.name = 'Vui lòng nhập họ tên người nhận.'
    if (!trimmedPhone) {
      nextErrors.phone = 'Vui lòng nhập số điện thoại.'
    } else if (!/^[+\d\s().-]+$/.test(trimmedPhone) || phoneDigits.length < 9 || phoneDigits.length > 15) {
      nextErrors.phone = 'Số điện thoại phải có từ 9 đến 15 chữ số.'
    }
    if (!trimmedAddress) nextErrors.address = 'Vui lòng nhập địa chỉ giao hàng.'
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      message.warning('Vui lòng kiểm tra lại thông tin giao hàng.')
      return
    }
    setSaving(true)
    try {
      const body: AddressRequest = {
        shipping_name: trimmedName,
        shipping_phone: trimmedPhone,
        shipping_address: trimmedAddress,
      }
      await privatePost(`/orders/${order.id}/address`, body)
      message.success('Đã lưu địa chỉ giao hàng')
      onSaved(body.shipping_name, body.shipping_phone, body.shipping_address)
      setEditing(false)
    } catch {
      message.error('Không thể lưu địa chỉ. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing && hasAddress) {
    return (
      <div className="address-card address-card--selected">
        <div style={{ flex: 1 }}>
          <div className="address-card__name">{order.shipping_name}</div>
          <div className="address-card__lines">
            {order.shipping_phone}
            <br />
            {order.shipping_address}
          </div>
        </div>
        <Button
          size="small"
          onClick={() => setEditing(true)}
          style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}
        >
          Đổi địa chỉ
        </Button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Input
        placeholder="Họ và tên người nhận"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setErrors((current) => ({ ...current, name: undefined }))
        }}
        maxLength={200}
        aria-invalid={Boolean(errors.name)}
        style={{ fontFamily: 'var(--font-mono)' }}
        aria-label="Họ và tên người nhận"
      />
      {errors.name && <div className="field-error" role="alert">{errors.name}</div>}
      <Input
        placeholder="Số điện thoại"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value)
          setErrors((current) => ({ ...current, phone: undefined }))
        }}
        maxLength={20}
        aria-invalid={Boolean(errors.phone)}
        style={{ fontFamily: 'var(--font-mono)' }}
        aria-label="Số điện thoại"
      />
      {errors.phone && <div className="field-error" role="alert">{errors.phone}</div>}
      <Input.TextArea
        placeholder="Địa chỉ giao hàng (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành)"
        value={address}
        onChange={(e) => {
          setAddress(e.target.value)
          setErrors((current) => ({ ...current, address: undefined }))
        }}
        maxLength={500}
        aria-invalid={Boolean(errors.address)}
        rows={3}
        style={{ fontFamily: 'var(--font-mono)', resize: 'none' }}
        aria-label="Địa chỉ giao hàng"
      />
      {errors.address && <div className="field-error" role="alert">{errors.address}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          loading={saving}
          onClick={handleSave}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Lưu địa chỉ
        </Button>
        {hasAddress && (
          <Button
            onClick={() => setEditing(false)}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Huỷ
          </Button>
        )}
      </div>
    </div>
  )
}

interface PaymentMethodCardProps {
  method: PaymentMethod
  selected: boolean
  disabled?: boolean
  label: string
  desc: string
  iconClass: string
  iconText: string
  onSelect: () => void
}

function PaymentMethodCard({
  selected,
  disabled,
  label,
  desc,
  iconClass,
  iconText,
  onSelect,
}: PaymentMethodCardProps) {
  return (
    <div
      className={`pay-card${selected ? ' pay-card--selected' : ''}${disabled ? ' pay-card--disabled' : ''}`}
      onClick={disabled ? undefined : onSelect}
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) onSelect()
      }}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <div className="pay-card__radio" aria-hidden="true" />
      <div className={`pay-card__icon ${iconClass}`}>{iconText}</div>
      <div>
        <div className="pay-card__name">{label}</div>
        <div className="pay-card__desc">{desc}</div>
      </div>
    </div>
  )
}

export function Component() {
  useDocumentTitle('Thanh toán')
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('vnpay')
  const [paying, setPaying] = useState(false)
  const isVnpayReturn = location.search.includes('vnp_')
  const countdown = useCountdown(order?.payment_deadline ?? MISSING_DEADLINE)

  const fetchOrder = useCallback(async () => {
    if (!id || isVnpayReturn) return
    setLoading(true)
    try {
        const res = await privateGet<OrderDetailResponse>(`/orders/${id}`)
      const fetched = extractOrder(res.data)
      if (fetched) {
        if (fetched.viewer_role && fetched.viewer_role !== 'buyer') {
          navigate(`/orders/${fetched.id}?role=seller`, { replace: true })
          return
        }
        if (fetched.status !== 'pending_payment') {
          navigate(`/orders/${fetched.id}`, { replace: true })
          return
        }
        const paymentResult = await Promise.allSettled([
          privateGet<PaymentStatusResponse>(`/orders/${fetched.id}/payment`),
        ])
        const hydrated: Order = { ...fetched }
        const [payment] = paymentResult
        if (payment.status === 'fulfilled' && payment.value.data) {
          hydrated.payment = normalizePayment(payment.value.data)
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
  }, [id, isVnpayReturn, navigate])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  if (isVnpayReturn) {
    return <PaymentCallbackContent />
  }

  function handleAddressSaved(name: string, phone: string, addr: string) {
    if (!order) return
    setOrder({
      ...order,
      shipping_name: name,
      shipping_phone: phone,
      shipping_address: addr,
    })
  }

  async function handlePay() {
    if (!order) return
    if (countdown.isExpired) {
      message.error('Đơn hàng đã hết hạn thanh toán.')
      return
    }
    if (!order.shipping_name || !order.shipping_phone || !order.shipping_address) {
      message.warning('Vui lòng nhập địa chỉ giao hàng trước khi thanh toán.')
      return
    }
    setPaying(true)
    try {
      const res = await privatePost<PayResponse>(`/orders/${order.id}/pay`, {})
      if (res.data?.payment_url) {
        window.location.href = res.data.payment_url
      } else {
        message.error('Không nhận được link thanh toán. Vui lòng thử lại.')
      }
    } catch {
      message.error('Khởi tạo thanh toán thất bại. Vui lòng thử lại.')
    } finally {
      setPaying(false)
    }
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
  const auctionMode = getOrderAuctionModeLabel(order.auction?.mode)
  const shortId = order.id.slice(0, 12).toUpperCase()
  const deadline = order.payment_deadline ?? MISSING_DEADLINE
  const finalPrice = order.final_price
  const platformFee = order.payment?.platform_fee || Math.round(finalPrice * 0.05)
  const sellerAmount = order.payment?.seller_amount || finalPrice - platformFee
  const total = finalPrice
  const hasAddress =
    Boolean(order.shipping_name) &&
    Boolean(order.shipping_phone) &&
    Boolean(order.shipping_address)

  return (
    <div className="checkout-shell">
      <main>
        <nav
          style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 13 }}
          aria-label="Breadcrumb"
        >
          <Link to="/dashboard">Dashboard</Link>
          <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--color-muted)' }}>/</span>
          <Link to="/orders">Đơn hàng</Link>
          <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--color-muted)' }}>/</span>
          <Link to={`/orders/${order.id}`}>#{shortId}</Link>
          <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--color-muted)' }}>/</span>
          <span aria-current="page">Thanh toán</span>
        </nav>

        <WinBanner deadline={deadline} countdown={countdown} />

        <EscrowTimeline status={order.status} />

        <section className="checkout-panel" aria-labelledby="product-heading">
          <div className="checkout-panel__title" id="product-heading">Sản phẩm</div>
          <div className="checkout-panel__sub">
            Đấu giá kết thúc lúc {dayjs(order.created_at).format('DD/MM/YYYY HH:mm')}
          </div>
          <div className="product-line">
            <OrderProductThumb className="product-line__thumb" src={imageUrl} title={title} />
            <div>
              <div className="product-line__title">{title}</div>
              <div className="product-line__meta">
                {auctionMode && (
                  <span>Chế độ: <strong>{auctionMode}</strong></span>
                )}
                {order.auction?.bid_count != null && (
                  <span> · <strong>{order.auction.bid_count}</strong> lượt đặt</span>
                )}
              </div>
            </div>
            <div className="product-line__price">
              {finalPrice.toLocaleString('vi-VN') + ' ₫'}
            </div>
          </div>
        </section>

        <section className="checkout-panel" aria-labelledby="address-heading">
          <div className="checkout-panel__title" id="address-heading">Địa chỉ giao hàng</div>
          <div className="checkout-panel__sub">
            Địa chỉ sẽ được dùng để người bán giao hàng cho bạn
          </div>
          <AddressSection order={order} onSaved={handleAddressSaved} />
        </section>

        <section
          className="checkout-panel"
          aria-labelledby="payment-heading"
          role="radiogroup"
          aria-label="Phương thức thanh toán"
        >
          <div className="checkout-panel__title" id="payment-heading">Phương thức thanh toán</div>
          <div className="checkout-panel__sub">Chọn hình thức thanh toán phù hợp</div>

          <PaymentMethodCard
            method="vnpay"
            selected={payMethod === 'vnpay'}
            label="VNPay"
            desc="Thanh toán qua cổng VNPay, hỗ trợ thẻ ATM, Visa và QR"
            iconClass="pay-card__icon--vnpay"
            iconText="VNP"
            onSelect={() => setPayMethod('vnpay')}
          />
          <PaymentMethodCard
            method="stripe"
            selected={payMethod === 'stripe'}
            disabled
            label="Stripe"
            desc="Sắp ra mắt"
            iconClass="pay-card__icon--stripe"
            iconText="STR"
            onSelect={() => setPayMethod('stripe')}
          />
          <PaymentMethodCard
            method="bank"
            selected={payMethod === 'bank'}
            disabled
            label="Chuyển khoản ngân hàng"
            desc="Sắp ra mắt"
            iconClass="pay-card__icon--bank"
            iconText="BANK"
            onSelect={() => setPayMethod('bank')}
          />
        </section>
      </main>

      <aside>
        <div className="summary-card" aria-labelledby="summary-heading">
          <div className="summary-card__title" id="summary-heading">Tóm tắt đơn hàng</div>

          <div className="summary-line">
            <span>Giá thắng</span>
            <span className="summary-line__value">
              {finalPrice.toLocaleString('vi-VN') + ' ₫'}
            </span>
          </div>
          <div className="summary-line">
            <span>Phí sàn <small>(trừ từ người bán)</small></span>
            <span className="summary-line__value">
              {platformFee.toLocaleString('vi-VN') + ' ₫'}
            </span>
          </div>
          <div className="summary-line">
            <span>Người bán nhận</span>
            <span className="summary-line__value">
              {sellerAmount.toLocaleString('vi-VN') + ' ₫'}
            </span>
          </div>
          <div className="summary-line">
            <span>Vận chuyển</span>
            <span className="summary-line__value">Miễn phí</span>
          </div>
          <div className="summary-line summary-line--total">
            <span>Tổng cộng</span>
            <span className="summary-line__value">
              {total.toLocaleString('vi-VN') + ' ₫'}
            </span>
          </div>

          <Button
            type="primary"
            size="large"
            block
            loading={paying}
            disabled={!hasAddress || countdown.isExpired}
            onClick={handlePay}
            style={{ marginTop: 18, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
          >
            {countdown.isExpired ? 'Đã hết hạn thanh toán' : 'Thanh toán ngay'}
          </Button>

          {(!hasAddress || countdown.isExpired) && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-muted)',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              {countdown.isExpired ? 'Đơn hàng không còn trong thời hạn thanh toán' : 'Nhập địa chỉ để tiếp tục'}
            </p>
          )}

          <div className="escrow-info" style={{ marginTop: 18 }}>
            <div className="escrow-info__title">Bảo vệ bởi Escrow</div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', margin: 0 }}>
              Tiền được giữ an toàn trong suốt quá trình giao hàng. Bạn có thể xác nhận đã nhận hàng;
              nếu không, hệ thống tự ghi nhận giao hàng sau 7 ngày kể từ lúc người bán gửi. Từ thời
              điểm giao hàng được ghi nhận, escrow tiếp tục giữ 30 ngày để bạn khiếu nại rồi mới giải ngân.
            </p>
            <div className="escrow-info__flow">
              <div className="escrow-info__stage escrow-info__stage--active">Bạn trả</div>
              <div className="escrow-info__stage">Escrow giữ</div>
              <div className="escrow-info__stage">Người bán nhận</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--color-muted)',
            }}
          >
            Giao dịch bảo mật
          </div>
        </div>
      </aside>
    </div>
  )
}
