import { Link } from 'react-router-dom'
import './error-pages.css'

export function Component() {
  return (
    <div className="error-page">
      <div className="error-page__code">500</div>
      <div className="error-page__divider" />
      <h1 className="error-page__title">Đã xảy ra lỗi hệ thống</h1>
      <p className="error-page__desc">
        Vui lòng thử lại sau hoặc liên hệ hỗ trợ nếu sự cố tiếp tục xảy ra.
      </p>
      <div className="error-page__actions">
        <button
          type="button"
          className="error-page__btn-primary"
          onClick={() => window.location.reload()}
        >
          Thử lại
        </button>
        <Link to="/" className="error-page__btn-secondary">
          Quay về trang chủ
        </Link>
      </div>
    </div>
  )
}
