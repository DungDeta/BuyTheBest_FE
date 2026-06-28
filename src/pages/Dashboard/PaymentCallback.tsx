import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Spin } from 'antd'
import { privateGet, publicGet } from '@/api/api'
import type { VnpayReturnResponse } from '@/types/order'

type PageState = 'loading' | 'confirming' | 'success' | 'failed'

interface VnpayReturnData {
  order_id: string
  success: boolean
}

const REDIRECT_DELAY_S = 5
const CONFIRMATION_ATTEMPTS = 8
const CONFIRMATION_INTERVAL_MS = 1000

interface PaymentConfirmation {
  status: 'initiated' | 'success' | 'failed' | 'refunded'
  escrow_status: string
}

export function PaymentCallbackContent() {
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_S)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const queryString = window.location.search
    let cancelled = false

    async function verify() {
      try {
        const res = await publicGet<VnpayReturnResponse>(
          `/payments/vnpay/return${queryString}`,
        )
        const data = res.data as VnpayReturnData | undefined
        if (data?.success && data.order_id) {
          if (cancelled) return
          setOrderId(data.order_id)
          setPageState('confirming')

          for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt += 1) {
            if (cancelled) return
            try {
              const payment = await privateGet<PaymentConfirmation>(
                `/orders/${data.order_id}/payment`,
              )
              if (payment.data?.status === 'success' && payment.data.escrow_status === 'held') {
                setPageState('success')
                return
              }
              if (payment.data?.status === 'failed' || payment.data?.status === 'refunded') {
                setPageState('failed')
                return
              }
            } catch {
              // The signed VNPay return remains valid even if the login session expired.
            }
            await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_INTERVAL_MS))
          }
        } else {
          if (cancelled) return
          if (data?.order_id) setOrderId(data.order_id)
          setPageState('failed')
        }
      } catch {
        if (!cancelled) setPageState('failed')
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (pageState !== 'success' || !orderId) return

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          navigate(`/orders/${orderId}`, { replace: true })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [pageState, orderId, navigate])

  if (pageState === 'loading') {
    return (
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 16 }}
        aria-label="Đang xử lý kết quả thanh toán"
      >
        <Spin size="large" />
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)', margin: 0 }}>
          Đang xác thực thanh toán…
        </p>
      </div>
    )
  }

  if (pageState === 'confirming') {
    return (
      <div
        className="payment-result"
        style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}
        role="status"
        aria-live="polite"
      >
        <div
          style={{
            background: '#e3f2fd',
            border: '2px solid #0654ba',
            borderRadius: 3,
            padding: '32px 28px',
          }}
        >
          <Spin size="large" />
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 700,
              color: '#0654ba',
              margin: '18px 0 8px',
            }}
          >
            VNPay đã ghi nhận giao dịch
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--color-muted)',
              lineHeight: 1.7,
              margin: '0 0 20px',
            }}
          >
            Hệ thống đang chờ xác nhận bảo mật từ VNPay trước khi cập nhật đơn hàng
            và giữ tiền trong escrow.
          </p>
          {orderId && (
            <Link className="payment-result__link" to={`/orders/${orderId}`}>
              Kiểm tra trạng thái đơn hàng
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div
        style={{ maxWidth: 520, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}
        role="alert"
        aria-live="polite"
      >
        <div
          style={{
            background: '#e8f5e9',
            border: '2px solid #118c4f',
            borderRadius: 3,
            padding: '32px 28px',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: '#118c4f',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 28,
              color: '#fff',
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            ✓
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 700,
              color: '#118c4f',
              margin: '0 0 8px',
            }}
          >
            Thanh toán thành công!
          </h1>
          {orderId && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--color-muted)',
                margin: '0 0 20px',
              }}
            >
              Mã đơn: {orderId.slice(0, 12).toUpperCase()}
            </p>
          )}
          <p
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-muted)', margin: '0 0 20px' }}
          >
            Đơn hàng của bạn đã được xác nhận. Người bán sẽ chuẩn bị và giao hàng sớm nhất có thể.
          </p>
          <p
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#118c4f', margin: '0 0 16px' }}
            aria-live="polite"
          >
            Tự động chuyển đến đơn hàng sau {countdown}s…
          </p>
          {orderId && (
            <Link
              to={`/orders/${orderId}`}
              replace
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: '#118c4f',
                color: '#fff',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Xem đơn hàng ngay
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ maxWidth: 520, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}
      role="alert"
      aria-live="polite"
    >
      <div
        style={{
          background: '#fbe9e7',
          border: '2px solid #c7302b',
          borderRadius: 3,
          padding: '32px 28px',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            background: '#c7302b',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 28,
            color: '#fff',
            fontWeight: 700,
          }}
          aria-hidden="true"
        >
          ✕
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
            fontWeight: 700,
            color: '#c7302b',
            margin: '0 0 8px',
          }}
        >
          Thanh toán thất bại
        </h1>
        <p
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-muted)', margin: '0 0 24px' }}
        >
          Giao dịch chưa được hoàn tất. Vui lòng quay lại đơn hàng và thử thanh toán
          lại qua VNPay.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {orderId && (
            <Link
              to={`/orders/${orderId}/checkout`}
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: '#c7302b',
                color: '#fff',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Thử lại
            </Link>
          )}
          <Link
            to="/orders"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '2px solid var(--color-border-strong)',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Xem đơn hàng
          </Link>
        </div>
      </div>
    </div>
  )
}

export function Component() {
  return <PaymentCallbackContent />
}
