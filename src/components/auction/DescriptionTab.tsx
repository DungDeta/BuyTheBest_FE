import type { Auction } from '@/types/auction'
import { getProductConditionLabel } from '@/utils/productDisplay'

interface DescriptionTabProps {
  auction: Auction
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

export function DescriptionTab({ auction }: DescriptionTabProps) {
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
