import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { BellOutlined, UserOutlined } from '@ant-design/icons'
import { Badge, Button, Dropdown, Modal } from 'antd'
import type { MenuProps } from 'antd'
import { AuthPanel, type AuthMode } from '@/pages/Auth/AuthPanel'

export default function Header() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)

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
    <>
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
              <button type="button" className="header-auth-link" onClick={() => setAuthMode('login')}>
                Đăng nhập
              </button>
              <Button type="primary" onClick={() => setAuthMode('register')}>
                Đăng ký
              </Button>
            </div>
          )}
        </div>
      </header>

      <Modal
        open={!!authMode}
        onCancel={() => setAuthMode(null)}
        footer={null}
        width={960}
        centered
        destroyOnHidden
        className="auth-modal"
      >
        {authMode && (
          <AuthPanel
            initialTab={authMode}
            variant="modal"
            onSuccess={() => setAuthMode(null)}
          />
        )}
      </Modal>
    </>
  )
}
