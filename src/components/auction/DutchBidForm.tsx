import { useState, useEffect, useRef } from 'react'
import { useBid } from '@/hooks/useBid'
import type { Auction, BidActionResponse } from '@/types/auction'

interface DutchBidFormProps {
  auction: Auction
  onBidPlaced?: (amount: number, data?: BidActionResponse) => void
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${padTwo(m)}:${padTwo(s)}`
}

export function DutchBidForm({ auction, onBidPlaced }: DutchBidFormProps) {
  const { placeBid, loading, error } = useBid(auction.id)

  const intervalSeconds = auction.decrement_interval_seconds ?? 30
  const [countdown, setCountdown] = useState(intervalSeconds)

  const prevPriceRef = useRef(auction.current_price)
  useEffect(() => {
    if (auction.current_price !== prevPriceRef.current) {
      prevPriceRef.current = auction.current_price
      setCountdown(intervalSeconds)
    }
  }, [auction.current_price, intervalSeconds])

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return intervalSeconds
        return prev - 1
      })
    }, 1_000)
    return () => clearInterval(id)
  }, [intervalSeconds])

  async function handleAccept() {
    const result = await placeBid(auction.current_price)
    if (result.ok && onBidPlaced) onBidPlaced(auction.current_price, result.data)
  }

  const decrement = auction.min_decrement ?? 0

  return (
    <div className="bid-form">
      <div className="bid-current">
        <div className="bid-current__left">
          <span className="bid-current__label">Giá hiện tại (đang giảm)</span>
          <span className="bid-current__price bid-current__price--dutch">
            {formatVnd(auction.current_price)}
          </span>
          {decrement > 0 && intervalSeconds > 0 && (
            <span className="bid-current__delta">
              ↓ Giảm {formatVnd(decrement)} mỗi {intervalSeconds}s
            </span>
          )}
        </div>
        <span className="mode-badge D" aria-label="Phương thức đấu giá giảm dần">Giá giảm dần</span>
      </div>

      <div className="dutch-info" role="note">
        Giá giảm dần: người đầu tiên chấp nhận mức giá hiện tại sẽ thắng phiên đấu giá.
      </div>

      <div className="dutch-timer" aria-label="Thời gian đến lần giảm giá tiếp theo">
        <div className="dutch-timer__label">Giá giảm tiếp trong</div>
        <div className="dutch-timer__value" aria-live="polite">
          {formatCountdown(countdown)}
        </div>
      </div>

      <button
        type="button"
        className="bid-btn bid-btn--full bid-btn--dutch"
        onClick={handleAccept}
        disabled={loading}
        aria-label={`Chấp nhận giá hiện tại ${formatVnd(auction.current_price)}`}
      >
        {loading ? 'Đang xử lý…' : 'Chấp nhận giá hiện tại →'}
      </button>

      <div className="bid-input-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Khởi điểm: {formatVnd(auction.starting_price)}</span>
        {auction.end_price != null && (
          <span>Giá sàn: {formatVnd(auction.end_price)}</span>
        )}
      </div>

      {error !== null && (
        <div className="bid-error" role="alert">{error}</div>
      )}
    </div>
  )
}
