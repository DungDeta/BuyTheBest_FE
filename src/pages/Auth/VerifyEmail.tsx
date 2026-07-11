import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Form, Input, Spin, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, MailOutlined } from '@ant-design/icons'
import { publicGet, publicPost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import './auth.css'

type VerifyState = 'pending' | 'loading' | 'success' | 'error'

interface VerifyLocationState {
  email?: string
}

export function Component() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const pendingEmail = (location.state as VerifyLocationState | null)?.email?.trim() ?? ''

  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'pending')
  const [errorMsg, setErrorMsg] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setState('pending')
      setErrorMsg('')
      return () => {
        cancelled = true
      }
    }

    setState('loading')
    setErrorMsg('')
    setShowResend(false)
    publicGet('/auth/verify-email', { token })
      .then(() => {
        if (!cancelled) setState('success')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const e = err as ErrorResponse
        setState('error')
        setErrorMsg(e.error ?? 'Xác thực thất bại.')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const handleResend = async (values: { email: string }) => {
    setResendLoading(true)
    try {
      await publicPost('/auth/resend-verification', { email: values.email })
      message.success('Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư.')
      setShowResend(false)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e.error ?? 'Có lỗi xảy ra, thử lại sau.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="auth-centered-page">
      <div className="auth-centered-card">
        <div className="auth-centered-logo">
          Buy<span>The</span>Best
        </div>

        {state === 'pending' && (
          <div style={{ textAlign: 'center' }}>
            <MailOutlined
              style={{ fontSize: 48, color: 'var(--accent)', marginBottom: 16 }}
            />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Kiểm tra email của bạn
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
              Chúng tôi đã gửi đường dẫn xác thực
              {pendingEmail ? <> tới <strong>{pendingEmail}</strong></> : ' tới email bạn đã đăng ký'}.
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 24 }}>
              Mở email và bấm vào đường dẫn để kích hoạt tài khoản. Hãy kiểm tra cả thư mục spam.
            </p>

            {!showResend ? (
              <Button
                className="auth-submit-btn"
                loading={resendLoading}
                onClick={() => pendingEmail
                  ? void handleResend({ email: pendingEmail })
                  : setShowResend(true)}
              >
                Gửi lại email xác thực
              </Button>
            ) : (
              <Form
                layout="vertical"
                onFinish={handleResend}
                requiredMark={false}
                initialValues={{ email: pendingEmail }}
              >
                <Form.Item
                  name="email"
                  label="Email của bạn"
                  rules={[
                    { required: true, message: 'Vui lòng nhập email' },
                    { type: 'email', message: 'Email không hợp lệ' },
                  ]}
                >
                  <Input placeholder="you@example.com" />
                </Form.Item>
                <Button
                  htmlType="submit"
                  loading={resendLoading}
                  className="auth-submit-btn"
                >
                  Gửi lại
                </Button>
              </Form>
            )}
            <Button type="link" onClick={() => navigate('/login')} style={{ marginTop: 12 }}>
              Quay lại đăng nhập
            </Button>
          </div>
        )}

        {state === 'loading' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-muted)' }}>
              Đang xác thực email...
            </p>
          </div>
        )}

        {state === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircleOutlined
              style={{ fontSize: 48, color: '#22c55e', marginBottom: 16 }}
            />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Xác thực thành công!
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>
              Email đã được xác thực thành công. Bạn có thể đăng nhập ngay.
            </p>
            <Button
              className="auth-submit-btn"
              onClick={() => navigate('/login')}
            >
              Đăng nhập
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <CloseCircleOutlined
              style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }}
            />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Xác thực thất bại
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>
              {errorMsg}
            </p>

            {!showResend ? (
              <Button
                className="auth-submit-btn"
                onClick={() => setShowResend(true)}
              >
                Gửi lại email xác thực
              </Button>
            ) : (
              <Form layout="vertical" onFinish={handleResend} requiredMark={false}>
                <Form.Item
                  name="email"
                  label="Email của bạn"
                  rules={[
                    { required: true, message: 'Vui lòng nhập email' },
                    { type: 'email', message: 'Email không hợp lệ' },
                  ]}
                >
                  <Input placeholder="you@example.com" />
                </Form.Item>
                <Button
                  htmlType="submit"
                  loading={resendLoading}
                  className="auth-submit-btn"
                >
                  Gửi lại
                </Button>
              </Form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
