import { useState } from 'react'
import { App } from 'antd'
import dayjs from 'dayjs'
import { useBid } from '@/hooks/useBid'
import type { Auction, BidActionResponse } from '@/types/auction'

interface SealedBidFormProps {
  auction: Auction
  onBidPlaced?: (amount: number, data?: BidActionResponse) => void
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

export function SealedBidForm({ auction, onBidPlaced }: SealedBidFormProps) {
  const { message } = App.useApp()
  const { placeBid, loading, error } = useBid(auction.id)

  const [bidInput, setBidInput] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const revealLabel = auction.reveal_at
    ? dayjs(auction.reveal_at).format('DD/MM/YYYY HH:mm')
    : 'chưa xác định'

  async function handleSubmit() {
    const parsed = parseInt(bidInput.replace(/\D/g, ''), 10)
    if (isNaN(parsed) || parsed < auction.starting_price) {
      message.error(`Giá đặt tối thiểu là ${formatVnd(auction.starting_price)}`)
      return
    }
    const result = await placeBid(parsed)
    if (!result.ok) return
    setHasSubmitted(true)
    if (onBidPlaced) onBidPlaced(parsed, result.data)
  }

  return (
    <div className="bid-form">
      <div className="bid-current">
        <div className="bid-current__left">
          <span className="bid-current__label">Đấu giá kín</span>
          <span className="sealed-hidden-price">Giá đặt đang được giữ kín</span>
          <span className="bid-current__delta">Giá chỉ mở khi phiên đóng</span>
        </div>
        <span className="mode-badge S" aria-label="Phương thức đấu giá kín">Đấu giá kín</span>
      </div>

      <div className="sealed-info" role="note">
        <span className="sealed-info__label">Quy tắc</span>
        <span>
          Mỗi người chỉ được đặt giá <strong>một lần duy nhất</strong>. Không ai thấy
          mức giá của người khác cho đến khi phiên đóng.
        </span>
      </div>

      {hasSubmitted ? (
        <div className="sealed-success" role="status" aria-live="polite">
          Giá đặt đã được ghi nhận. Chờ kết quả công bố.
        </div>
      ) : (
        <>
          <div>
            <div className="bid-input-row sealed-submit-row">
              <input
                type="text"
                inputMode="numeric"
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập số tiền…"
                aria-label={`Nhập giá đặt kín, tối thiểu ${formatVnd(auction.starting_price)}`}
              />
              <button
                type="button"
                className="bid-btn bid-btn--sealed"
                onClick={handleSubmit}
                disabled={loading || bidInput === ''}
                aria-label="Gửi giá đặt kín"
              >
                {loading ? '…' : 'Gửi giá'}
              </button>
            </div>
            <p className="bid-input-hint sealed-input-hint">
              Giá khởi điểm: {formatVnd(auction.starting_price)}
            </p>
          </div>

          <p className="sealed-note">Không thể thay đổi sau khi gửi</p>
        </>
      )}

      <div className="sealed-stats">
        <span><strong>{auction.bid_count}</strong> người đã đặt giá</span>
        <span>Mở kết quả: {revealLabel}</span>
      </div>

      {error !== null && (
        <div className="bid-error" role="alert">{error}</div>
      )}
    </div>
  )
}
