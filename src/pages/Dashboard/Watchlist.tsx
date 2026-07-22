import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Pagination, Spin } from 'antd'
import { ShoppingOutlined } from '@ant-design/icons'
import { privateGet, privatePost } from '@/api/api'
import { useCountdown } from '@/hooks/useCountdown'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
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

interface ToggleResponse {
  added: boolean
  auction_id: string
}

type StatusFilter = 'all' | 'active' | 'scheduled' | 'ended'

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang diễn ra' },
  { value: 'scheduled', label: 'Sắp diễn ra' },
  { value: 'ended', label: 'Đã kết thúc' },
]

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  all: 'Bạn chưa theo dõi phiên nào',
  active: 'Không có phiên đang diễn ra trong danh sách theo dõi',
  scheduled: 'Không có phiên sắp diễn ra trong danh sách theo dõi',
  ended: 'Không có phiên đã kết thúc trong danh sách theo dõi',
}

const PAGE_SIZE = 24

function WatchlistCountdown({ endTime, status }: { endTime: string; status: string }) {
  const cd = useCountdown(endTime)

  if (status === 'ended' || cd.isExpired) {
    return <span className="watchlist-card__countdown watchlist-card__countdown--expired">Đã kết thúc</span>
  }

  const parts: string[] = []
  if (cd.hours > 0) parts.push(`${cd.hours}g`)
  parts.push(`${String(cd.minutes).padStart(2, '0')}p`)
  parts.push(`${String(cd.seconds).padStart(2, '0')}s`)

  const cls = cd.isUrgent
    ? 'watchlist-card__countdown watchlist-card__countdown--urgent'
    : cd.isWarning
      ? 'watchlist-card__countdown watchlist-card__countdown--warning'
      : 'watchlist-card__countdown'

  return <span className={cls}>{parts.join(' ')}</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: 'Đang đấu', color: '#52c41a' },
    scheduled: { label: 'Chưa mở', color: '#1677ff' },
    ended: { label: 'Đã kết thúc', color: '#8c8c8c' },
    cancelled: { label: 'Đã huỷ', color: '#ff4d4f' },
  }
  const info = map[status] ?? { label: status, color: '#8c8c8c' }
  return (
    <span
      style={{
        fontSize: '0.7rem',
        padding: '2px 8px',
        borderRadius: 10,
        border: `1px solid ${info.color}`,
        color: info.color,
        fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
      }}
    >
      {info.label}
    </span>
  )
}

interface WatchlistCardProps {
  item: WatchlistItem
  onUnwatch: (auctionId: string) => void
  unwatching: boolean
}

function WatchlistCard({ item, onUnwatch, unwatching }: WatchlistCardProps) {
  const navigate = useNavigate()
  const imageUrl = item.thumbnail_url || getDemoProductImage(item.title)

  return (
    <article className="watchlist-card" aria-label={item.title}>
      <a
        className="watchlist-card__thumb-link"
        href={`/auctions/${item.auction_id}`}
        onClick={(e) => {
          e.preventDefault()
          navigate(`/auctions/${item.auction_id}`)
        }}
        tabIndex={0}
        aria-label={`Xem phiên: ${item.title}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            className="watchlist-card__thumb"
          />
        ) : (
          <div
            className="watchlist-card__thumb--placeholder"
            aria-label="Phiên chưa có ảnh đại diện"
            role="img"
          >
            <ShoppingOutlined />
          </div>
        )}
      </a>

      <div className="watchlist-card__body">
        <a
          className="watchlist-card__title"
          href={`/auctions/${item.auction_id}`}
          onClick={(e) => {
            e.preventDefault()
            navigate(`/auctions/${item.auction_id}`)
          }}
        >
          {item.title}
        </a>

        <span className="watchlist-card__price">
          {item.current_price.toLocaleString('vi-VN')} ₫
        </span>

        <span className="watchlist-card__meta">{item.bid_count} lượt đặt</span>

        <WatchlistCountdown endTime={item.end_time} status={item.status} />
      </div>

      <div className="watchlist-card__footer">
        <StatusBadge status={item.status} />
        <button
          className="watchlist-card__unwatch-btn"
          onClick={() => onUnwatch(item.auction_id)}
          disabled={unwatching}
          type="button"
          aria-label={`Bỏ theo dõi ${item.title}`}
        >
          {unwatching ? '...' : 'Bỏ theo dõi'}
        </button>
      </div>
    </article>
  )
}

export function Component() {
  useDocumentTitle('Theo dõi')
  const { message } = App.useApp()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [unwatchingId, setUnwatchingId] = useState<string | null>(null)

  const fetchWatchlist = useCallback(
    async (currentFilter: StatusFilter, currentPage: number) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          page: currentPage,
          limit: PAGE_SIZE,
          sort: 'ending_soon',
        }
        if (currentFilter !== 'all') {
          params.status = currentFilter
        }
        const res = await privateGet<WatchlistResponse>('/watchlist', params)
        setItems(res.data?.items ?? [])
        setTotal(res.data?.total ?? 0)
      } catch {
        message.error('Không thể tải danh sách theo dõi')
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    fetchWatchlist(filter, page)
  }, [filter, page, fetchWatchlist])

  function handleFilterChange(next: StatusFilter) {
    setFilter(next)
    setPage(1)
  }

  async function handleUnwatch(auctionId: string) {
    setUnwatchingId(auctionId)
    try {
      const res = await privatePost<ToggleResponse>(`/watchlist/${auctionId}`)
      if (res.data && !res.data.added) {
        setItems((prev) => prev.filter((i) => i.auction_id !== auctionId))
        setTotal((prev) => Math.max(0, prev - 1))
        message.success('Đã bỏ theo dõi phiên đấu giá')
      }
    } catch {
      message.error('Không thể bỏ theo dõi, vui lòng thử lại')
    } finally {
      setUnwatchingId(null)
    }
  }

  return (
    <div className="watchlist-page">
      <div className="watchlist-page__header">
        <h1 className="watchlist-page__title">Danh sách theo dõi</h1>

        <div className="watchlist-filters" role="group" aria-label="Lọc theo trạng thái">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`watchlist-filter-btn${filter === tab.value ? ' watchlist-filter-btn--active' : ''}`}
              onClick={() => handleFilterChange(tab.value)}
              type="button"
              aria-pressed={filter === tab.value}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: 60 }}
          aria-label="Đang tải"
        >
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <div className="watchlist-empty" role="status">
          <span className="watchlist-empty__icon" aria-hidden="true">Theo dõi</span>
          {EMPTY_MESSAGES[filter]}
        </div>
      ) : (
        <>
          <div
            className="watchlist-grid"
            role="list"
            aria-label="Danh sách phiên đang theo dõi"
          >
            {items.map((item) => (
              <div key={item.auction_id} role="listitem">
                <WatchlistCard
                  item={item}
                  onUnwatch={handleUnwatch}
                  unwatching={unwatchingId === item.auction_id}
                />
              </div>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
