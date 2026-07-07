import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Spin, App } from 'antd'
import { publicPost } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { LoginResponse } from '@/types/user'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './auth.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

export type AuthMode = 'login' | 'register'

type AuthPanelProps = {
  initialTab?: AuthMode
  variant?: 'page' | 'modal'
  onSuccess?: () => void
}

function getStrengthWidth(pw: string): { width: string; color: string } {
  if (!pw) return { width: '0%', color: 'var(--border)' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const widths = ['0%', '25%', '50%', '75%', '100%'] as const
  const colors = ['#ef4444', '#ef4444', '#f59e0b', '#22c55e', '#22c55e'] as const
  return { width: widths[score] ?? '0%', color: colors[score] ?? '#ef4444' }
}

export function AuthPanel({ initialTab = 'login', variant = 'page', onSuccess }: AuthPanelProps) {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { message } = App.useApp()

  const [activeTab, setActiveTab] = useState<AuthMode>(initialTab)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useDocumentTitle(variant === 'page' ? (activeTab === 'login' ? 'Đăng nhập' : 'Đăng ký') : '')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({})

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regTerms, setRegTerms] = useState(false)
  const [regErrors, setRegErrors] = useState<{ name?: string; email?: string; password?: string; terms?: string }>({})

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const handleLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errors: typeof loginErrors = {}
    if (!loginEmail) errors.email = 'Vui lòng nhập email'
    if (!loginPassword) errors.password = 'Vui lòng nhập mật khẩu'
    if (Object.keys(errors).length) { setLoginErrors(errors); return }
    setLoginErrors({})
    setLoading(true)
    try {
      const res = await publicPost<LoginResponse>('/auth/login', { email: loginEmail, password: loginPassword })
      if (res.data) {
        login(res.data)
        onSuccess?.()
        navigate('/dashboard')
      }
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e.error || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }, [loginEmail, loginPassword, login, navigate, message, onSuccess])

  const handleRegister = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errors: typeof regErrors = {}
    if (!regName) errors.name = 'Vui lòng nhập tên'
    if (!regEmail) errors.email = 'Vui lòng nhập email'
    if (!regPassword || regPassword.length < 8) errors.password = 'Tối thiểu 8 ký tự, có chữ và số'
    else if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) errors.password = 'Phải có cả chữ và số'
    if (!regTerms) errors.terms = 'Vui lòng đồng ý điều khoản'
    if (Object.keys(errors).length) { setRegErrors(errors); return }
    setRegErrors({})
    setLoading(true)
    try {
      await publicPost('/auth/register', { display_name: regName, email: regEmail, password: regPassword })
      message.success('Đã gửi email xác thực. Vui lòng kiểm tra email.')
      onSuccess?.()
      navigate('/')
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e.error || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }, [regName, regEmail, regPassword, regTerms, navigate, message, onSuccess])

  const handleForgot = useCallback(async () => {
    if (!forgotEmail) { message.warning('Vui lòng nhập email'); return }
    setForgotLoading(true)
    try {
      await publicPost('/auth/forgot-password', { email: forgotEmail })
      message.success('Đã gửi link đặt lại mật khẩu. Kiểm tra email.')
      setForgotOpen(false)
      setForgotEmail('')
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e.error || 'Có lỗi xảy ra')
    } finally {
      setForgotLoading(false)
    }
  }, [forgotEmail, message])

  const handleGoogleOAuth = () => {
    window.location.href = `${API_BASE}/auth/oauth/google`
  }

  const strength = getStrengthWidth(regPassword)

  return (
    <>
      <div className={`auth-shell ${variant === 'modal' ? 'auth-shell--modal' : ''}`}>
        <div className="auth-side">
          <div>
            <span className="auth-side-logo">Buy<em>The</em>Best</span>
            <h1>Đấu giá<br /><em>thời gian thực.</em></h1>
            <p className="auth-side-desc">
              30 giây để có tài khoản. Không cần thẻ. Có thể đặt giá phiên đầu tiên trong vòng 1 phút sau khi xác thực email.
            </p>
          </div>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Đăng nhập
            </button>
            <button
              className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Đăng ký
            </button>
          </div>

          {activeTab === 'login' && (
            <Spin spinning={loading}>
              <div className="oauth-row">
                <button className="oauth-btn" onClick={handleGoogleOAuth} type="button">
                  <span className="ico" style={{ color: 'var(--accent)' }}>G</span>
                  Đăng nhập bằng Google
                </button>
              </div>
              <div className="auth-divider">hoặc bằng email</div>

              <form onSubmit={handleLogin}>
                <div className="auth-form-group">
                  <label>Email <span className="req">*</span></label>
                  <input
                    type="email"
                    className="auth-form-input"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                  {loginErrors.email && <div className="auth-form-error">{loginErrors.email}</div>}
                </div>
                <div className="auth-form-group">
                  <div className="auth-label-row">
                    <label style={{ marginBottom: 0 }}>Mật khẩu <span className="req">*</span></label>
                    <button type="button" className="forgot-link" onClick={() => setForgotOpen(true)}>
                      Quên mật khẩu?
                    </button>
                  </div>
                  <input
                    type="password"
                    className="auth-form-input"
                    placeholder="Nhập mật khẩu"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  {loginErrors.password && <div className="auth-form-error">{loginErrors.password}</div>}
                </div>
                <button type="submit" className="auth-submit-btn">Đăng nhập</button>
              </form>
            </Spin>
          )}

          {activeTab === 'register' && (
            <Spin spinning={loading}>
              <div className="oauth-row">
                <button className="oauth-btn" onClick={handleGoogleOAuth} type="button">
                  <span className="ico" style={{ color: 'var(--accent)' }}>G</span>
                  Đăng ký bằng Google
                </button>
              </div>
              <div className="auth-divider">hoặc bằng email</div>

              <form onSubmit={handleRegister}>
                <div className="auth-form-group">
                  <label>Họ tên <span className="req">*</span></label>
                  <input
                    type="text"
                    className="auth-form-input"
                    placeholder="Nguyễn Văn A"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                  {regErrors.name && <div className="auth-form-error">{regErrors.name}</div>}
                </div>
                <div className="auth-form-group">
                  <label>Email <span className="req">*</span></label>
                  <input
                    type="email"
                    className="auth-form-input"
                    placeholder="you@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                  {regErrors.email && <div className="auth-form-error">{regErrors.email}</div>}
                </div>
                <div className="auth-form-group">
                  <label>Mật khẩu <span className="req">*</span> <span className="hint">tối thiểu 8 ký tự, có chữ và số</span></label>
                  <input
                    type="password"
                    className="auth-form-input"
                    placeholder="Tối thiểu 8 ký tự"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <div className="strength-bar">
                    <div style={{ width: strength.width, background: strength.color }} />
                  </div>
                  {regErrors.password && <div className="auth-form-error">{regErrors.password}</div>}
                </div>
                <label className="auth-checkbox">
                  <input type="checkbox" checked={regTerms} onChange={(e) => setRegTerms(e.target.checked)} />
                  <span>Tôi đồng ý <a href="/terms">Điều khoản dịch vụ</a> và <a href="/privacy">Chính sách bảo mật</a></span>
                </label>
                {regErrors.terms && <div className="auth-form-error" style={{ marginTop: -8, marginBottom: 12 }}>{regErrors.terms}</div>}
                <button type="submit" className="auth-submit-btn">Tạo tài khoản</button>
              </form>
            </Spin>
          )}
        </div>
      </div>

      <Modal
        open={forgotOpen}
        onCancel={() => setForgotOpen(false)}
        footer={null}
        title="Quên mật khẩu"
        width={400}
      >
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Nhập email đã đăng ký. Chúng tôi sẽ gửi link đặt lại mật khẩu.
        </p>
        <div className="auth-form-group">
          <label>Email</label>
          <input
            type="email"
            className="auth-form-input"
            placeholder="you@example.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
          />
        </div>
        <button
          className="auth-submit-btn"
          onClick={handleForgot}
          disabled={forgotLoading}
          style={{ marginTop: 8 }}
        >
          {forgotLoading ? 'Đang gửi...' : 'Gửi link đặt lại'}
        </button>
      </Modal>
    </>
  )
}
