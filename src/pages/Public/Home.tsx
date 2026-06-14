import { useEffect, useRef, useState } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Link } from 'react-router-dom'
import { Spin } from 'antd'
import { publicGet } from '@/api/api'
import type { PageResponse } from '@/types/api'
import './home.css'

interface Auction {
  id: string
  product_id: number
  mode: 'english' | 'dutch' | 'sealed_bid' | 'reverse'
  status: string
  starting_price: number
  current_price: number
  bid_count: number
  starts_at: string
  ends_at: string
  title?: string
  product?: { title: string; slug: string; condition: string; images: unknown[] }
  seller?: { id: string; display_name: string }
}

interface CategoryOption {
  id?: number
  name: string
  slug: string
}

interface HomeData {
  categories?: CategoryOption[]
}

const FALLBACK_CATEGORIES: CategoryOption[] = [
  { name: 'Điện tử',  slug: 'dien-tu' },
  { name: 'Đồng hồ',  slug: 'dong-ho' },
  { name: 'Xe cộ',    slug: 'xe-co' },
  { name: 'Sneakers', slug: 'sneakers' },
  { name: 'Sưu tầm',  slug: 'suu-tam' },
  { name: 'Gaming',   slug: 'gaming' },
]

const CATEGORY_LABELS: Record<string, string> = {
  'dien-tu': 'Công nghệ',
  'dong-ho': 'Đồng hồ',
  'xe-co': 'Xe cộ',
  sneakers: 'Sneakers',
  'suu-tam': 'Sưu tầm',
  gaming: 'Gaming',
}

const AUCTION_TYPES = [
  {
    letter: 'E',
    name: 'English Auction',
    desc: 'Giá tăng dần, ai trả cao nhất lúc hết giờ thắng. Có anti-sniping tự động kéo dài 60s nếu có bid phút cuối.',
  },
  {
    letter: 'D',
    name: 'Dutch Auction',
    desc: 'Giá giảm dần theo bước. Người đầu tiên chấp nhận thắng. Dùng cho hàng số lượng có giới hạn.',
  },
  {
    letter: 'S',
    name: 'Sealed-Bid',
    desc: 'Đặt giá kín, một lần duy nhất. Mở niêm phong tại thời điểm hẹn — ai cao nhất thắng.',
  },
  {
    letter: 'R',
    name: 'Reverse Auction',
    desc: 'Buyer đăng nhu cầu, sellers cạnh tranh giá thấp nhất trong ngân sách. Buyer chọn deal tốt nhất.',
  },
]

const HOW_STEPS = [
  {
    num: '01',
    title: 'Đăng ký',
    desc: 'Email hoặc Google. Verify email xong là bid được ngay. Nâng cấp Seller bất cứ lúc nào.',
  },
  {
    num: '02',
    title: 'Đặt giá',
    desc: 'Chọn phiên phù hợp, đặt giá thủ công hoặc auto-bid với giá tối đa. Countdown chính xác từng giây.',
  },
  {
    num: '03',
    title: 'Thanh toán escrow',
    desc: 'Thắng phiên → checkout VNPay/Stripe → tiền giữ trong escrow đến khi nhận hàng.',
  },
  {
    num: '04',
    title: 'Xác nhận hoặc khiếu nại',
    desc: 'Nhận hàng OK → tiền chuyển Seller. Có vấn đề → mở dispute, Admin phân xử minh bạch.',
  },
]

const ENDING_SOON_WINDOW_MS = 2 * 60 * 60 * 1000

function formatPrice(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
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

function countdownClass(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0)              return 'countdown ended'
  if (diff < 30 * 60 * 1000)  return 'countdown urgent'
  if (diff < 2 * 60 * 60 * 1000) return 'countdown warning'
  return 'countdown'
}

function modeBadgeLabel(mode: Auction['mode']): string {
  switch (mode) {
    case 'english':    return 'E · English'
    case 'dutch':      return 'D · Dutch'
    case 'sealed_bid': return 'S · Sealed'
    case 'reverse':    return 'R · Reverse'
  }
}

function modeBadgeClass(mode: Auction['mode']): string {
  switch (mode) {
    case 'english':    return 'mode-badge E'
    case 'dutch':      return 'mode-badge D'
    case 'sealed_bid': return 'mode-badge S'
    case 'reverse':    return 'mode-badge R'
  }
}

function remainingMs(endsAt: string): number {
  return new Date(endsAt).getTime() - Date.now()
}

function isAuctionLive(auction: Auction): boolean {
  return auction.status === 'active' && remainingMs(auction.ends_at) > 0
}

function isAuctionEndingSoon(auction: Auction): boolean {
  const remaining = remainingMs(auction.ends_at)
  return auction.status === 'active' && remaining > 0 && remaining <= ENDING_SOON_WINDOW_MS
}

function categoryLabel(category: CategoryOption): string {
  return CATEGORY_LABELS[category.slug] ?? category.name
}

interface CountdownCellProps {
  endsAt: string
}

function CountdownCell({ endsAt }: CountdownCellProps) {
  const [display, setDisplay] = useState(() => calcCountdown(endsAt))
  const [cls, setCls] = useState(() => countdownClass(endsAt))
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    rafRef.current = setInterval(() => {
      setDisplay(calcCountdown(endsAt))
      setCls(countdownClass(endsAt))
    }, 1000)
    return () => {
      if (rafRef.current !== null) clearInterval(rafRef.current)
    }
  }, [endsAt])

  return <span className={cls}>{display}</span>
}

interface AuctionCardProps {
  auction: Auction
}

function AuctionCard({ auction }: AuctionCardProps) {
  const isSealed = auction.mode === 'sealed_bid'
  const isDutch  = auction.mode === 'dutch'
  const isReverse = auction.mode === 'reverse'

  const title = auction.product?.title ?? auction.title ?? `Auction #${auction.id}`

  return (
    <Link to={`/auctions/${auction.id}`} className="listing">
      <div className="listing-badges">
        <span className={modeBadgeClass(auction.mode)}>
          {modeBadgeLabel(auction.mode)}
        </span>
        {isAuctionEndingSoon(auction) && (
          <span className="status-badge status-ending">Sắp hết</span>
        )}
      </div>
      <div className="listing-img">{title}</div>
      <div className="listing-title">{title}</div>

      {isSealed ? (
        <div className="listing-price sealed">Đang nhận bid kín</div>
      ) : isReverse ? (
        <div className="listing-price">≤ {formatPrice(auction.current_price)}</div>
      ) : isDutch ? (
        <div className="listing-price">
          {formatPrice(auction.current_price)}{' '}
          <span className="price-arrow-down">↓</span>
        </div>
      ) : (
        <div className="listing-price">{formatPrice(auction.current_price)}</div>
      )}

      <div className="listing-details">
        {isSealed ? (
          <span>—</span>
        ) : isDutch ? (
          <span>giảm mỗi 30s</span>
        ) : isReverse ? (
          <span>{auction.bid_count} sellers</span>
        ) : (
          <span>{auction.bid_count} bids</span>
        )}
        <CountdownCell endsAt={auction.ends_at} />
      </div>
    </Link>
  )
}

export default function Home() {
  useDocumentTitle('Trang chủ')
  const [liveAuctions, setLiveAuctions] = useState<Auction[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>(FALLBACK_CATEGORIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAuctions() {
      setLoading(true)
      try {
        const [auctionResult, homeResult] = await Promise.allSettled([
          publicGet<PageResponse<Auction>>('/auctions', {
            status: 'active',
            limit: 100,
            sort: 'ending_soon',
          }),
          publicGet<HomeData>('/home'),
        ])

        if (!cancelled && auctionResult.status === 'fulfilled' && auctionResult.value.data?.items) {
          setLiveAuctions(auctionResult.value.data.items.filter(isAuctionLive))
        }
        if (!cancelled && homeResult.status === 'fulfilled') {
          const nextCategories = homeResult.value.data?.categories
          setCategories(nextCategories?.length ? nextCategories : FALLBACK_CATEGORIES)
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAuctions()
    return () => { cancelled = true }
  }, [])

  const endingSoon = liveAuctions.filter(isAuctionEndingSoon)
  const ongoingAuctions = liveAuctions.filter((auction) => !isAuctionEndingSoon(auction))

  return (
    <>
      {/* ── Category bar ─────────────────────────────────────────── */}
      <div className="cat-bar">
        {categories.map((cat) => (
          <Link key={cat.slug} to={`/categories/${cat.slug}`}>
            {categoryLabel(cat)}
          </Link>
        ))}
      </div>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="home-hero">
        <div className="hero-left">
          <h1>
            Đấu giá<br />
            <em>thời gian thực.</em>
          </h1>
          <p>
            4 hình thức đấu giá. Thanh toán escrow. Truy vết mọi giao dịch.
            Tranh chấp minh bạch — quyền lợi cả Buyer và Seller được bảo vệ.
          </p>
          <Link to="/register" className="hero-cta">Bắt đầu ngay →</Link>
        </div>

        <div className="hero-right">
          <div className="stat-card">
            <div className="stat-num accent">
              {loading ? '—' : liveAuctions.length}
            </div>
            <div className="stat-label">Phiên đang mở</div>
            <div className="stat-note">Realtime</div>
          </div>
          <div className="stat-card">
            <div className="stat-num muted">—</div>
            <div className="stat-label">Giao dịch / 24h</div>
            <div className="stat-note">Dữ liệu sau go-live</div>
          </div>
          <div className="stat-card">
            <div className="stat-num muted">—</div>
            <div className="stat-label">Tỷ lệ giao dịch thành công</div>
            <div className="stat-note">Dữ liệu sau go-live</div>
          </div>
        </div>
      </section>

      {/* ── Live auctions ─────────────────────────────────────────── */}
      <section className="home-section">
        <div className="section-header">
          <h2>Đang <em>diễn ra</em></h2>
          <span className="count">{ongoingAuctions.length} phiên</span>
          <span className="live-pill">
            <span className="live-dot" />
            Live
          </span>
        </div>

        {loading ? (
          <div className="home-loading"><Spin /></div>
        ) : ongoingAuctions.length === 0 ? (
          <div className="home-empty">Chưa có phiên nào đang diễn ra</div>
        ) : (
          <div className="listings">
            {ongoingAuctions.map((a) => <AuctionCard key={a.id} auction={a} />)}
          </div>
        )}
      </section>

      {/* ── Auction types ─────────────────────────────────────────── */}
      <section className="types-section">
        <div className="section-header">
          <h2>Hình thức đấu giá</h2>
          <span className="count">4 loại</span>
        </div>

        {AUCTION_TYPES.map((t) => (
          <div key={t.letter} className="type-block">
            <div className="type-block-letter">{t.letter}</div>
            <div className="type-block-content">
              <h4>{t.name}</h4>
              <p>{t.desc}</p>
            </div>
            <div className="type-block-stat">
              <span className="n">—</span>
              <span className="l">phiên / 24h</span>
            </div>
          </div>
        ))}
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="home-section">
        <div className="section-header">
          <h2>Cách <em>hoạt động</em></h2>
          <span className="count">4 bước</span>
        </div>

        <div className="how-grid">
          {HOW_STEPS.map((step) => (
            <div key={step.num} className="how-step">
              <span className="step-num">{step.num}</span>
              <h4>{step.title}</h4>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ending soon ───────────────────────────────────────────── */}
      <section className="home-section">
        <div className="section-header">
          <h2>Sắp <em>kết thúc</em></h2>
          <span className="count">Trong 2 giờ tới</span>
        </div>

        {loading ? (
          <div className="home-loading"><Spin /></div>
        ) : endingSoon.length === 0 ? (
          <div className="home-empty">Không có phiên nào sắp kết thúc</div>
        ) : (
          <div className="listings">
            {endingSoon.map((a) => <AuctionCard key={a.id} auction={a} />)}
          </div>
        )}
      </section>

      {/* ── Trust bar ─────────────────────────────────────────────── */}
      <div className="trust-bar">
        <strong>Bảo vệ:</strong>
        <div className="trust-items">
          <span><span className="trust-check">✓</span> Escrow an toàn</span>
          <span><span className="trust-check">✓</span> Audit log công khai</span>
          <span><span className="trust-check">✓</span> Anti-sniping bảo vệ Buyer</span>
          <span><span className="trust-check">✓</span> Dispute có Admin phân xử</span>
          <span><span className="trust-check">✓</span> Auto-release sau 7 ngày</span>
        </div>
      </div>

      {/* ── CTA section ───────────────────────────────────────────── */}
      <section className="cta-section">
        <div>
          <h2>Bắt đầu.</h2>
          <p>30 giây đăng ký. Không cần thẻ. Bid ngay phiên đầu tiên.</p>
        </div>
        <Link to="/register" className="cta-btn">Tạo tài khoản →</Link>
      </section>
    </>
  )
}
