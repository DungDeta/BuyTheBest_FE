import { Outlet, useLocation } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout() {
  const { pathname } = useLocation()
  const isChatPage = pathname === '/chat'

  return (
    <div className={`app-layout${isChatPage ? ' app-layout--chat' : ''}`}>
      <Header />
      <div className="dashboard-container">
        <Sidebar />
        <main className={`dashboard-content${isChatPage ? ' dashboard-content--chat' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
