import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { BellOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { Badge, Button, Dropdown, Modal } from 'antd'
import type { MenuProps } from 'antd'
import { AuthPanel, type AuthMode } from '@/pages/Auth/AuthPanel'
import { useNotifications } from '@/hooks/useNotifications'
import { privateGet, privatePost } from '@/api/api'
import type { SearchHistoryItem, SearchHistoryResponse } from '@/types/searchHistory'

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
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const isLoggedIn = !!accessToken && !!user && !!expiresAt && Date.now() < expiresAt

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const loadSearchHistory = useCallback(async () => {
    if (!isLoggedIn) return
    try {
      const res = await privateGet<SearchHistoryResponse>('/me/search-history')
      setSearchHistory(res.data?.items?.slice(0, 20) ?? [])
    } catch {
      setSearchHistory([])
    }
  }, [isLoggedIn])

  const recordSearchKeyword = useCallback(async (keyword: string) => {
    if (!isLoggedIn) return
    try {
      await privatePost('/me/search-history', { keyword })
    } catch {
      // Search should still proceed even if history persistence is unavailable.
    }
  }, [isLoggedIn])

  function openSearchHistory() {
    if (!isLoggedIn) return
    setHistoryOpen(true)
    void loadSearchHistory()
  }

  function closeSearchHistory(e: React.FocusEvent<HTMLFormElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setHistoryOpen(false)
  }

  function navigateToSearch(keyword: string) {
    const normalized = keyword.trim()
    if (!normalized) return
    if (searchRef.current) searchRef.current.value = normalized
    setSearchHistory((current) => [
      { keyword: normalized, searched_at: new Date().toISOString() },
      ...current.filter((item) => item.keyword !== normalized),
    ].slice(0, 20))
    setHistoryOpen(false)
    void recordSearchKeyword(normalized)
    navigate(`/auctions?q=${encodeURIComponent(normalized)}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchRef.current?.value.trim() ?? ''
    navigateToSearch(q)
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

        <form className="header-search" onSubmit={handleSearch} onBlur={closeSearchHistory}>
          <SearchOutlined className="header-search__icon" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Tìm phiên đấu giá..."
            defaultValue={searchParams.get('q') ?? ''}
            aria-label="Tìm kiếm phiên đấu giá"
            aria-autocomplete="list"
            aria-controls="header-search-history"
            aria-expanded={historyOpen && searchHistory.length > 0}
            onFocus={openSearchHistory}
          />
          {historyOpen && searchHistory.length > 0 && (
            <div
              id="header-search-history"
              className="header-search-history"
              role="listbox"
              aria-label="Lịch sử tìm kiếm gần đây"
            >
              <div className="header-search-history__heading">Tìm kiếm gần đây</div>
              <div className="header-search-history__list">
                {searchHistory.map((item) => (
                  <button
                    key={item.keyword}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="header-search-history__item"
                    onClick={() => navigateToSearch(item.keyword)}
                  >
                    <SearchOutlined />
                    <span>{item.keyword}</span>
                  </button>
                ))}
              </div>
              <Link className="header-search-history__manage" to="/search-history">
                Quản lý lịch sử tìm kiếm
              </Link>
            </div>
          )}
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
                <Button
                  type="text"
                  icon={<UserOutlined />}
                  aria-label="Mở menu tài khoản"
                  title="Tài khoản"
                >
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
