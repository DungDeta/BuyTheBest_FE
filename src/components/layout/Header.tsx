import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { BellOutlined, UserOutlined } from '@ant-design/icons'
import { Badge, Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'

export default function Header() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const isLoggedIn = !!accessToken && !!user && !!expiresAt && Date.now() < expiresAt

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: <Link to="/profile">Hồ sơ</Link> },
    { key: 'orders', label: <Link to="/orders">Đơn hàng</Link> },
    { type: 'divider' },
    { key: 'logout', label: 'Đăng xuất', onClick: handleLogout },
  ]

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="logo">
          Buy<em>The</em>Best
        </Link>
        <nav className="header-nav">
          <Link to="/auctions">Khám phá</Link>
        </nav>
      </div>

      <div className="header-right">
        {isLoggedIn ? (
          <>
            <Link to="/notifications">
              <Badge count={0} size="small">
                <BellOutlined style={{ fontSize: 18 }} />
              </Badge>
            </Link>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />}>
                {user.display_name}
              </Button>
            </Dropdown>
          </>
        ) : (
          <div className="header-auth">
            <Link to="/login">Đăng nhập</Link>
            <Link to="/register">
              <Button type="primary">Đăng ký</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
