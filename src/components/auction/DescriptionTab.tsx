import type { Auction } from '@/types/auction'
import { getProductConditionLabel } from '@/utils/productDisplay'

interface DescriptionTabProps {
  auction: Auction
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function ModeRules({ auction }: { auction: Auction }) {
  switch (auction.mode) {
    case 'english': {
      const increment = auction.min_increment != null ? formatVnd(auction.min_increment) : '—'
      const threshold = auction.anti_snipe_threshold_seconds
      const extension = auction.anti_snipe_extension_seconds
      return (
        <div className="desc-rules">
          <div className="desc-rules__title">Quy tắc đấu giá kiểu Anh</div>
          <ul className="desc-rules__list">
            <li>Mỗi bid phải cao hơn bid hiện tại tối thiểu {increment}</li>
            {threshold > 0 && (
              <li>
                Bid trong {threshold}s cuối sẽ gia hạn thêm {extension}s
                (chống snipe)
              </li>
            )}
            {auction.max_extensions > 0 && (
              <li>Tối đa {auction.max_extensions} lần gia hạn</li>
            )}
            {auction.buy_now_price != null && (
              <li>Mua ngay với giá {formatVnd(auction.buy_now_price)}</li>
            )}
          </ul>
        </div>
      )
    }

    case 'dutch': {
      const decrement = auction.min_decrement != null ? formatVnd(auction.min_decrement) : '—'
      const interval = auction.decrement_interval_seconds ?? '—'
      return (
        <div className="desc-rules">
          <div className="desc-rules__title">Quy tắc đấu giá kiểu Hà Lan</div>
          <ul className="desc-rules__list">
            <li>Giá giảm {decrement} mỗi {interval}s</li>
            <li>Người đầu tiên chấp nhận thắng</li>
            {auction.end_price != null && (
              <li>Giá sàn: {formatVnd(auction.end_price)}</li>
            )}
          </ul>
        </div>
      )
    }

    case 'sealed_bid': {
      const revealAt = auction.reveal_at
        ? auction.reveal_at
        : null
      return (
        <div className="desc-rules">
          <div className="desc-rules__title">Quy tắc đấu giá kín</div>
          <ul className="desc-rules__list">
            <li>Đặt giá kín, mỗi người chỉ thấy bid của mình</li>
            {revealAt && (
              <li>Mở niêm phong lúc {revealAt}</li>
            )}
            <li>Bid cao nhất thắng sau khi mở niêm phong</li>
          </ul>
        </div>
      )
    }

    case 'reverse': {
      const budget = auction.budget_cap != null ? formatVnd(auction.budget_cap) : '—'
      return (
        <div className="desc-rules">
          <div className="desc-rules__title">Quy tắc đấu giá ngược</div>
          <ul className="desc-rules__list">
            <li>Seller cạnh tranh giá thấp nhất</li>
            <li>Ngân sách tối đa của buyer: {budget}</li>
            <li>Seller bid thấp nhất trong ngân sách thắng hợp đồng</li>
          </ul>
        </div>
      )
    }
  }
}

export function DescriptionTab({ auction }: DescriptionTabProps) {
  const description = auction.product?.title ?? null

  return (
    <div className="tab-content desc-tab" aria-label="Mô tả chi tiết">
      {description && (
        <div className="desc-product">
          <div className="desc-product__title">{description}</div>
          {auction.product?.condition && (
            <div className="desc-product__condition">
              <span>Tình trạng</span>
              <strong>{getProductConditionLabel(auction.product.condition)}</strong>
            </div>
          )}
        </div>
      )}

      <ModeRules auction={auction} />

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
