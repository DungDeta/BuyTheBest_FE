import { Outlet } from 'react-router-dom'
import AdminSidebar from '@/components/layout/AdminSidebar'

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}
