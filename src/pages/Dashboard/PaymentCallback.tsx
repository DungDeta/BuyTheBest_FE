import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Spin } from 'antd'
import { privateGet, publicGet } from '@/api/api'
import type { VnpayReturnResponse } from '@/types/order'

type PageState = 'loading' | 'confirming' | 'pending' | 'success' | 'refunded' | 'failed'
type PaymentOutcome = Extract<PageState, 'pending' | 'success' | 'refunded' | 'failed'>

const REDIRECT_DELAY_S = 5
const CONFIRMATION_ATTEMPTS = 15
const CONFIRMATION_INTERVAL_MS = 1000

interface PaymentConfirmation {
  status: 'initiated' | 'success' | 'failed' | 'refunded' | string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function orderIdFromVNPayTxnRef(txnRef: string): string {
  const value = txnRef.trim()
  const compactOrderId = value.slice(0, 32)
  if (/^[0-9a-f]{32}$/i.test(compactOrderId)) {
    return [
      compactOrderId.slice(0, 8),
      compactOrderId.slice(8, 12),
      compactOrderId.slice(12, 16),
      compactOrderId.slice(16, 20),
      compactOrderId.slice(20),
    ].join('-').toLowerCase()
  }
  return value
}

function normalizeReturnData(value: unknown): VnpayReturnResponse | null {
  const candidate = isRecord(value) && isRecord(value.data) ? value.data : value
  if (!isRecord(candidate) || typeof candidate.order_id !== 'string' || typeof candidate.success !== 'boolean') {
    return null
  }

  return {
    order_id: candidate.order_id,
    success: candidate.success,
  }
}

function normalizePayment(value: unknown): PaymentConfirmation | null {
  const candidate = isRecord(value) && isRecord(value.payment) ? value.payment : value
  if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
  return { status: candidate.status }
}

function getPaymentOutcome(payment: PaymentConfirmation): PaymentOutcome {
  switch (payment.status.toLowerCase()) {
    case 'success':
      return 'success'
    case 'refunded':
      return 'refunded'
    case 'failed':
      return 'failed'
    default:
      return 'pending'
  }
}

export function PaymentCallbackContent() {
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_S)
  const [verificationRun, setVerificationRun] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const queryString = window.location.search
    const query = new URLSearchParams(queryString)
    const rawTxnRef = query.get('vnp_TxnRef')?.trim() || null
    const queryOrderId = rawTxnRef ? orderIdFromVNPayTxnRef(rawTxnRef) : null
    const secureHash = query.get('vnp_SecureHash')?.trim()
    let cancelled = false

    setCountdown(REDIRECT_DELAY_S)
    if (!queryOrderId || !secureHash) {
      setOrderId(queryOrderId)
      setPageState('failed')
      return () => {
        cancelled = true
      }
    }

    const callbackOrderId = queryOrderId
    setOrderId(callbackOrderId)
    setPageState('confirming')

    async function pollPayment(publicOrderId: string): Promise<PaymentOutcome> {
      for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt += 1) {
        if (cancelled) return 'pending'

        try {
          const response = await privateGet<PaymentConfirmation | { payment: PaymentConfirmation }>(
            `/orders/${publicOrderId}/payment`,
          )
          const payment = normalizePayment(response.data)
          if (payment) {
            const outcome = getPaymentOutcome(payment)
            if (outcome !== 'pending') return outcome
          }
        } catch {
          // The callback may outlive the login session; the signed return is still handled below.
        }

        if (attempt < CONFIRMATION_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_INTERVAL_MS))
        }
      }

      return 'pending'
    }

    async function verify() {
      try {
        const res = await publicGet<VnpayReturnResponse>(
          `/payments/vnpay/return${queryString}`,
        )
        const data = normalizeReturnData(res.data)
        if (!data || data.order_id !== callbackOrderId) {
          if (!cancelled) setPageState('failed')
          return
        }

        setOrderId(data.order_id)

        if (!data.success) {
          const outcome = await pollPayment(data.order_id)
          if (cancelled) return
          setPageState(outcome === 'pending' ? 'failed' : outcome)
          return
        }

        const outcome = await pollPayment(data.order_id)
        if (!cancelled) setPageState(outcome)
      } catch {
        // If return verification is temporarily unavailable, the authenticated payment
        // endpoint remains authoritative and lets a reloaded callback recover.
        const outcome = await pollPayment(callbackOrderId)
        if (!cancelled) {
          setPageState(outcome)
        }
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [verificationRun])

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

  if (pageState === 'pending') {
    return (
      <div
        className="payment-result"
        style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}
        role="status"
        aria-live="polite"
      >
        <div
          style={{
            background: '#fff8e1',
            border: '2px solid #cc6d00',
            borderRadius: 3,
            padding: '32px 28px',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 700,
              color: '#9a5200',
              margin: '0 0 8px',
            }}
          >
            Giao dịch đang chờ xác nhận
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
            VNPay đã chuyển bạn về hệ thống nhưng trạng thái máy chủ chưa hoàn tất.
            Bạn có thể kiểm tra lại hoặc mở đơn hàng; giao dịch sẽ không bị thu thêm tiền.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              type="primary"
              onClick={() => setVerificationRun((current) => current + 1)}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              Kiểm tra lại
            </Button>
            {orderId && (
              <Link className="payment-result__link" to={`/orders/${orderId}`}>
                Xem đơn hàng
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'refunded') {
    return (
      <div
        style={{ maxWidth: 520, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}
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
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 700,
              color: '#0654ba',
              margin: '0 0 8px',
            }}
          >
            Giao dịch đã được hoàn tiền
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-muted)', margin: '0 0 20px' }}>
            Khoản thanh toán đã được ghi nhận trước đó và hiện ở trạng thái hoàn tiền.
          </p>
          {orderId && (
            <Link className="payment-result__link" to={`/orders/${orderId}`}>
              Xem chi tiết đơn hàng
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
