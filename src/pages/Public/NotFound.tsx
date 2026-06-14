import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './error-pages.css'

export default function NotFound() {
  useDocumentTitle('404 · Không tìm thấy')
  return (
    <div className="error-page">
      <div className="error-page__code">404</div>
      <div className="error-page__divider" />
      <h1 className="error-page__title">Trang bạn tìm không tồn tại</h1>
      <p className="error-page__desc">
        Đường dẫn này không còn hoạt động hoặc chưa bao giờ tồn tại.
      </p>
      <div className="error-page__actions">
        <Link to="/" className="error-page__btn-primary">
          Quay về trang chủ
        </Link>
        <Link to="/auctions" className="error-page__btn-secondary">
          Khám phá phiên đấu giá
        </Link>
      </div>
    </div>
  )
}
