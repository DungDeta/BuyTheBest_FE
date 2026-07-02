import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  UserOutlined,
  TagsOutlined,
  PictureOutlined,
  WarningOutlined,
} from '@ant-design/icons'

export default function AdminSidebar() {
  const location = useLocation()
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(max-width: 768px)').matches) return

    const frame = window.requestAnimationFrame(() => {
      const menu = sidebarRef.current?.querySelector<HTMLElement>('.ant-menu')
      const selected = sidebarRef.current?.querySelector<HTMLElement>(
        '.ant-menu-item-selected',
      )

      if (menu && selected) {
        menu.scrollLeft = Math.max(0, selected.offsetLeft - 12)
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])

  const items: MenuProps['items'] = [
    { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Dashboard</Link> },
    { key: '/admin/products', icon: <AppstoreOutlined />, label: <Link to="/admin/products">Sản phẩm</Link> },
    { key: '/admin/auctions', icon: <ThunderboltOutlined />, label: <Link to="/admin/auctions">Phiên đấu giá</Link> },
    { key: '/admin/users', icon: <UserOutlined />, label: <Link to="/admin/users">Người dùng</Link> },
    { key: '/admin/categories', icon: <TagsOutlined />, label: <Link to="/admin/categories">Danh mục</Link> },
    { key: '/admin/banners', icon: <PictureOutlined />, label: <Link to="/admin/banners">Banner</Link> },
    { key: '/admin/disputes', icon: <WarningOutlined />, label: <Link to="/admin/disputes">Tranh chấp</Link> },
  ]

  return (
    <aside ref={sidebarRef} className="admin-sidebar">
      <div className="admin-brand">
        <Link to="/admin">BTB Admin</Link>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items}
        style={{ border: 'none' }}
      />
    </aside>
  )
}
