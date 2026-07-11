import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-grid">
        <div className="footer-col">
          <div className="footer-brand">
            Buy<em>The</em>Best
          </div>
          <p>Sàn đấu giá trực tuyến thời gian thực với bốn hình thức đấu giá và lịch sử giao dịch minh bạch.</p>
        </div>
        <div className="footer-col">
          <h5>Khám phá</h5>
          <ul>
            <li><Link to="/auctions">Tất cả phiên</Link></li>
            <li><Link to="/products">Sản phẩm đã duyệt</Link></li>
            <li><Link to="/auctions?mode=english">Đấu giá tăng dần</Link></li>
            <li><Link to="/auctions?mode=dutch">Đấu giá giảm dần</Link></li>
            <li><Link to="/auctions?mode=sealed">Đấu giá kín</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <h5>Hỗ trợ</h5>
          <ul>
            <li><Link to="#">Hướng dẫn mua</Link></li>
            <li><Link to="#">Hướng dẫn bán</Link></li>
            <li><Link to="#">Điều khoản</Link></li>
            <li><Link to="#">Bảo mật</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 BuyTheBest</span>
      </div>
    </footer>
  )
}
