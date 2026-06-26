import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { App, Button, Spin, Tabs } from 'antd'
import dayjs from 'dayjs'
import { privateGet } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { Order } from '@/types/order'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getOrderProductImageUrl, getOrderProductTitle } from '@/utils/orderDisplay'
import { getDemoProductImage } from '@/utils/demoProductImages'
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

interface ProductImage {
  id: number
  url: string
  thumbnail_url: string
  is_primary: boolean
  sort_order: number
}

interface ProductAuction {
  id: string
  status: string
  current_price?: number
  ends_at?: string
}

interface SellerProduct {
  id: string | number
  title: string
  slug?: string
  condition?: string
  status: string
  images?: ProductImage[]
  auction?: ProductAuction | null
  created_at: string
}

interface ProductsResponse {
  items?: SellerProduct[]
  products?: SellerProduct[]
  total: number
}

function resolveProductImage(
  title: string,
  ...candidates: Array<string | null | undefined>
): string | null {
  return (
    candidates.find((candidate): candidate is string => Boolean(candidate)) ??
    getDemoProductImage(title)
  )
}

function auctionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Đang đấu',
    scheduled: 'Chưa mở',
    ended: 'Đã kết thúc',
    cancelled: 'Đã huỷ',
    closed_bin: 'Mua ngay',
  }
  return map[status] ?? status
}

function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    shipped: 'Đang giao',
    delivered: 'Đã giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã huỷ',
    refunded: 'Đã hoàn tiền',
  }
  return map[status] ?? status
}

function productStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Bản nháp',
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    active: 'Đang bán',
  }
  return map[status] ?? status
}

function WatchingTab() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await privateGet<WatchlistResponse>('/watchlist', {
          limit: 20,
          sort: 'ending_soon',
        })
        if (!cancelled) {
          setItems(res.data?.items ?? [])
          setTotal(res.data?.total ?? 0)
        }
      } catch {
        if (!cancelled) message.error('Không thể tải danh sách theo dõi')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [message])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spin />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="my-auctions-empty" role="status">
        <span className="my-auctions-empty__icon" aria-hidden="true">WCH</span>
        Chưa theo dõi phiên nào.{' '}
        <Link to="/auctions">Khám phá ngay →</Link>
      </div>
    )
  }

  return (
    <>
      <div
        className="my-auctions-list"
        role="list"
        aria-label="Phiên đang theo dõi"
      >
        {items.map((item) => {
          const imageUrl = resolveProductImage(item.title, item.thumbnail_url)

          return (
            <button
              key={item.auction_id}
              className="my-auctions-item"
              onClick={() => navigate(`/auctions/${item.auction_id}`)}
              type="button"
              role="listitem"
              aria-label={item.title}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={item.title}
                  className="my-auctions-item__thumb"
                />
              ) : (
                <div className="my-auctions-item__thumb--placeholder" aria-hidden="true">
                  IMG
                </div>
              )}
              <div className="my-auctions-item__info">
                <div className="my-auctions-item__title">{item.title}</div>
                <div className="my-auctions-item__meta">
                  {auctionStatusLabel(item.status)} · {item.bid_count} lượt đặt
                </div>
              </div>
              <div className="my-auctions-item__right">
                <span className="my-auctions-item__price">
                  {item.current_price.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {total > 20 && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/watchlist">Xem tất cả {total} phiên →</Link>
        </div>
      )}
    </>
  )
}

function BoughtTab() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await privateGet<OrdersResponse>('/orders', {
          role: 'buyer',
          limit: 20,
        })
        if (!cancelled) {
          setOrders(res.data?.orders ?? [])
          setTotal(res.data?.total ?? 0)
        }
      } catch {
        if (!cancelled) message.error('Không thể tải đơn hàng')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [message])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spin />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="my-auctions-empty" role="status">
        <span className="my-auctions-empty__icon" aria-hidden="true">ORD</span>
        Chưa có đơn hàng nào.
      </div>
    )
  }

  return (
    <>
      <div className="my-auctions-list" role="list" aria-label="Đơn hàng đã mua">
        {orders.map((order) => {
          const title = getOrderProductTitle(order)
          const imageUrl =
            getOrderProductImageUrl(order) || getDemoProductImage(title)

          return (
            <button
              key={order.id}
              className="my-auctions-item"
              onClick={() => navigate('/orders')}
              type="button"
              role="listitem"
              aria-label={title}
            >
              {imageUrl ? (
                <img src={imageUrl} alt={title} className="my-auctions-item__thumb" />
              ) : (
                <div
                  className="my-auctions-item__thumb--placeholder"
                  aria-hidden="true"
                >
                  IMG
                </div>
              )}
              <div className="my-auctions-item__info">
                <div className="my-auctions-item__title">{title}</div>
                <div className="my-auctions-item__meta">
                  {orderStatusLabel(order.status)} ·{' '}
                  {dayjs(order.created_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
              <div className="my-auctions-item__right">
                <span className="my-auctions-item__price">
                  {order.final_price.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {total > 20 && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/orders">Xem tất cả {total} đơn →</Link>
        </div>
      )}
    </>
  )
}

function CreatedTab() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await privateGet<ProductsResponse>('/me/products', { limit: 20 })
        if (!cancelled) {
          setProducts(res.data?.items ?? res.data?.products ?? [])
        }
      } catch {
        if (!cancelled) message.error('Không thể tải sản phẩm')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [message])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spin />
      </div>
    )
  }

  return (
    <>
      <div className="seller-tab-header">
        <span
          style={{
            fontSize: '0.85rem',
            color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          }}
        >
          {products.length} sản phẩm
        </span>
        <Button
          type="primary"
          size="small"
          onClick={() => navigate('/seller/auctions/new')}
        >
          Tạo phiên mới
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="my-auctions-empty" role="status">
          <span className="my-auctions-empty__icon" aria-hidden="true">PRD</span>
          Chưa có sản phẩm nào.
        </div>
      ) : (
        <div className="my-auctions-list" role="list" aria-label="Sản phẩm đã tạo">
          {products.map((product) => {
            const imageUrl =
              resolveProductImage(
                product.title,
                product.images?.find((img) => img.is_primary)?.thumbnail_url,
                product.images?.find((img) => img.is_primary)?.url,
                product.images?.[0]?.thumbnail_url,
                product.images?.[0]?.url,
              )

            const auctionInfo = product.auction
              ? `${auctionStatusLabel(product.auction.status)}${product.auction.current_price ? ' · ' + product.auction.current_price.toLocaleString('vi-VN') + ' ₫' : ''}`
              : 'Chưa có phiên'

            return (
              <button
                key={String(product.id)}
                className="my-auctions-item"
                onClick={() => navigate('/seller/auctions/new')}
                type="button"
                role="listitem"
                aria-label={product.title}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.title}
                    className="my-auctions-item__thumb"
                  />
                ) : (
                  <div
                    className="my-auctions-item__thumb--placeholder"
                    aria-hidden="true"
                  >
                    IMG
                  </div>
                )}
                <div className="my-auctions-item__info">
                  <div className="my-auctions-item__title">{product.title}</div>
                  <div className="my-auctions-item__meta">
                    {productStatusLabel(product.status)} · {auctionInfo}
                  </div>
                </div>
                <div className="my-auctions-item__right">
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--color-muted)',
                      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    }}
                  >
                    {dayjs(product.created_at).format('DD/MM/YYYY')}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function Component() {
  useDocumentTitle('Phiên của tôi')
  const isSeller = useAuthStore((s) => s.isSeller)

  const tabItems = [
    {
      key: 'watching',
      label: 'Đang theo dõi',
      children: <WatchingTab />,
    },
    {
      key: 'bought',
      label: 'Đã mua',
      children: <BoughtTab />,
    },
    ...(isSeller()
      ? [
          {
            key: 'created',
            label: 'Đã tạo',
            children: <CreatedTab />,
          },
        ]
      : []),
  ]

  return (
    <div className="my-auctions-page">
      <h1 className="my-auctions-page__title">Phiên của tôi</h1>
      <Tabs items={tabItems} defaultActiveKey="watching" />
    </div>
  )
}
