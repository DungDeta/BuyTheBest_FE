import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { publicGet } from '@/api/api'
import type { PageResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './seller-profile.css'

interface SellerProfile {
  user_id: number
  username: string
  shop_name: string
  description: string
  shipping_policy?: string
  return_policy?: string
  rating_avg: number
  review_count: number
  total_revenue: number
  total_auctions: number
  active_auctions: number
  member_since: string
  open_auctions?: Auction[]
  latest_reviews?: Review[]
}

interface Review {
  id: string
  rating: number
  comment: string
  reviewer_name: string
  created_at: string
}

interface Auction {
  id: string
  seller_id: number
  mode: 'english' | 'dutch' | 'sealed_bid' | 'reverse'
  status: string
  starting_price: number
  current_price: number
  bid_count: number
  starts_at: string
  ends_at: string
  title?: string
  product?: {
    title: string
    slug: string
    condition?: string
    images?: unknown[]
  }
}

interface ReviewResponse {
  reviews: Review[]
  total: number
  average_rating: number
}

type TabId = 'auctions' | 'reviews'

function formatPrice(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  })
}

function renderStars(rating: number): string {
  const full  = Math.round(Math.max(0, Math.min(5, rating)))
  const empty = 5 - full
  return '★'.repeat(full) + '☆'.repeat(empty)
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

interface AuctionCardProps {
  auction: Auction
}

function AuctionCard({ auction }: AuctionCardProps) {
  const title     = auction.product?.title ?? auction.title ?? `Auction #${auction.id}`
  const isSealed  = auction.mode === 'sealed_bid'
  const isDutch   = auction.mode === 'dutch'
  const isReverse = auction.mode === 'reverse'

  return (
    <Link to={`/auctions/${auction.id}`} className="listing">
      <div className="listing-badges">
        <span className={modeBadgeClass(auction.mode)}>
          {modeBadgeLabel(auction.mode)}
        </span>
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
        ) : isReverse ? (
          <span>{auction.bid_count} sellers</span>
        ) : (
          <span>{auction.bid_count} bids</span>
        )}
        <span>{formatDate(auction.ends_at)}</span>
      </div>
    </Link>
  )
}

interface ReviewItemProps {
  review: Review
}

function ReviewItem({ review }: ReviewItemProps) {
  return (
    <div className="sp-review-item">
      <div className="sp-review-header">
        <span className="sp-review-stars" aria-label={`${review.rating} sao`}>
          {renderStars(review.rating)}
        </span>
        <span className="sp-review-reviewer">{review.reviewer_name}</span>
        <span className="sp-review-date">{formatDate(review.created_at)}</span>
      </div>
      {review.comment && (
        <p className="sp-review-comment">{review.comment}</p>
      )}
    </div>
  )
}

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>()

  const [seller,   setSeller]   = useState<SellerProfile | null>(null)

  useDocumentTitle(seller ? (seller.shop_name || seller.username) : 'Hồ sơ người bán')
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [reviews,  setReviews]  = useState<Review[]>([])

  const [loadingSeller,   setLoadingSeller]   = useState(true)
  const [loadingAuctions, setLoadingAuctions] = useState(false)
  const [loadingReviews,  setLoadingReviews]  = useState(false)

  const [sellerError,   setSellerError]   = useState<string | null>(null)
  const [auctionsError, setAuctionsError] = useState<string | null>(null)
  const [reviewsError,  setReviewsError]  = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabId>('auctions')
  const sellerUserId = seller?.user_id

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchSeller() {
      setLoadingSeller(true)
      setSellerError(null)
      try {
        const res = await publicGet<SellerProfile>(`/sellers/${id}`)
        if (!cancelled) {
          const profile = res.data ?? null
          setSeller(profile)
          setAuctions(profile?.open_auctions ?? [])
          setReviews(profile?.latest_reviews ?? [])
        }
      } catch {
        if (!cancelled) setSellerError('Không thể tải thông tin người bán.')
      } finally {
        if (!cancelled) setLoadingSeller(false)
      }
    }

    fetchSeller()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id || !sellerUserId || activeTab !== 'auctions') return
    let cancelled = false

    async function fetchAuctions() {
      setLoadingAuctions(true)
      setAuctionsError(null)
      try {
        const res = await publicGet<PageResponse<Auction>>('/auctions', { seller_id: sellerUserId })
        if (!cancelled) {
          const sellerItems = (res.data?.items ?? []).filter((item) => item.seller_id === sellerUserId)
          setAuctions(sellerItems)
        }
      } catch {
        if (!cancelled) setAuctionsError('Không thể tải phiên đấu giá.')
      } finally {
        if (!cancelled) setLoadingAuctions(false)
      }
    }

    fetchAuctions()
    return () => { cancelled = true }
  }, [id, sellerUserId, activeTab])

  useEffect(() => {
    if (!id || !sellerUserId || activeTab !== 'reviews') return
    let cancelled = false

    async function fetchReviews() {
      setLoadingReviews(true)
      setReviewsError(null)
      try {
        const res = await publicGet<ReviewResponse>(`/sellers/${sellerUserId}/reviews`)
        if (!cancelled) setReviews(res.data?.reviews ?? [])
      } catch {
        if (!cancelled) setReviewsError('Không thể tải đánh giá.')
      } finally {
        if (!cancelled) setLoadingReviews(false)
      }
    }

    fetchReviews()
    return () => { cancelled = true }
  }, [id, sellerUserId, activeTab])

  if (loadingSeller) {
    return (
      <div className="sp-loading" aria-label="Đang tải">
        <Spin size="large" />
      </div>
    )
  }

  if (sellerError || !seller) {
    return (
      <div className="sp-error">
        <p className="sp-error-msg">
          {sellerError ?? 'Không tìm thấy người bán.'}
        </p>
        <Link to="/" className="sp-back-link">← Quay lại trang chủ</Link>
      </div>
    )
  }

  const displayName   = seller.shop_name || seller.username
  const avatarLetters = displayName.slice(0, 2).toUpperCase()
  const totalReviews  = seller.review_count ?? reviews.length

  return (
    <>
      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <nav className="sp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="sp-bc-sep" aria-hidden="true">/</span>
        <span className="sp-bc-label">Sellers</span>
        <span className="sp-bc-sep" aria-hidden="true">/</span>
        <span className="sp-bc-current" aria-current="page">{displayName}</span>
      </nav>

      <div className="sp-shell">

        {/* ── Seller info card ────────────────────────────────── */}
        <section className="sp-info-card" aria-labelledby="sp-shop-name">
          <div className="sp-info-top">
            <div className="sp-avatar" aria-hidden="true">{avatarLetters}</div>
            <div className="sp-info-body">
              <h1 className="sp-shop-name" id="sp-shop-name">{displayName}</h1>
              {seller.description && (
                <p className="sp-description">{seller.description}</p>
              )}
            </div>
          </div>

          <div className="sp-stats-row">
            <div className="sp-stat">
              <span className="sp-stat-val">
                {seller.total_auctions.toLocaleString('vi-VN')}
              </span>
              <span className="sp-stat-label">Phiên</span>
            </div>
            <div className="sp-stat-divider" aria-hidden="true" />
            <div className="sp-stat">
              <span
                className="sp-stat-val sp-stars"
                aria-label={`${seller.rating_avg.toFixed(1)} sao`}
              >
                {renderStars(seller.rating_avg)}
                <span className="sp-rating-num">{seller.rating_avg.toFixed(1)}</span>
              </span>
              <span className="sp-stat-label">Đánh giá TB</span>
            </div>
            <div className="sp-stat-divider" aria-hidden="true" />
            <div className="sp-stat">
              <span className="sp-stat-val">
                {totalReviews.toLocaleString('vi-VN')}
              </span>
              <span className="sp-stat-label">Lượt đánh giá</span>
            </div>
            <div className="sp-stat-divider" aria-hidden="true" />
            <div className="sp-stat">
              <span className="sp-stat-val sp-join-date">
                {formatJoinDate(seller.member_since)}
              </span>
              <span className="sp-stat-label">Tham gia</span>
            </div>
          </div>
        </section>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div className="sp-tabs" role="tablist" aria-label="Nội dung người bán">
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'auctions'}
            className={activeTab === 'auctions' ? 'sp-tab sp-tab-active' : 'sp-tab'}
            onClick={() => setActiveTab('auctions')}
          >
            Phiên đấu giá
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'reviews'}
            className={activeTab === 'reviews' ? 'sp-tab sp-tab-active' : 'sp-tab'}
            onClick={() => setActiveTab('reviews')}
          >
            Đánh giá
          </button>
        </div>

        {/* ── Auctions tab ────────────────────────────────────── */}
        {activeTab === 'auctions' && (
          <section aria-label="Phiên đấu giá của người bán">
            {loadingAuctions ? (
              <div className="sp-tab-loading"><Spin /></div>
            ) : auctionsError ? (
              <div className="sp-tab-empty">{auctionsError}</div>
            ) : auctions.length === 0 ? (
              <div className="sp-tab-empty">Không có phiên đấu giá nào đang mở</div>
            ) : (
              <div className="listings">
                {auctions.map((a) => <AuctionCard key={a.id} auction={a} />)}
              </div>
            )}
          </section>
        )}

        {/* ── Reviews tab ─────────────────────────────────────── */}
        {activeTab === 'reviews' && (
          <section aria-label="Đánh giá người bán">
            {loadingReviews ? (
              <div className="sp-tab-loading"><Spin /></div>
            ) : reviewsError ? (
              <div className="sp-tab-empty">{reviewsError}</div>
            ) : reviews.length === 0 ? (
              <div className="sp-tab-empty">Chưa có đánh giá nào</div>
            ) : (
              <div className="sp-reviews-list">
                {reviews.map((r) => <ReviewItem key={r.id} review={r} />)}
              </div>
            )}
          </section>
        )}

      </div>
    </>
  )
}

export const Component = SellerProfile
