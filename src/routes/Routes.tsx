import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from './Guards'
import PublicLayout from '@/layout/PublicLayout'
import DashboardLayout from '@/layout/DashboardLayout'
import AdminLayout from '@/layout/AdminLayout'

import Home from '@/pages/Public/Home'
import NotFound from '@/pages/Public/NotFound'

const routeHydrateFallback = <div aria-hidden="true" />

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    hydrateFallbackElement: routeHydrateFallback,
    children: [
      { path: '/', element: <Home /> },
      { path: '/auctions', lazy: () => import('@/pages/Public/AuctionList') },
      { path: '/auctions/ending-soon', lazy: () => import('@/pages/Public/AuctionList') },
      { path: '/auctions/hot', lazy: () => import('@/pages/Public/AuctionList') },
      { path: '/auctions/:id', lazy: () => import('@/pages/Public/AuctionDetail') },
      { path: '/categories/:slug', lazy: () => import('@/pages/Public/AuctionList') },
      { path: '/sellers/:id', lazy: () => import('@/pages/Public/SellerProfile') },
    ],
  },
  {
    element: <PublicLayout />,
    hydrateFallbackElement: routeHydrateFallback,
    children: [
      { path: '/payment/callback', lazy: () => import('@/pages/Dashboard/PaymentCallback') },
      { path: '/oauth/callback', lazy: () => import('@/pages/Auth/OAuthCallback') },
    ],
  },
  {
    element: <PublicRoute />,
    hydrateFallbackElement: routeHydrateFallback,
    children: [
      { path: '/login', lazy: () => import('@/pages/Auth/Login') },
      { path: '/register', lazy: () => import('@/pages/Auth/Register') },
      { path: '/verify-email', lazy: () => import('@/pages/Auth/VerifyEmail') },
      { path: '/forgot-password', lazy: () => import('@/pages/Auth/ForgotPassword') },
      { path: '/reset-password', lazy: () => import('@/pages/Auth/ResetPassword') },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['buyer', 'seller']} />,
    hydrateFallbackElement: routeHydrateFallback,
    children: [
      {
        element: <DashboardLayout />,
        hydrateFallbackElement: routeHydrateFallback,
        children: [
          { path: '/dashboard', lazy: () => import('@/pages/Dashboard/Overview') },
          { path: '/watchlist', lazy: () => import('@/pages/Dashboard/Watchlist') },
          { path: '/my-auctions', lazy: () => import('@/pages/Dashboard/MyAuctions') },
          { path: '/notifications', lazy: () => import('@/pages/Dashboard/Notifications') },
          { path: '/account/notifications', lazy: () => import('@/pages/Dashboard/Notifications') },
          { path: '/profile', lazy: () => import('@/pages/Dashboard/Profile') },
          { path: '/account/profile', lazy: () => import('@/pages/Dashboard/Profile') },
          { path: '/chat', lazy: () => import('@/pages/Dashboard/Chat') },
          { path: '/orders', lazy: () => import('@/pages/Dashboard/Orders') },
          { path: '/orders/:id', lazy: () => import('@/pages/Dashboard/OrderDetail') },
          { path: '/orders/:id/checkout', lazy: () => import('@/pages/Dashboard/Checkout') },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['seller']} />,
    hydrateFallbackElement: routeHydrateFallback,
    children: [
      {
        element: <DashboardLayout />,
        hydrateFallbackElement: routeHydrateFallback,
        children: [
          { path: '/seller/products', lazy: () => import('@/pages/Seller/MyProducts') },
          { path: '/seller/products/new', lazy: () => import('@/pages/Seller/CreateProduct') },
          { path: '/seller/auctions/new', lazy: () => import('@/pages/Seller/CreateAuction') },
          { path: '/seller/auctions/:id', lazy: () => import('@/pages/Seller/AuctionDetail') },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    hydrateFallbackElement: routeHydrateFallback,
    children: [
      {
        element: <AdminLayout />,
        hydrateFallbackElement: routeHydrateFallback,
        children: [
          { path: '/admin', lazy: () => import('@/pages/Admin/Dashboard') },
          { path: '/admin/products', lazy: () => import('@/pages/Admin/Products') },
          { path: '/admin/users', lazy: () => import('@/pages/Admin/Users') },
          { path: '/admin/categories', lazy: () => import('@/pages/Admin/Categories') },
          { path: '/admin/banners', lazy: () => import('@/pages/Admin/Banners') },
          { path: '/admin/disputes', lazy: () => import('@/pages/Admin/Disputes') },
        ],
      },
    ],
  },
  { path: '403', lazy: () => import('@/pages/Public/Forbidden') },
  { path: '500', lazy: () => import('@/pages/Public/ServerError') },
  { path: '*', element: <NotFound /> },
])
