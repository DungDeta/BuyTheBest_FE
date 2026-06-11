import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { publicGet } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import './auction-detail.css'

interface AuctionDetail {
  id: string
  public_id?: string
  mode: 'english' | 'dutch' | 'sealed_bid' | 'reverse'
  status: string
  starting_price: number
  current_price: number
  min_increment?: number
  bid_count: number
  starts_at: string
  ends_at: string
  product_id: number
  seller_id: number
  category_id: number
  product?: {
    title: string
    slug: string
    description: string
    condition: string
    category_id: number
    category_name?: string
  }
  seller?: {
    id: string
    display_name: string
  }
}

interface BidItem {
  id: string
  amount: number
  bidder_label: string
  created_at: string
}

function formatPrice(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function calcCountdown(endsAt: string): string {
  const diff = Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000)
  if (diff <= 0) return 'Đã kết thúc'
  if (diff >= 86400) {
    const d = Math.floor(diff / 86400)
    const h = Math.floor((diff % 86400) / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function countdownBoxClass(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0)               return 'ad-countdown-box ended'
  if (diff < 60 * 1000)       return 'ad-countdown-box urgent'
  if (diff < 10 * 60 * 1000)  return 'ad-countdown-box warning'
  return 'ad-countdown-box'
}

function modeBadgeClass(mode: AuctionDetail['mode']): string {
  switch (mode) {
    case 'english':    return 'mode-badge E'
    case 'dutch':      return 'mode-badge D'
    case 'sealed_bid': return 'mode-badge S'
    case 'reverse':    return 'mode-badge R'
  }
}

function modeBadgeLabel(mode: AuctionDetail['mode']): string {
  switch (mode) {
    case 'english':    return 'E · English'
    case 'dutch':      return 'D · Dutch'
    case 'sealed_bid': return 'S · Sealed'
    case 'reverse':    return 'R · Reverse'
  }
}

function conditionLabel(condition: string): string {
  switch (condition) {
    case 'new':      return 'Mới'
    case 'like_new': return 'Như mới'
    case 'good':     return 'Tốt'
    case 'fair':     return 'Bình thường'
    default:         return condition
  }
}

interface CountdownTimerProps {
  endsAt: string
}

function CountdownTimer({ endsAt }: CountdownTimerProps) {
  const [display, setDisplay]   = useState(() => calcCountdown(endsAt))
  const [boxClass, setBoxClass] = useState(() => countdownBoxClass(endsAt))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setDisplay(calcCountdown(endsAt))
      setBoxClass(countdownBoxClass(endsAt))
    }, 1000)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [endsAt])

  return (
    <div className={boxClass}>
      <div className="ad-countdown-label">Còn lại · kết thúc lúc</div>
      <div className="ad-countdown-timer">{display}</div>
      <div className="ad-countdown-ends">{formatDateTime(endsAt)}</div>
    </div>
  )
}

interface BidHistoryTableProps {
  auctionId: string
}

function BidHistoryTable({ auctionId }: BidHistoryTableProps) {
  const [bids, setBids]       = useState<BidItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchBids() {
      setLoading(true)
      setHasError(false)
      try {
        const res = await publicGet<{ items: BidItem[] }>(`/auctions/${auctionId}/bids`)
        if (!cancelled) {
          setBids(res.data?.items ?? [])
        }
      } catch {
        if (!cancelled) setHasError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBids()
    return () => { cancelled = true }
  }, [auctionId])

  if (loading) {
    return <div className="ad-bids-loading"><Spin size="small" /></div>
  }

  if (hasError || bids.length === 0) {
    return (
      <div className="ad-bids-empty">
        {hasError ? 'Không thể tải lịch sử bid.' : 'Chưa có lịch sử bid nào.'}
      </div>
    )
  }

  return (
    <table className="ad-bid-table" aria-label="Lịch sử bid">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Người bid</th>
          <th>Số tiền</th>
        </tr>
      </thead>
      <tbody>
        {bids.map((bid) => (
          <tr key={bid.id}>
            <td className="ad-bid-time">{formatTime(bid.created_at)}</td>
            <td className="ad-bid-who">{bid.bidder_label}</td>
            <td className="ad-bid-amount">{formatPrice(bid.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function AuctionDetail() {
  const { id }          = useParams<{ id: string }>()
  const navigate        = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [auction, setAuction] = useState<AuctionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchAuction() {
      setLoading(true)
      setError(null)
      try {
        const res = await publicGet<AuctionDetail>(`/auctions/${id}`)
        if (!cancelled) setAuction(res.data)
      } catch {
        if (!cancelled) setError('Không thể tải thông tin phiên đấu giá.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAuction()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="ad-loading" aria-label="Đang tải">
        <Spin size="large" />
      </div>
    )
  }

  if (error || !auction) {
    return (
      <div className="ad-error">
        <p className="ad-error-msg">{error ?? 'Phiên đấu giá không tồn tại.'}</p>
        <Link to="/auctions" className="ad-back-link">← Quay lại danh sách</Link>
      </div>
    )
  }

  const title       = auction.product?.title ?? `Auction #${auction.id.slice(0, 8)}`
  const publicLabel = auction.public_id
    ? `#${auction.public_id}`
    : `#${auction.id.slice(-6).toUpperCase()}`
  const seller = auction.seller?.id && auction.seller.display_name
    ? auction.seller
    : null

  return (
    <>
      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <nav className="ad-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="ad-bc-sep" aria-hidden="true">/</span>
        <Link to="/auctions">Khám phá</Link>
        {auction.product?.category_name && (
          <>
            <span className="ad-bc-sep" aria-hidden="true">/</span>
            <Link to={`/auctions?cat=${auction.product?.category_id}`}>
              {auction.product?.category_name}
            </Link>
          </>
        )}
        <span className="ad-bc-sep" aria-hidden="true">/</span>
        <span className="ad-bc-current" aria-current="page">{title}</span>
      </nav>

      {/* ── Room shell ──────────────────────────────────────── */}
      <div className="ad-shell">

        {/* ══ LEFT ══ */}
        <div className="ad-left">

          {/* Product hero card */}
          <div className="ad-product-hero">
            <div className="ad-product-grid">

              {/* Gallery placeholder */}
              <div className="ad-gallery">
                <div className="ad-main-img" aria-label={`Hình ảnh: ${title}`}>
                  <div className="ad-img-badges">
                    <span className={modeBadgeClass(auction.mode)}>
                      {modeBadgeLabel(auction.mode)}
                    </span>
                  </div>
                  <div className="ad-img-content">
                    <span className="ad-img-title">{title}</span>
                    <span className="ad-img-sub">
                      {conditionLabel(auction.product?.condition ?? '')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product info */}
              <div className="ad-product-info">
                <div className="ad-product-ref">
                  {publicLabel} · Đăng {formatDateTime(auction.starts_at)}
                </div>
                <h1 className="ad-product-title">{title}</h1>

                <div className="ad-product-meta">
                  <span className="ad-condition-badge">
                    {conditionLabel(auction.product?.condition ?? '')}
                  </span>
                  {auction.product?.category_name && (
                    <>
                      <span className="ad-meta-dot" aria-hidden="true">·</span>
                      <Link
                        to={`/auctions?cat=${auction.product?.category_id}`}
                        className="ad-meta-link"
                      >
                        {auction.product?.category_name}
                      </Link>
                    </>
                  )}
                </div>

                {auction.product?.description && (
                  <p className="ad-product-desc">{auction.product?.description}</p>
                )}

                {seller && (
                  <div className="ad-seller-card">
                    <div className="ad-seller-avatar" aria-hidden="true">
                      {seller.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="ad-seller-info">
                      <div className="ad-seller-name">{seller.display_name}</div>
                      <div className="ad-seller-sub">Người bán</div>
                    </div>
                    <Link
                      to={`/sellers/${seller.id}`}
                      className="ad-seller-link"
                      aria-label={`Xem shop của ${seller.display_name}`}
                    >
                      Xem shop →
                    </Link>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Bid history */}
          <section className="ad-section" aria-labelledby="bid-history-heading">
            <h2 className="ad-section-title" id="bid-history-heading">
              Lịch sử bid
              <span className="ad-section-count">{auction.bid_count} lượt</span>
            </h2>
            <BidHistoryTable auctionId={id!} />
          </section>

        </div>

        {/* ══ RIGHT — Bid panel ══ */}
        <aside className="ad-bid-panel" aria-label="Thông tin và hành động đấu giá">

          {/* Countdown */}
          <CountdownTimer endsAt={auction.ends_at} />

          {/* Bid summary card */}
          <div className="ad-bid-card">

            <div className="ad-bid-current">
              <div>
                <div className="ad-bid-label">
                  {auction.mode === 'sealed_bid'  && 'Giá khởi điểm'}
                  {auction.mode === 'dutch'        && 'Giá hiện tại (đang giảm)'}
                  {auction.mode === 'reverse'      && 'Ngân sách buyer'}
                  {auction.mode === 'english'      && 'Bid hiện tại'}
                </div>
                <div className="ad-bid-amount">
                  {auction.mode === 'sealed_bid'
                    ? '? ? ?. ? ? ?. ? ? ? ₫'
                    : formatPrice(auction.current_price)}
                </div>
                {auction.mode !== 'sealed_bid' && (
                  <div className="ad-bid-delta">
                    + {formatPrice(auction.current_price - auction.starting_price)} vs khởi điểm
                  </div>
                )}
              </div>
              <span className={modeBadgeClass(auction.mode)}>
                {modeBadgeLabel(auction.mode)}
              </span>
            </div>

            {/* Stats row */}
            <div className="ad-bid-stats">
              <div className="ad-bid-stat">
                <span className="ad-bid-stat-val">{auction.bid_count}</span>
                <span className="ad-bid-stat-label">
                  {auction.mode === 'reverse' ? 'sellers' : 'bids'}
                </span>
              </div>
              {auction.mode !== 'sealed_bid' && (
                <div className="ad-bid-stat">
                  <span className="ad-bid-stat-val">
                    {formatPrice(auction.min_increment ?? 0)}
                  </span>
                  <span className="ad-bid-stat-label">bước tối thiểu</span>
                </div>
              )}
              <div className="ad-bid-stat">
                <span className="ad-bid-stat-val">
                  {formatPrice(auction.starting_price)}
                </span>
                <span className="ad-bid-stat-label">khởi điểm</span>
              </div>
            </div>

            {/* Action */}
            <div className="ad-bid-action">
              {isAuthenticated() ? (
                <button
                  className="ad-join-btn"
                  type="button"
                  onClick={() => {
                  }}
                >
                  Tham gia phiên này →
                </button>
              ) : (
                <button
                  className="ad-login-btn"
                  type="button"
                  onClick={() => navigate('/login')}
                >
                  Đăng nhập để bid →
                </button>
              )}
              <p className="ad-action-note">
                Escrow bảo vệ — tiền giữ đến khi xác nhận nhận hàng
              </p>
            </div>

          </div>

          {seller && (
            <div className="ad-panel-seller">
              <div className="ad-panel-seller-avatar" aria-hidden="true">
                {seller.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="ad-panel-seller-info">
                <div className="ad-panel-seller-label">Người bán</div>
                <div className="ad-panel-seller-name">{seller.display_name}</div>
              </div>
              <Link
                to={`/sellers/${seller.id}`}
                className="ad-panel-seller-link"
                aria-label={`Xem trang người bán ${seller.display_name}`}
              >
                Xem →
              </Link>
            </div>
          )}

        </aside>
      </div>
    </>
  )
}

export const Component = AuctionDetail
