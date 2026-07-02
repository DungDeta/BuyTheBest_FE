import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { App, Button, Segmented, Spin, Tabs } from 'antd'
import dayjs from 'dayjs'
import { privateGet } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { Auction } from '@/types/auction'
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

interface AuctionsResponse {
  items: Auction[]
  total: number
  limit: number
  offset: number
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

function auctionModeLabel(mode: Auction['mode']): string {
  const map: Record<Auction['mode'], string> = {
    english: 'Giá tăng dần',
    dutch: 'Giá giảm dần',
    sealed_bid: 'Đấu giá kín',
    reverse: 'Đấu giá ngược',
  }
  return map[mode]
}

function AuctionListFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="my-auctions-item__fact">
      <span className="my-auctions-item__fact-label">{label}</span>
      <strong className="my-auctions-item__fact-value">{value}</strong>
    </span>
  )
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
        <span className="my-auctions-empty__icon" aria-hidden="true">Theo dõi</span>
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
                  {auctionStatusLabel(item.status)}
                </div>
              </div>
              <div className="my-auctions-item__right">
                <AuctionListFact
                  label="Giá hiện tại"
                  value={`${item.current_price.toLocaleString('vi-VN')} ₫`}
                />
                <AuctionListFact label="Lượt đặt" value={item.bid_count.toLocaleString('vi-VN')} />
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
        <span className="my-auctions-empty__icon" aria-hidden="true">Đơn hàng</span>
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
                <AuctionListFact
                  label="Giá trị"
                  value={`${order.final_price.toLocaleString('vi-VN')} ₫`}
                />
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
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [total, setTotal] = useState(0)
  const [group, setGroup] = useState<'scheduled' | 'active' | 'finished'>('scheduled')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await privateGet<AuctionsResponse>('/me/auctions', {
          limit: 100,
          offset: 0,
          sort: 'newest',
        })
        if (!cancelled) {
          const items = res.data?.items ?? []
          setAuctions(items)
          setTotal(res.data?.total ?? items.length)
          if (!items.some((auction) => auction.status === 'scheduled')) {
            setGroup(items.some((auction) => auction.status === 'active') ? 'active' : 'finished')
          }
        }
      } catch {
        if (!cancelled) message.error('Không thể tải danh sách phiên đấu giá')
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

  const scheduled = auctions.filter((auction) => auction.status === 'scheduled')
  const active = auctions.filter((auction) => auction.status === 'active')
  const finished = auctions.filter((auction) =>
    ['ended', 'closed_bin', 'cancelled'].includes(auction.status),
  )
  const groupedAuctions = {
    scheduled,
    active,
    finished,
  }[group]

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
          {total} phiên đấu giá
        </span>
        <Button
          type="primary"
          size="small"
          onClick={() => navigate('/seller/auctions/new')}
        >
          Tạo phiên mới
        </Button>
      </div>

      {auctions.length === 0 ? (
        <div className="my-auctions-empty" role="status">
          <span className="my-auctions-empty__icon" aria-hidden="true">Đấu giá</span>
          <p>Bạn chưa tạo phiên đấu giá nào.</p>
          <Button type="primary" onClick={() => navigate('/seller/auctions/new')}>
            Tạo phiên đấu giá đầu tiên
          </Button>
        </div>
      ) : (
        <>
          <Segmented
            block
            className="seller-auction-groups"
            value={group}
            onChange={(value) => setGroup(value as typeof group)}
            options={[
              { value: 'scheduled', label: `Đã lên lịch (${scheduled.length})` },
              { value: 'active', label: `Đang diễn ra (${active.length})` },
              { value: 'finished', label: `Đã kết thúc (${finished.length})` },
            ]}
          />

          {groupedAuctions.length === 0 ? (
            <div className="my-auctions-empty my-auctions-empty--compact" role="status">
              Không có phiên nào trong nhóm này.
            </div>
          ) : (
            <div className="my-auctions-list" role="list" aria-label="Phiên đấu giá đã tạo">
              {groupedAuctions.map((auction) => {
                const title = auction.product?.title ?? `Phiên ${auction.id.slice(0, 8)}`
                const primaryImage = auction.product?.images?.find((image) => image.is_primary)
                const imageUrl = resolveProductImage(
                  title,
                  primaryImage?.thumbnail_url,
                  primaryImage?.url,
                  auction.product?.images?.[0]?.thumbnail_url,
                  auction.product?.images?.[0]?.url,
                )
                const timeLabel =
                  auction.status === 'scheduled'
                    ? `Bắt đầu ${dayjs(auction.starts_at).format('DD/MM/YYYY HH:mm')}`
                    : auction.status === 'active'
                      ? `Kết thúc ${dayjs(auction.ends_at).format('DD/MM/YYYY HH:mm')}`
                      : auction.status === 'cancelled'
                        ? `Đã hủy ${dayjs(auction.updated_at).format('DD/MM/YYYY HH:mm')}`
                        : `Kết thúc ${dayjs(auction.ends_at).format('DD/MM/YYYY HH:mm')}`

                return (
                  <button
                    key={auction.id}
                    className="my-auctions-item"
                    onClick={() => navigate(`/seller/auctions/${auction.id}`)}
                    type="button"
                    role="listitem"
                    aria-label={title}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={title} className="my-auctions-item__thumb" />
                    ) : (
                      <div className="my-auctions-item__thumb--placeholder" aria-hidden="true">
                        IMG
                      </div>
                    )}
                    <div className="my-auctions-item__info">
                      <div className="my-auctions-item__title">{title}</div>
                      <div className="my-auctions-item__meta">
                        {auctionModeLabel(auction.mode)} · {auctionStatusLabel(auction.status)}
                      </div>
                      <div className="my-auctions-item__meta">{timeLabel}</div>
                    </div>
                    <div className="my-auctions-item__right">
                      <AuctionListFact
                        label="Giá hiện tại"
                        value={`${auction.current_price.toLocaleString('vi-VN')} ₫`}
                      />
                      <AuctionListFact
                        label="Lượt đặt"
                        value={auction.bid_count.toLocaleString('vi-VN')}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
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
      <Tabs items={tabItems} defaultActiveKey={isSeller() ? 'created' : 'watching'} />
    </div>
  )
}
