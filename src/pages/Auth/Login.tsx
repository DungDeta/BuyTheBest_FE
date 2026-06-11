import { Link } from 'react-router-dom'
import { AuthPanel, type AuthMode } from './AuthPanel'
import './auth.css'

type AuthPageProps = {
  initialTab?: AuthMode
}

export function AuthPage({ initialTab = 'login' }: AuthPageProps) {
  return (
    <div className="auth-page">
      <div className="auth-top-nav">
        <Link to="/">← BuyTheBest</Link>
        <span className="spacer" />
        <a href="#">Trợ giúp</a>
      </div>

      <AuthPanel initialTab={initialTab} variant="page" />

      <div className="auth-footer">
        <span>© 2026 BuyTheBest · Đồ án tốt nghiệp</span>
        <div>
          <a href="#">Điều khoản</a>
          <a href="#">Bảo mật</a>
          <a href="#">Cookies</a>
        </div>
      </div>
    </div>
  )
}

export function Component() {
  return <AuthPage initialTab="login" />
}
