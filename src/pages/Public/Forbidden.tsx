import { Link } from 'react-router-dom'
import './error-pages.css'

export function Component() {
  return (
    <div className="error-page">
      <div className="error-page__code">403</div>
      <div className="error-page__divider" />
      <h1 className="error-page__title">Bạn không có quyền truy cập trang này</h1>
      <p className="error-page__desc">
        Tài khoản của bạn không có quyền xem nội dung này.
        Vui lòng đăng nhập bằng tài khoản phù hợp.
      </p>
      <div className="error-page__actions">
        <Link to="/" className="error-page__btn-primary">
          Quay về trang chủ
        </Link>
      </div>
    </div>
  )
}
