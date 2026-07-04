import { useState } from 'react'
import { App } from 'antd'
import { useBid } from '@/hooks/useBid'
import type { Auction, BidActionResponse } from '@/types/auction'

interface ReverseBidFormProps {
  auction: Auction
  onBidPlaced?: (amount: number, data?: BidActionResponse) => void
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

export function ReverseBidForm({ auction, onBidPlaced }: ReverseBidFormProps) {
  const { message } = App.useApp()
  const { placeBid, loading, error } = useBid(auction.id)

  const [bidInput, setBidInput] = useState('')
  const [productIdInput, setProductIdInput] = useState('')

  const budget = auction.budget_cap ?? auction.starting_price
  const minDecrement = auction.min_decrement ?? 0
  const hasExistingBid = auction.bid_count > 0
  const currentBestPrice = hasExistingBid ? auction.current_price : null
  const maxAllowed = hasExistingBid
    ? Math.max(auction.current_price - minDecrement, 1)
    : budget
  const priceHint = hasExistingBid
    ? `Giá báo tối đa ${formatVnd(maxAllowed)}`
    : `Lượt đầu có thể báo tối đa ${formatVnd(maxAllowed)}`

  async function handleSubmit() {
    const parsed = parseInt(bidInput.replace(/\D/g, ''), 10)
    const productId = parseInt(productIdInput, 10)

    if (isNaN(productId) || productId <= 0) {
      message.error('Vui lòng nhập mã sản phẩm hợp lệ')
      return
    }
    if (isNaN(parsed) || parsed <= 0 || parsed > maxAllowed) {
      message.error(`Giá báo không được vượt quá ${formatVnd(maxAllowed)}`)
      return
    }

    const result = await placeBid(parsed, productId)
    if (result.ok && onBidPlaced) onBidPlaced(parsed, result.data)
  }

  return (
    <div className="bid-form">
      <div className="bid-current">
        <div className="bid-current__left">
          <span className="bid-current__label">Ngân sách người mua</span>
          <span className="bid-current__price">{formatVnd(budget)}</span>
          <span className="bid-current__delta">Người bán cạnh tranh bằng mức giá thấp</span>
        </div>
        <span className="mode-badge R" aria-label="Phương thức đấu giá ngược">Đấu giá ngược</span>
      </div>

      <div className="reverse-info" role="note">
        Người mua đặt yêu cầu và ngân sách. Người bán cạnh tranh bằng mức giá phù hợp nhất.
      </div>

      <div className="reverse-lowest" aria-label="Giá tốt nhất hiện tại">
        <span className="reverse-lowest__label">
          {currentBestPrice === null ? 'Chưa có báo giá' : 'Giá tốt nhất hiện tại'}
        </span>
        <span className="reverse-lowest__price">
          {currentBestPrice === null ? formatVnd(budget) : formatVnd(currentBestPrice)}
        </span>
      </div>

      <div>
        <div className="bid-input-row">
          <input
            type="number"
            min={1}
            value={productIdInput}
            onChange={(e) => setProductIdInput(e.target.value)}
            placeholder="Mã sản phẩm của bạn…"
            aria-label="Mã sản phẩm (product ID)"
          />
        </div>
        <p className="bid-input-hint">Mã sản phẩm của bạn</p>
      </div>

      <div>
        <div className="bid-input-row">
          <input
            type="text"
            inputMode="numeric"
            value={bidInput}
            onChange={(e) => setBidInput(e.target.value.replace(/\D/g, ''))}
            placeholder="Giá của bạn…"
            aria-label={`Nhập giá báo, tối đa ${formatVnd(maxAllowed)}`}
          />
          <button
            type="button"
            className="bid-btn bid-btn--reverse"
            onClick={handleSubmit}
            disabled={loading || bidInput === '' || productIdInput === ''}
            aria-label="Gửi báo giá"
          >
            {loading ? '…' : 'Gửi →'}
          </button>
        </div>
        <p className="bid-input-hint">
          {priceHint}
          {hasExistingBid && minDecrement > 0
            ? ` · thấp hơn giá tốt nhất ít nhất ${formatVnd(minDecrement)}`
            : ''}
        </p>
      </div>

      {auction.bid_count > 0 && (
        <p className="bid-input-hint">{auction.bid_count} người bán đang cạnh tranh</p>
      )}

      {error !== null && (
        <div className="bid-error" role="alert">{error}</div>
      )}
    </div>
  )
}
