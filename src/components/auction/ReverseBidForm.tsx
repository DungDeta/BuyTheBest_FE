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
  const maxAllowed = auction.current_price - minDecrement

  async function handleSubmit() {
    const parsed = parseInt(bidInput.replace(/\D/g, ''), 10)
    const productId = parseInt(productIdInput, 10)

    if (isNaN(productId) || productId <= 0) {
      message.error('Vui lòng nhập mã sản phẩm hợp lệ')
      return
    }
    if (isNaN(parsed) || parsed >= auction.current_price) {
      message.error(`Giá báo phải thấp hơn ${formatVnd(auction.current_price)}`)
      return
    }

    const result = await placeBid(parsed, productId)
    if (result.ok && onBidPlaced) onBidPlaced(parsed, result.data)
  }

  return (
    <div className="bid-form">
      <div className="bid-current">
        <div className="bid-current__left">
          <span className="bid-current__label">Ngân sách Buyer</span>
          <span className="bid-current__price">{formatVnd(budget)}</span>
          <span className="bid-current__delta">Seller cạnh tranh giá thấp</span>
        </div>
        <span className="mode-badge R" aria-label="Phương thức Reverse">R · Reverse</span>
      </div>

      <div className="reverse-info" role="note">
        🔄 Buyer đặt yêu cầu + ngân sách. Seller cạnh tranh giá thấp nhất.
      </div>

      <div className="reverse-lowest" aria-label="Bid thấp nhất hiện tại">
        <span className="reverse-lowest__label">Bid thấp nhất hiện tại</span>
        <span className="reverse-lowest__price">{formatVnd(auction.current_price)}</span>
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
            aria-label={`Nhập giá báo, phải thấp hơn ${formatVnd(maxAllowed)}`}
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
        <p className="bid-input-hint">Phải thấp hơn {formatVnd(auction.current_price)}</p>
      </div>

      {auction.bid_count > 0 && (
        <p className="bid-input-hint">{auction.bid_count} seller đang cạnh tranh</p>
      )}

      {error !== null && (
        <div className="bid-error" role="alert">{error}</div>
      )}
    </div>
  )
}
