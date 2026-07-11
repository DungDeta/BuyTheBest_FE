import type { Auction } from '@/types/auction'
import { getProductConditionLabel } from '@/utils/productDisplay'
import { getReverseDemand } from '@/utils/reverseAuction'

interface DescriptionTabProps {
  auction: Auction
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

export function DescriptionTab({ auction }: DescriptionTabProps) {
  if (auction.mode === 'reverse') {
    const demand = getReverseDemand(auction)
    const budget = auction.budget_cap ?? auction.starting_price
    const bestPrice = auction.bid_count > 0 ? auction.current_price : null

    return (
      <div
        className="tab-content desc-tab"
        aria-label="Chi tiết nhu cầu mua"
        data-testid="reverse-demand-description-tab"
      >
        <div className="desc-product">
          <span className="desc-product__heading">Yêu cầu từ người mua</span>
          <div className="desc-product__title">{demand.title}</div>
          {demand.description ? (
            <p className="desc-product__body">{demand.description}</p>
          ) : (
            <p className="desc-product__body desc-product__body--empty">
              Người mua chưa bổ sung mô tả chi tiết.
            </p>
          )}
        </div>

        <div className="desc-meta">
          <div className="desc-meta__row">
            <span className="desc-meta__label">Ngân sách tối đa</span>
            <span className="desc-meta__value">{formatVnd(budget)}</span>
          </div>
          <div className="desc-meta__row">
            <span className="desc-meta__label">Giá tốt nhất</span>
            <span className="desc-meta__value">
              {bestPrice == null ? 'Chưa có báo giá' : formatVnd(bestPrice)}
            </span>
          </div>
          <div className="desc-meta__row">
            <span className="desc-meta__label">Bước giảm tối thiểu</span>
            <span className="desc-meta__value">{formatVnd(auction.min_decrement ?? 0)}</span>
          </div>
        </div>
      </div>
    )
  }

  const title = auction.product?.title ?? 'Sản phẩm đấu giá'
  const description = auction.product?.description?.trim()

  return (
    <div className="tab-content desc-tab" aria-label="Mô tả chi tiết">
      <div className="desc-product">
        <span className="desc-product__heading">Mô tả sản phẩm</span>
        <div className="desc-product__title">{title}</div>
        {description ? (
          <p className="desc-product__body">{description}</p>
        ) : (
          <p className="desc-product__body desc-product__body--empty">
            Người bán chưa thêm mô tả chi tiết cho sản phẩm này.
          </p>
        )}
        {auction.product?.condition && (
          <div className="desc-product__condition">
            <span>Tình trạng</span>
            <strong>{getProductConditionLabel(auction.product.condition)}</strong>
          </div>
        )}
      </div>

      <div className="desc-meta">
        <div className="desc-meta__row">
          <span className="desc-meta__label">Giá khởi điểm</span>
          <span className="desc-meta__value">{formatVnd(auction.starting_price)}</span>
        </div>
        {auction.buy_now_price != null && (
          <div className="desc-meta__row">
            <span className="desc-meta__label">Giá mua ngay</span>
            <span className="desc-meta__value">{formatVnd(auction.buy_now_price)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
