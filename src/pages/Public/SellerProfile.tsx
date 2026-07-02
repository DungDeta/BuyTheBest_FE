import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Button, Spin } from 'antd'
import { MessageOutlined, PictureOutlined } from '@ant-design/icons'
import { privatePost, publicGet } from '@/api/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/useAuthStore'
import type { ErrorResponse } from '@/types/api'
import './seller-profile.css'

interface ProductImage {
  url?: string
  thumbnail_url?: string
  is_primary: boolean
}

interface AuctionProduct {
  id: string
  title: string
  slug: string
  condition: string
  images: ProductImage[]
}

interface Auction {
  id: string
  mode: 'english' | 'dutch' | 'sealed_bid' | 'reverse'
  status: 'scheduled' | 'active'
  starting_price: number
  current_price: number
  bid_count: number
  starts_at: string
  ends_at: string
  product?: AuctionProduct
}

interface Review {
  id: number
  rating: number
  comment: string
  reviewer_name: string
  created_at: string
}

interface SellerProfile {
  id: string
  user_id?: number
  username?: string | null
  shop_name?: string | null
  description?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  shipping_policy?: string | null
  return_policy?: string | null
  rating_avg?: number | null
  review_count?: number | null
  total_revenue?: number | null
  total_auctions?: number | null
  active_auctions?: number | null
  successful_transactions?: number | null
  member_since?: string | null
  open_auctions?: Auction[] | null
  latest_reviews?: Review[] | null
}

type TabId = 'auctions' | 'reviews'

function formatPrice(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatDate(iso: string): string {
  if (!iso) return 'Chưa cập nhật'
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatJoinDate(iso: string): string {
  if (!iso) return 'Chưa cập nhật'
  return new Date(iso).toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  })
}

function renderStars(rating: number): string {
  const full = Math.round(Math.max(0, Math.min(5, rating)))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

function cleanText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getSellerDisplayName(seller: SellerProfile): string {
  const name = cleanText(seller.shop_name) || cleanText(seller.username)
  if (name) return name
  if (typeof seller.user_id === 'number') return `Người bán #${seller.user_id}`
  return seller.id ? `Người bán #${seller.id.slice(0, 8)}` : 'Người bán'
}

function getInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || 'BT'
}

function modeLabel(mode: Auction['mode']): string {
  switch (mode) {
    case 'english':
      return 'Đấu giá tăng'
    case 'dutch':
      return 'Giảm dần'
    case 'sealed_bid':
      return 'Đấu giá kín'
    case 'reverse':
      return 'Đấu giá ngược'
  }
}

function primaryImage(product?: AuctionProduct): string | undefined {
  const images = product?.images ?? []
  const image = images.find((item) => item.is_primary) ?? images[0]
  return image?.thumbnail_url || image?.url
}

function AuctionCard({ auction }: { auction: Auction }) {
  const [imageFailed, setImageFailed] = useState(false)
  const title = auction.product?.title ?? `Phiên #${auction.id.slice(0, 8)}`
  const imageURL = primaryImage(auction.product)
  const price = auction.mode === 'sealed_bid'
    ? 'Giá được bảo mật'
    : formatPrice(auction.current_price)

  return (
    <Link to={`/auctions/${auction.id}`} className="sp-auction-card">
      <div className="sp-auction-media">
        {imageURL && !imageFailed ? (
          <img
            src={imageURL}
            alt={title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="sp-auction-media-empty" aria-label="Sản phẩm chưa có ảnh">
            <PictureOutlined />
          </span>
        )}
        <span className={`sp-mode-badge sp-mode-badge--${auction.mode}`}>
          {modeLabel(auction.mode)}
        </span>
        <span className={`sp-status-badge sp-status-badge--${auction.status}`}>
          {auction.status === 'active' ? 'Đang mở' : 'Sắp diễn ra'}
        </span>
      </div>
      <div className="sp-auction-content">
        <h3>{title}</h3>
        <strong className="sp-auction-price">{price}</strong>
        <div className="sp-auction-meta">
          <span>{auction.bid_count} lượt trả giá</span>
          <span>Kết thúc {formatDate(auction.ends_at)}</span>
        </div>
      </div>
    </Link>
  )
}

function ReviewItem({ review }: { review: Review }) {
  return (
    <article className="sp-review-item">
      <div className="sp-review-header">
        <span className="sp-review-stars" aria-label={`${review.rating} sao`}>
          {renderStars(review.rating)}
        </span>
        <span className="sp-review-reviewer">{review.reviewer_name || 'Người mua'}</span>
        <time className="sp-review-date" dateTime={review.created_at}>
          {formatDate(review.created_at)}
        </time>
      </div>
      {review.comment && <p className="sp-review-comment">{review.comment}</p>}
    </article>
  )
}

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const currentUser = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())

  const [seller, setSeller] = useState<SellerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [contacting, setContacting] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [bannerFailed, setBannerFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('auctions')

  useDocumentTitle(seller ? getSellerDisplayName(seller) : 'Hồ sơ người bán')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchSeller() {
      setLoading(true)
      setError(null)
      try {
        const res = await publicGet<SellerProfile>(`/sellers/${id}`)
        if (!cancelled) setSeller(res.data ?? null)
      } catch (err) {
        if (!cancelled) {
          const apiError = err as ErrorResponse
          setError(
            apiError.code === 404
              ? 'Không tìm thấy người bán.'
              : apiError.error || 'Không thể tải thông tin người bán.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchSeller()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleMessageSeller() {
    if (!seller || contacting) return
    if (typeof seller.user_id !== 'number') {
      message.error('Không thể xác định người bán để mở cuộc trò chuyện')
      return
    }
    setContacting(true)
    try {
      const res = await privatePost<{ id: number }>('/conversations', {
        seller_id: seller.user_id,
      })
      if (res.data?.id) {
        navigate(`/chat?conversation=${res.data.id}`)
      }
    } catch (err) {
      const apiError = err as ErrorResponse
      message.error(apiError.error || 'Không thể mở cuộc trò chuyện')
    } finally {
      setContacting(false)
    }
  }

  if (loading) {
    return (
      <div className="sp-loading" aria-label="Đang tải">
        <Spin size="large" />
      </div>
    )
  }

  if (error || !seller) {
    return (
      <div className="sp-error">
        <p className="sp-error-msg">{error ?? 'Không tìm thấy người bán.'}</p>
        <Link to="/" className="sp-back-link">← Quay lại trang chủ</Link>
      </div>
    )
  }

  const displayName = getSellerDisplayName(seller)
  const avatarLetters = getInitials(displayName)
  const isOwner = currentUser?.id === seller.id
  const auctions = seller.open_auctions ?? []
  const reviews = seller.latest_reviews ?? []
  const ratingAvg = seller.rating_avg ?? 0
  const reviewCount = seller.review_count ?? 0
  const successfulTransactions = seller.successful_transactions ?? 0

  return (
    <>
      <nav className="sp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="sp-bc-sep" aria-hidden="true">/</span>
        <span>Người bán</span>
        <span className="sp-bc-sep" aria-hidden="true">/</span>
        <span className="sp-bc-current" aria-current="page">{displayName}</span>
      </nav>

      <main className="sp-shell">
        <section className="sp-info-card" aria-labelledby="sp-shop-name">
          {seller.banner_url && !bannerFailed && (
            <img
              className="sp-banner"
              src={seller.banner_url}
              alt={`Ảnh bìa ${displayName}`}
              onError={() => setBannerFailed(true)}
            />
          )}
          <div className="sp-info-inner">
            <div className="sp-info-top">
              <div className="sp-avatar">
                {seller.avatar_url && !avatarFailed ? (
                  <img
                    src={seller.avatar_url}
                    alt={`Ảnh đại diện ${displayName}`}
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  avatarLetters
                )}
              </div>
              <div className="sp-info-body">
                <div className="sp-title-row">
                  <div>
                    <h1 className="sp-shop-name" id="sp-shop-name">{displayName}</h1>
                    <span className="sp-member-since">
                      Tham gia từ {formatJoinDate(seller.member_since ?? '')}
                    </span>
                  </div>
                  {isAuthenticated && !isOwner && (
                    <Button
                      type="primary"
                      icon={<MessageOutlined />}
                      loading={contacting}
                      onClick={() => void handleMessageSeller()}
                    >
                      Nhắn tin
                    </Button>
                  )}
                </div>
                {seller.description && <p className="sp-description">{seller.description}</p>}
              </div>
            </div>

            <div className="sp-stats-row">
              <div className="sp-stat">
                <span className="sp-stat-val">{auctions.length.toLocaleString('vi-VN')}</span>
                <span className="sp-stat-label">Phiên đang mở</span>
              </div>
              <div className="sp-stat-divider" aria-hidden="true" />
              <div className="sp-stat">
                <span className="sp-stat-val">
                  {successfulTransactions.toLocaleString('vi-VN')}
                </span>
                <span className="sp-stat-label">Giao dịch thành công</span>
              </div>
              <div className="sp-stat-divider" aria-hidden="true" />
              <div className="sp-stat">
                <span className="sp-stat-val sp-stars">
                  {renderStars(ratingAvg)}
                  <span className="sp-rating-num">{ratingAvg.toFixed(1)}</span>
                </span>
                <span className="sp-stat-label">Đánh giá trung bình</span>
              </div>
              <div className="sp-stat-divider" aria-hidden="true" />
              <div className="sp-stat">
                <span className="sp-stat-val">
                  {reviewCount.toLocaleString('vi-VN')}
                </span>
                <span className="sp-stat-label">Lượt đánh giá</span>
              </div>
            </div>

            {(seller.shipping_policy || seller.return_policy) && (
              <div className="sp-policies">
                {seller.shipping_policy && (
                  <div>
                    <h2>Chính sách vận chuyển</h2>
                    <p>{seller.shipping_policy}</p>
                  </div>
                )}
                {seller.return_policy && (
                  <div>
                    <h2>Chính sách đổi trả</h2>
                    <p>{seller.return_policy}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="sp-tabs" role="tablist" aria-label="Nội dung người bán">
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'auctions'}
            className={activeTab === 'auctions' ? 'sp-tab sp-tab-active' : 'sp-tab'}
            onClick={() => setActiveTab('auctions')}
          >
            Phiên đang mở <span>{auctions.length}</span>
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'reviews'}
            className={activeTab === 'reviews' ? 'sp-tab sp-tab-active' : 'sp-tab'}
            onClick={() => setActiveTab('reviews')}
          >
            Đánh giá <span>{reviewCount}</span>
          </button>
        </div>

        {activeTab === 'auctions' && (
          <section aria-label="Phiên đấu giá đang mở của người bán">
            {auctions.length === 0 ? (
              <div className="sp-tab-empty">Người bán chưa có phiên đấu giá nào đang mở</div>
            ) : (
              <div className="sp-auction-grid">
                {auctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'reviews' && (
          <section aria-label="Đánh giá gần đây về người bán">
            {reviews.length === 0 ? (
              <div className="sp-tab-empty">Chưa có đánh giá nào</div>
            ) : (
              <div className="sp-reviews-list">
                {reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  )
}

export const Component = SellerProfile
