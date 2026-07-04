import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Auction } from '@/types/auction'
import { getDemoProductImage } from '@/utils/demoProductImages'
import { getProductConditionLabel } from '@/utils/productDisplay'

interface ProductHeroProps {
  auction: Auction
}

function modeBadgeClass(mode: Auction['mode']): string {
  switch (mode) {
    case 'english':    return 'mode-badge E'
    case 'dutch':      return 'mode-badge D'
    case 'sealed_bid': return 'mode-badge S'
    case 'reverse':    return 'mode-badge R'
  }
}

function modeBadgeLabel(mode: Auction['mode']): string {
  switch (mode) {
    case 'english':    return 'Giá tăng dần'
    case 'dutch':      return 'Giá giảm dần'
    case 'sealed_bid': return 'Đấu giá kín'
    case 'reverse':    return 'Đấu giá ngược'
  }
}

function sellerInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

export function ProductHero({ auction }: ProductHeroProps) {
  const { product, seller, mode, bid_count, id, starts_at } = auction

  const images = product?.images ?? []
  const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order)
  const primaryImage = sortedImages.find((img) => img.is_primary) ?? sortedImages[0] ?? null
  const assetLabel = product?.title ?? `#${id.slice(0, 8).toUpperCase()}`
  const title = mode === 'reverse'
    ? `Yêu cầu đấu giá ngược tài sản ${assetLabel}`
    : product?.title ?? `Phiên đấu giá #${id.slice(0, 8)}`

  const [activeIndex, setActiveIndex] = useState(0)
  const displayImage = sortedImages[activeIndex] ?? primaryImage
  const displayImageUrl = displayImage?.url || displayImage?.thumbnail_url || getDemoProductImage(title)

  const publicLabel = `Mã phiên ${id.slice(0, 8).toUpperCase()}`
  const isHot = bid_count > 10
  const reverseBudget = auction.budget_cap ?? auction.starting_price
  const productSpecs = mode === 'reverse'
    ? [
        { label: 'Phương thức', value: modeBadgeLabel(mode) },
        { label: 'Ngân sách tối đa', value: formatVnd(reverseBudget) },
        {
          label: 'Giá tốt nhất hiện tại',
          value: auction.bid_count > 0 ? formatVnd(auction.current_price) : 'Chưa có báo giá',
        },
        { label: 'Bước giảm tối thiểu', value: formatVnd(auction.min_decrement ?? 0) },
      ]
    : [
        ...(product?.condition
          ? [{ label: 'Tình trạng', value: getProductConditionLabel(product.condition) }]
          : []),
        { label: 'Phương thức', value: modeBadgeLabel(mode) },
        { label: 'Giá khởi điểm', value: formatVnd(auction.starting_price) },
        ...(auction.buy_now_price != null
          ? [{ label: 'Mua ngay', value: formatVnd(auction.buy_now_price) }]
          : []),
      ]

  return (
    <div className="product-hero">
      <div className="auction-product-grid">

        <div className="gallery">
          <div className="gallery__main" aria-label={`Hình ảnh: ${title}`}>
            <div className="gallery__badges">
              <span className={modeBadgeClass(mode)}>{modeBadgeLabel(mode)}</span>
              {isHot && <span className="hot-badge">HOT</span>}
            </div>

            {displayImageUrl ? (
              <img
                src={displayImageUrl}
                alt={title}
                className="gallery__main-img"
              />
            ) : (
              <div className="gallery__placeholder">
                <span className="gallery__placeholder-title">{title}</span>
                <span className="gallery__placeholder-sub">
                  {getProductConditionLabel(product?.condition, '')}
                </span>
              </div>
            )}
          </div>

          {sortedImages.length > 1 && (
            <div className="gallery__thumbs" role="list" aria-label="Ảnh thu nhỏ">
              {sortedImages.slice(0, 6).map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  role="listitem"
                  className={`gallery__thumb${activeIndex === i ? ' gallery__thumb--active' : ''}`}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Xem ảnh ${i + 1}`}
                  aria-pressed={activeIndex === i}
                >
                  <img src={img.thumbnail_url} alt="" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <div className="product-info__ref">
            {publicLabel} · Đăng {dayjs(starts_at).format('DD/MM/YYYY HH:mm')}
          </div>

          <h1 className="product-info__title">{title}</h1>

          <div className="product-info__meta">
            {product?.condition && (
              <span className="condition-badge">
                {getProductConditionLabel(product.condition)}
              </span>
            )}
            {(auction.view_count ?? 0) > 0 && (
              <>
                <span className="meta-dot" aria-hidden="true">·</span>
                <span className="meta-stat" aria-label="Lượt xem">
                  {auction.view_count} lượt xem
                </span>
              </>
            )}
            {(auction.watcher_count ?? 0) > 0 && (
              <>
                <span className="meta-dot" aria-hidden="true">·</span>
                <span className="meta-stat" aria-label="Người theo dõi">
                  {auction.watcher_count} theo dõi
                </span>
              </>
            )}
          </div>

          <div className="product-specs">
            {productSpecs.map((spec) => (
              <div className="product-spec" key={spec.label}>
                <span className="product-spec__label">{spec.label}</span>
                <span className="product-spec__value">{spec.value}</span>
              </div>
            ))}
          </div>

          {seller && (
            <div className="seller-card">
              {seller.avatar_url ? (
                <img
                  src={seller.avatar_url}
                  alt={seller.display_name}
                  className="seller-card__avatar"
                />
              ) : (
                <div className="seller-card__avatar seller-card__avatar--initials" aria-hidden="true">
                  {sellerInitials(seller.display_name)}
                </div>
              )}
              <div className="seller-card__info">
                <div className="seller-card__name">{seller.display_name}</div>
                <div className="seller-card__meta">
                  ★ {(seller.avg_rating ?? 0).toFixed(1)} · {seller.total_sales ?? 0} giao dịch
                </div>
              </div>
              <Link
                to={`/sellers/${seller.id}`}
                className="seller-card__link"
                aria-label={`Xem shop của ${seller.display_name}`}
              >
                Xem shop →
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
