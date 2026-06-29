import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { BellOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { Badge, Button, Dropdown, Modal } from 'antd'
import type { MenuProps } from 'antd'
import { AuthPanel, type AuthMode } from '@/pages/Auth/AuthPanel'
import { useNotifications } from '@/hooks/useNotifications'

export default function Header() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const { unreadCount, isConnected } = useNotifications()
  const searchRef = useRef<HTMLInputElement>(null)

  const isLoggedIn = !!accessToken && !!user && !!expiresAt && Date.now() < expiresAt

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchRef.current?.value.trim() ?? ''
    if (!q) return
    navigate(`/auctions?q=${encodeURIComponent(q)}`)
  }

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: <Link to="/profile">Hồ sơ</Link> },
    { key: 'orders', label: <Link to="/orders">Đơn hàng</Link> },
    ...(isLoggedIn ? [{ key: 'search-history', label: <Link to="/search-history">Lịch sử tìm kiếm</Link> }] : []),
    { type: 'divider' as const },
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

        <form className="header-search" onSubmit={handleSearch}>
          <SearchOutlined className="header-search__icon" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Tìm phiên đấu giá..."
            defaultValue={searchParams.get('q') ?? ''}
            aria-label="Tìm kiếm phiên đấu giá"
          />
        </form>

        <div className="header-right">
          {isLoggedIn ? (
            <>
              <Link
                to="/notifications"
                aria-label={
                  unreadCount > 0
                    ? `${unreadCount} thông báo chưa đọc`
                    : 'Không có thông báo chưa đọc'
                }
                title={isConnected ? 'Thông báo realtime đang kết nối' : 'Thông báo'}
              >
                <Badge count={unreadCount} overflowCount={99} size="small">
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
