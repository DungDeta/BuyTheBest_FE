import { useEffect, useRef, useState } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Link } from 'react-router-dom'
import { Spin } from 'antd'
import { publicGet } from '@/api/api'
import type { PageResponse } from '@/types/api'
import { getDemoProductImage } from '@/utils/demoProductImages'
import { getAuctionDisplayTitle } from '@/utils/auctionDisplay'
import './home.css'

interface Auction {
  id: string
  product_id: number
  mode: 'english' | 'dutch' | 'sealed_bid' | 'reverse'
  status: string
  starting_price: number
  current_price: number
  bid_count: number
  offer_count?: number
  seller_count?: number
  starts_at: string
  ends_at: string
  title?: string
  product?: { title: string; slug: string; condition: string; images?: ProductImage[] }
  seller?: { id: string; display_name: string }
}

interface ProductImage {
  url?: string
  thumbnail_url?: string
  is_primary?: boolean
  sort_order?: number
}

interface CategoryOption {
  id?: number
  name: string
  slug: string
}

interface HomeData {
  categories?: CategoryOption[]
  banners?: Banner[]
  ending_soon?: Auction[]
  hot?: Auction[]
  newest?: Auction[]
}

interface Banner {
  id: number
  title?: string
  image_url: string
  link_url?: string
  sort_order: number
  is_active: boolean
}

const FALLBACK_CATEGORIES: CategoryOption[] = [
  { name: 'Điện tử',  slug: 'dien-tu' },
  { name: 'Đồng hồ',  slug: 'dong-ho' },
  { name: 'Xe cộ',    slug: 'xe-co' },
  { name: 'Sneakers', slug: 'sneakers' },
  { name: 'Sưu tầm',  slug: 'suu-tam' },
  { name: 'Gaming',   slug: 'gaming' },
]

const FALLBACK_BANNERS: Banner[] = [
  {
    id: -1,
    title: 'Khám phá phiên đấu giá nổi bật',
    image_url: '/demo-products/iphone-15-pro-max.png',
    link_url: '/auctions',
    sort_order: 0,
    is_active: true,
  },
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
    letter: '01',
    name: 'Đấu giá tăng dần',
    desc: 'Người trả giá cao nhất khi hết thời gian sẽ thắng. Hệ thống tự gia hạn nếu có lượt đặt giá ở phút cuối.',
  },
  {
    letter: '02',
    name: 'Đấu giá giảm dần',
    desc: 'Giá giảm dần theo bước. Người đầu tiên chấp nhận thắng. Dùng cho hàng số lượng có giới hạn.',
  },
  {
    letter: '03',
    name: 'Đấu giá kín',
    desc: 'Đặt giá kín một lần duy nhất. Mở niêm phong tại thời điểm hẹn, người trả giá cao nhất thắng.',
  },
  {
    letter: '04',
    name: 'Đấu giá ngược',
    desc: 'Người mua đăng nhu cầu và ngân sách. Người bán cạnh tranh bằng mức giá phù hợp nhất.',
  },
]

const HOW_STEPS = [
  {
    num: '01',
    title: 'Đăng ký',
    desc: 'Đăng ký bằng email hoặc Google. Xác thực email xong là có thể đặt giá. Có thể nâng cấp người bán bất cứ lúc nào.',
  },
  {
    num: '02',
    title: 'Đặt giá',
    desc: 'Chọn phiên phù hợp, đặt giá thủ công hoặc đặt giá tự động với mức tối đa. Đồng hồ đếm ngược cập nhật theo thời gian thực.',
  },
  {
    num: '03',
    title: 'Thanh toán escrow',
    desc: 'Thắng phiên, thanh toán qua VNPay hoặc Stripe, tiền được giữ lại đến khi người mua xác nhận nhận hàng.',
  },
  {
    num: '04',
    title: 'Xác nhận hoặc khiếu nại',
    desc: 'Nếu nhận hàng thành công, tiền được chuyển cho người bán. Nếu có vấn đề, người mua mở khiếu nại để quản trị viên xử lý minh bạch.',
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
    case 'english':    return 'Giá tăng dần'
    case 'dutch':      return 'Giá giảm dần'
    case 'sealed_bid': return 'Đấu giá kín'
    case 'reverse':    return 'Đấu giá ngược'
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

function productImageUrl(product: Auction['product'] | undefined, title?: string): string | null {
  const images = product?.images ?? []
  const primary = images.find((img) => img.is_primary) ?? images[0]
  return primary?.thumbnail_url || primary?.url || getDemoProductImage(title ?? product?.title)
}

function bannerTitle(banner: Banner): string {
  return banner.title?.trim() || `Banner #${banner.id}`
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

function uniqueAuctions(items: Auction[]): Auction[] {
  const seen = new Set<string>()
  const result: Auction[] = []

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }

  return result
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
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const isSealed = auction.mode === 'sealed_bid'
  const isDutch  = auction.mode === 'dutch'
  const isReverse = auction.mode === 'reverse'

  const title = getAuctionDisplayTitle(auction)
  const imageUrl = productImageUrl(auction.product, title)
  const visibleImageUrl = imageUrl && failedImageUrl !== imageUrl ? imageUrl : null
  const reverseCounts = typeof auction.seller_count === 'number'
    ? `${auction.seller_count} người bán · ${auction.offer_count ?? auction.bid_count} báo giá`
    : `${auction.offer_count ?? auction.bid_count} báo giá`

  return (
    <Link
      to={`/auctions/${auction.id}`}
      className="listing"
      data-testid={isReverse ? 'home-reverse-auction-card' : 'home-auction-card'}
    >
      <div className="listing-badges">
        <span className={modeBadgeClass(auction.mode)}>
          {modeBadgeLabel(auction.mode)}
        </span>
        {isAuctionEndingSoon(auction) && (
          <span className="status-badge status-ending">Sắp hết</span>
        )}
      </div>
      <div className="listing-img">
        {visibleImageUrl ? (
          <img
            src={visibleImageUrl}
            alt={title}
            onError={() => setFailedImageUrl(visibleImageUrl)}
          />
        ) : (
          <div className="listing-img__placeholder">
            <strong>Không có ảnh</strong>
            {isReverse && <small>Nhu cầu mua</small>}
          </div>
        )}
      </div>
      <div className="listing-title">{title}</div>

      {isSealed ? (
        <div className="listing-price sealed">Đang nhận giá đặt kín</div>
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
          <span>{reverseCounts}</span>
        ) : (
          <span>{auction.bid_count} lượt đặt</span>
        )}
        <CountdownCell endsAt={auction.ends_at} />
      </div>
    </Link>
  )
}

export default function Home() {
  useDocumentTitle('Trang chủ')
  const [liveAuctions, setLiveAuctions] = useState<Auction[]>([])
  const [featuredAuctions, setFeaturedAuctions] = useState<Auction[]>([])
  const [homeEndingSoon, setHomeEndingSoon] = useState<Auction[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>(FALLBACK_CATEGORIES)
  const [banners, setBanners] = useState<Banner[]>(FALLBACK_BANNERS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAuctions() {
      setLoading(true)
      try {
        const [auctionResult, fallbackAuctionResult, homeResult] = await Promise.allSettled([
          publicGet<PageResponse<Auction>>('/auctions', {
            status: 'active',
            limit: 100,
            sort: 'ending_soon',
          }),
          publicGet<PageResponse<Auction>>('/auctions', {
            limit: 8,
            sort: 'newest',
          }),
          publicGet<HomeData>('/home'),
        ])

        if (cancelled) return

        const activeItems =
          auctionResult.status === 'fulfilled'
            ? auctionResult.value.data?.items ?? []
            : []
        const fallbackItems =
          fallbackAuctionResult.status === 'fulfilled'
            ? fallbackAuctionResult.value.data?.items ?? []
            : []
        const homeData = homeResult.status === 'fulfilled' ? homeResult.value.data : undefined
        const homeItems = uniqueAuctions([
          ...(homeData?.ending_soon ?? []),
          ...(homeData?.hot ?? []),
          ...(homeData?.newest ?? []),
        ])
        const liveItems = uniqueAuctions([...activeItems, ...homeItems]).filter(isAuctionLive)
        const fallbackFeatured = uniqueAuctions([
          ...homeItems,
          ...fallbackItems,
        ]).filter((auction) => !isAuctionLive(auction))

        setLiveAuctions(liveItems)
        setFeaturedAuctions(fallbackFeatured.slice(0, 8))
        setHomeEndingSoon(uniqueAuctions([...(homeData?.ending_soon ?? []), ...liveItems]))

        if (!cancelled && homeResult.status === 'fulfilled') {
          const nextCategories = homeData?.categories
          setCategories(nextCategories?.length ? nextCategories : FALLBACK_CATEGORIES)
          const nextBanners = homeData?.banners
          setBanners(nextBanners?.length ? nextBanners : FALLBACK_BANNERS)
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAuctions()
    return () => { cancelled = true }
  }, [])

  const endingSoon = uniqueAuctions([...homeEndingSoon, ...liveAuctions]).filter(isAuctionEndingSoon)
  const ongoingAuctions = liveAuctions.filter((auction) => !isAuctionEndingSoon(auction))
  const primaryAuctions = ongoingAuctions.length > 0 ? ongoingAuctions : featuredAuctions
  const showingLiveAuctions = ongoingAuctions.length > 0

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

      {/* ── Banners ────────────────────────────────────────────── */}
      {banners.length > 0 && (
        <section className="home-banners">
          {banners.map((banner) => (
            <a
              key={banner.id}
              href={banner.link_url || '#'}
              className="banner-slide"
              target={banner.link_url ? '_blank' : undefined}
              rel="noopener noreferrer"
            >
              <img src={banner.image_url} alt={bannerTitle(banner)} loading="eager" />
              <span className="banner-slide__copy">
                <span className="banner-slide__eyebrow">Banner nổi bật</span>
                <span className="banner-slide__title">{bannerTitle(banner)}</span>
                {banner.link_url && (
                  <span className="banner-slide__cta">Xem ngay</span>
                )}
              </span>
            </a>
          ))}
        </section>
      )}

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="home-hero">
        <div className="hero-left">
          <h1>
            Đấu giá<br />
            <em>thời gian thực.</em>
          </h1>
          <p>
            4 hình thức đấu giá. Thanh toán escrow. Truy vết mọi giao dịch.
            Tranh chấp minh bạch, quyền lợi của người mua và người bán đều được bảo vệ.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="hero-cta">Bắt đầu ngay</Link>
            <Link to="/products" className="hero-cta hero-cta--secondary">Xem sản phẩm</Link>
          </div>
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
          <h2>
            {showingLiveAuctions ? 'Đang ' : 'Phiên '}
            <em>{showingLiveAuctions ? 'diễn ra' : 'nổi bật'}</em>
          </h2>
          <span className="count">
            {primaryAuctions.length} {showingLiveAuctions ? 'phiên' : 'phiên gợi ý'}
          </span>
          {showingLiveAuctions && (
            <span className="live-pill">
              <span className="live-dot" />
              Live
            </span>
          )}
        </div>

        {loading ? (
          <div className="home-loading"><Spin /></div>
        ) : primaryAuctions.length === 0 ? (
          <div className="home-empty">Chưa có phiên đấu giá nào để hiển thị</div>
        ) : (
          <div className="listings">
            {primaryAuctions.map((a) => <AuctionCard key={a.id} auction={a} />)}
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
          <span><span className="trust-check">✓</span> Nhật ký minh bạch</span>
          <span><span className="trust-check">✓</span> Chống đặt giá phút cuối</span>
          <span><span className="trust-check">✓</span> Tranh chấp có quản trị viên phân xử</span>
          <span><span className="trust-check">✓</span> Auto-release sau 7 ngày</span>
        </div>
      </div>

      {/* ── CTA section ───────────────────────────────────────────── */}
      <section className="cta-section">
        <div>
          <h2>Bắt đầu.</h2>
          <p>30 giây đăng ký. Không cần thẻ. Đặt giá ngay phiên đầu tiên.</p>
        </div>
        <Link to="/register" className="cta-btn">Tạo tài khoản</Link>
      </section>
    </>
  )
}
