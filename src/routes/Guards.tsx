import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

interface ProtectedRouteProps {
  allowedRoles?: Array<'buyer' | 'seller' | 'admin'>
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user) {
    const hasRole = allowedRoles.some((role) => {
      if (role === 'admin') return user.is_admin
      if (role === 'seller') return user.is_seller
      return true
    })
    if (!hasRole) {
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}

export function PublicRoute() {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
