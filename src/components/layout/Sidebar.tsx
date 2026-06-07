import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import {
  DashboardOutlined,
  ShoppingOutlined,
  EyeOutlined,
  BellOutlined,
  MessageOutlined,
  UserOutlined,
  AppstoreAddOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'

export default function Sidebar() {
  const location = useLocation()
  const { isSeller } = useAuthStore()

  const items: MenuProps['items'] = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">Tổng quan</Link> },
    { key: '/watchlist', icon: <EyeOutlined />, label: <Link to="/watchlist">Theo dõi</Link> },
    { key: '/my-auctions', icon: <TagsOutlined />, label: <Link to="/my-auctions">Phiên của tôi</Link> },
    { key: '/orders', icon: <ShoppingOutlined />, label: <Link to="/orders">Đơn hàng</Link> },
    { key: '/chat', icon: <MessageOutlined />, label: <Link to="/chat">Tin nhắn</Link> },
    { key: '/notifications', icon: <BellOutlined />, label: <Link to="/notifications">Thông báo</Link> },
    { key: '/profile', icon: <UserOutlined />, label: <Link to="/profile">Hồ sơ</Link> },
    ...(isSeller() ? [
      { type: 'divider' as const },
      { key: '/seller/products', icon: <AppstoreAddOutlined />, label: <Link to="/seller/products">Sản phẩm</Link> },
    ] : []),
  ]

  return (
    <aside className="sidebar">
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items}
        style={{ border: 'none' }}
      />
    </aside>
  )
}
