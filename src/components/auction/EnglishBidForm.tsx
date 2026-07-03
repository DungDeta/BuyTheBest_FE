import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import { useBid } from '@/hooks/useBid'
import { useAuthStore } from '@/store/useAuthStore'
import { BidStatusBanner } from '@/components/auction/BidStatusBanner'
import { AutoBidSection } from '@/components/auction/AutoBidSection'
import { isSelfBidder } from '@/utils/auctionIdentity'
import type { Auction, BidActionResponse } from '@/types/auction'

interface EnglishBidFormProps {
  auction: Auction
  currentBidderLabel: string | null
  currentParticipantId: number | null
  onBidPlaced?: (amount: number, data?: BidActionResponse) => void
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatIncrement(amount: number): string {
  return `+${formatVnd(amount)}`
}

export function EnglishBidForm({
  auction,
  currentBidderLabel,
  currentParticipantId,
  onBidPlaced,
}: EnglishBidFormProps) {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const { placeBid, buyNow, loading, error } = useBid(auction.id)
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const minIncrement = auction.min_increment ?? 500_000
  const minBid = auction.current_price + minIncrement
  const delta = auction.current_price - auction.starting_price

  const [bidInput, setBidInput] = useState(String(minBid))

  useEffect(() => {
    setBidInput((currentValue) => {
      const current = parseInt(currentValue.replace(/\D/g, ''), 10)
      return !isNaN(current) && current >= minBid ? currentValue : String(minBid)
    })
  }, [minBid])

  const isLeading = typeof auction.highest_bidder_is_self === 'boolean'
    ? auction.highest_bidder_is_self
    : isSelfBidder(
      {
        bidder_id: auction.highest_bidder_id,
        bidder_label: auction.highest_bidder_label,
      },
      {
        userId,
        bidderLabel: currentBidderLabel,
        participantId: currentParticipantId,
      },
    )

  const hasEverBid = auction.bid_count > 0

  const incrementOptions = [1, 2, 5, 10].map((mult) => ({
    label: formatIncrement(minIncrement * mult),
    value: minIncrement * mult,
  }))

  function applyIncrement(addAmount: number) {
    const current = parseInt(bidInput.replace(/\D/g, ''), 10)
    const base = isNaN(current) ? minBid : current
    setBidInput(String(base + addAmount))
  }

  async function handlePlaceBid() {
    const parsed = parseInt(bidInput.replace(/\D/g, ''), 10)
    if (isNaN(parsed) || parsed < minBid) {
      message.error(`Bid tối thiểu là ${formatVnd(minBid)}`)
      return
    }
    const result = await placeBid(parsed)
    if (result.ok && onBidPlaced) onBidPlaced(parsed, result.data)
  }

  function navigateAfterBuyNow(data?: BidActionResponse) {
    const directUrl = data?.checkout_url ?? data?.payment_url
    if (directUrl) {
      if (/^https?:\/\//.test(directUrl)) {
        window.location.assign(directUrl)
      } else {
        navigate(directUrl)
      }
      return
    }

    if (data?.order_id != null) {
      navigate(`/orders/${data.order_id}/checkout`)
      return
    }

    navigate('/orders')
  }

  function handleBuyNow() {
    const price = auction.buy_now_price
    if (price == null) return
    const feeEstimate = auction.buy_now_fee_estimate ?? auction.fee_estimate ?? null

    modal.confirm({
      title: 'Xác nhận mua ngay',
      content: (
        <div>
          <p>Giá mua ngay: <strong>{formatVnd(price)}</strong></p>
          <p>
            Phí ước tính:{' '}
            <strong>
              {feeEstimate != null ? formatVnd(feeEstimate) : 'sẽ tính chính xác tại checkout'}
            </strong>
          </p>
          <p>
            Tổng tạm tính:{' '}
            <strong>
              {feeEstimate != null
                ? formatVnd(price + feeEstimate)
                : `${formatVnd(price)} + phí checkout`}
            </strong>
          </p>
          <p>Hệ thống sẽ kết thúc phiên và tạo đơn hàng chờ thanh toán.</p>
        </div>
      ),
      okText: 'Mua ngay',
      cancelText: 'Hủy',
      onOk: async () => {
        const result = await buyNow()
        if (!result.ok) {
          throw new Error('BUY_NOW_FAILED')
        }
        if (onBidPlaced) onBidPlaced(price, result.data)
        message.success('Mua ngay thành công, đang chuyển tới checkout')
        navigateAfterBuyNow(result.data)
      },
    })
  }

  return (
    <div className="bid-form">
      <div className="bid-current">
        <div className="bid-current__left">
          <span className="bid-current__label">Giá hiện tại</span>
          <span className="bid-current__price">{formatVnd(auction.current_price)}</span>
          {delta > 0 && (
            <span className="bid-current__delta">
              Cao hơn giá khởi điểm {formatVnd(delta)}
            </span>
          )}
        </div>
        <span className="mode-badge E" aria-label="Phương thức đấu giá tăng dần">
          Giá tăng dần
        </span>
      </div>

      {hasEverBid && (
        <BidStatusBanner
          isLeading={isLeading}
          outbidBy={isLeading ? null : 'người khác'}
        />
      )}

      <div>
        <div className="bid-input-row">
          <input
            type="text"
            inputMode="numeric"
            value={Number(bidInput.replace(/\D/g, '') || 0).toLocaleString('vi-VN')}
            onChange={(e) => setBidInput(e.target.value.replace(/\D/g, ''))}
            aria-label={`Nhập số tiền đặt, tối thiểu ${formatVnd(minBid)}`}
          />
          <button
            type="button"
            className="bid-btn"
            onClick={handlePlaceBid}
            disabled={loading}
            aria-label="Đặt giá"
          >
            {loading ? '…' : 'Đặt giá →'}
          </button>
        </div>
        <p className="bid-input-hint">Tối thiểu {formatVnd(minBid)}</p>
      </div>

      <div className="increment-buttons" role="group" aria-label="Tăng nhanh">
        {incrementOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="increment-btn"
            onClick={() => applyIncrement(opt.value)}
            aria-label={`Thêm ${opt.label}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <AutoBidSection
        auctionId={auction.id}
        minPrice={minBid}
        minIncrement={minIncrement}
      />

      {auction.buy_now_price != null && (
        <button
          type="button"
          className="bid-btn bid-btn--full bid-btn--buy-now"
          onClick={handleBuyNow}
          disabled={loading}
          aria-label={`Mua ngay với giá ${formatVnd(auction.buy_now_price)}`}
        >
          {loading ? '…' : `Mua ngay — ${formatVnd(auction.buy_now_price)}`}
        </button>
      )}

      {error !== null && (
        <div className="bid-error" role="alert">{error}</div>
      )}
    </div>
  )
}
