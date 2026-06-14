import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Spin } from 'antd'
import dayjs from 'dayjs'
import { privateGet } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useCountdown } from '@/hooks/useCountdown'
import type { Order } from '@/types/order'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './dashboard.css'

interface WatchlistItem {
  auction_id: string
  title: string
  current_price: number
  bid_count: number
  end_time: string
  status: string
  thumbnail_url?: string | null
  added_at: string
}

interface WatchlistResponse {
  items: WatchlistItem[]
  total: number
  page: number
  limit: number
}

interface OrdersResponse {
  orders: Order[]
  total: number
}

interface UnreadCountResponse {
  count: number
}

interface DashboardData {
  orderCount: number
  watchlistCount: number
  notifCount: number
  endingSoon: WatchlistItem[]
  recentOrders: Order[]
}

function CountdownDisplay({ endTime }: { endTime: string }) {
  const cd = useCountdown(endTime)

  if (cd.isExpired) {
    return <span className="overview-mini-card__countdown">Đã kết thúc</span>
  }

  const parts: string[] = []
  if (cd.hours > 0) parts.push(`${cd.hours}g`)
  parts.push(`${String(cd.minutes).padStart(2, '0')}p`)
  parts.push(`${String(cd.seconds).padStart(2, '0')}s`)

  const cls = cd.isUrgent
    ? 'overview-mini-card__countdown overview-mini-card__countdown--urgent'
    : cd.isWarning
      ? 'overview-mini-card__countdown overview-mini-card__countdown--warning'
      : 'overview-mini-card__countdown'

  return <span className={cls}>{parts.join(' ')}</span>
}

function EndingSoonCard({ item }: { item: WatchlistItem }) {
  return (
    <Link to={`/auctions/${item.auction_id}`} className="overview-mini-card">
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.title}
          className="overview-mini-card__thumb"
        />
      ) : (
        <div className="overview-mini-card__thumb--placeholder" aria-hidden="true">
          IMG
        </div>
      )}
      <span className="overview-mini-card__title">{item.title}</span>
      <span className="overview-mini-card__price">
        {item.current_price.toLocaleString('vi-VN')} ₫
      </span>
      <CountdownDisplay endTime={item.end_time} />
    </Link>
  )
}

function RecentOrderItem({ order }: { order: Order }) {
  const imageUrl =
    order.auction?.product?.images?.find((img) => img.is_primary)?.thumbnail_url ??
    order.auction?.product?.images?.[0]?.thumbnail_url ??
    null
  const title =
    order.auction?.product?.title ??
    order.auction?.product_title ??
    `Đơn hàng #${order.id}`

  return (
    <Link to="/orders" className="overview-order-item">
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="overview-order-item__thumb" />
      ) : (
        <div className="overview-order-item__thumb--placeholder" aria-hidden="true">
          IMG
        </div>
      )}
      <div className="overview-order-item__info">
        <div className="overview-order-item__title">{title}</div>
        <div className="overview-order-item__meta">
          {dayjs(order.created_at).format('DD/MM/YYYY HH:mm')}
        </div>
      </div>
      <span className="overview-order-item__price">
        {order.final_price.toLocaleString('vi-VN')} ₫
      </span>
    </Link>
  )
}

export function Component() {
  useDocumentTitle('Dashboard')
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState({
    orderCount: 0,
    watchlistCount: 0,
    notifCount: 0,
    endingSoon: [],
    recentOrders: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchDashboard() {
      setLoading(true)
      try {
        const [ordersRes, watchlistRes, notifRes] = await Promise.allSettled([
          privateGet<OrdersResponse>('/orders', { role: 'buyer', limit: 5 }),
          privateGet<WatchlistResponse>('/watchlist', {
            limit: 4,
            sort: 'ending_soon',
          }),
          privateGet<UnreadCountResponse>('/notifications/unread-count'),
        ])

        if (cancelled) return

        const orders =
          ordersRes.status === 'fulfilled' ? (ordersRes.value.data?.orders ?? []) : []
        const orderTotal =
          ordersRes.status === 'fulfilled' ? (ordersRes.value.data?.total ?? 0) : 0

        const watchItems =
          watchlistRes.status === 'fulfilled'
            ? (watchlistRes.value.data?.items ?? [])
            : []
        const watchTotal =
          watchlistRes.status === 'fulfilled'
            ? (watchlistRes.value.data?.total ?? 0)
            : 0

        const notifCount =
          notifRes.status === 'fulfilled' ? (notifRes.value.data?.count ?? 0) : 0

        setData({
          orderCount: orderTotal,
          watchlistCount: watchTotal,
          notifCount,
          endingSoon: watchItems,
          recentOrders: orders,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = user?.display_name ?? 'bạn'

  const stats = [
    { icon: 'ORD', value: data.orderCount, label: 'Đơn hàng', to: '/orders' },
    {
      icon: 'WCH',
      value: data.watchlistCount,
      label: 'Theo dõi',
      to: '/watchlist',
    },
    {
      icon: 'NOT',
      value: data.notifCount,
      label: 'Thông báo',
      to: '/notifications',
    },
    { icon: 'REV', value: 0, label: 'Đánh giá', to: '/orders' },
  ]

  if (loading) {
    return (
      <div
        className="dashboard-overview"
        style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}
        aria-label="Đang tải"
      >
        <Spin size="large" />
      </div>
    )
  }

  return (
    <main className="dashboard-overview">
      <section className="dashboard-welcome" aria-label="Lời chào">
        <h1 className="dashboard-welcome__title">Xin chào, {displayName}!</h1>
        <p className="dashboard-welcome__sub">
          Hôm nay là {dayjs().format('DD/MM/YYYY')} — chúc bạn đấu giá vui vẻ.
        </p>
      </section>

      <div className="stats-row" role="list" aria-label="Thống kê tổng quan">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="stat-card"
            style={{ textDecoration: 'none', color: 'inherit' }}
            role="listitem"
          >
            <span className="stat-card__icon" aria-hidden="true">
              {s.icon}
            </span>
            <span className="stat-card__value">{s.value}</span>
            <span className="stat-card__label">{s.label}</span>
          </Link>
        ))}
      </div>

      <section className="dashboard-section" aria-labelledby="ending-soon-heading">
        <div className="section-header">
          <h2 className="section-header__title" id="ending-soon-heading">
            Phiên sắp kết thúc
          </h2>
          <Link to="/watchlist" className="section-header__link">
            Xem tất cả →
          </Link>
        </div>

        {data.endingSoon.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
            Chưa có phiên nào đang theo dõi.{' '}
            <Link to="/auctions">Khám phá ngay →</Link>
          </p>
        ) : (
          <div className="overview-grid" role="list" aria-label="Phiên sắp kết thúc">
            {data.endingSoon.map((item) => (
              <div key={item.auction_id} role="listitem">
                <EndingSoonCard item={item} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="recent-orders-heading">
        <div className="section-header">
          <h2 className="section-header__title" id="recent-orders-heading">
            Đơn hàng gần đây
          </h2>
          <Link to="/orders" className="section-header__link">
            Xem tất cả →
          </Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
            Chưa có đơn hàng nào.
          </p>
        ) : (
          <div
            className="overview-order-list"
            role="list"
            aria-label="Đơn hàng gần đây"
          >
            {data.recentOrders.map((order) => (
              <div key={order.id} role="listitem">
                <RecentOrderItem order={order} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
