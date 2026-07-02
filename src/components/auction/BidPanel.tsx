import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { EnglishBidForm } from '@/components/auction/EnglishBidForm'
import { DutchBidForm } from '@/components/auction/DutchBidForm'
import { SealedBidForm } from '@/components/auction/SealedBidForm'
import { ReverseBidForm } from '@/components/auction/ReverseBidForm'
import { formatParticipantLabel, isSelfBidder } from '@/utils/auctionIdentity'
import type { Auction, AuctionConnectionState, BidActionResponse } from '@/types/auction'

interface BidPanelProps {
  auction: Auction
  isLoggedIn: boolean
  currentUserId: string | null
  currentBidderLabel: string | null
  currentParticipantId: number | null
  connectionState: AuctionConnectionState
  onBidPlaced?: (amount: number, data?: BidActionResponse) => void
}

interface ModeFormProps {
  auction: Auction
  currentBidderLabel: string | null
  currentParticipantId: number | null
  onBidPlaced?: (amount: number, data?: BidActionResponse) => void
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ'
}

const MODE_SUMMARY = {
  english: { code: 'E', label: 'Giá tăng dần', priceLabel: 'Giá hiện tại' },
  dutch: { code: 'D', label: 'Giá giảm dần', priceLabel: 'Giá hiện tại' },
  sealed_bid: { code: 'S', label: 'Đấu giá kín', priceLabel: 'Giá khởi điểm' },
  reverse: { code: 'R', label: 'Đấu giá ngược', priceLabel: 'Giá tốt nhất' },
} as const

function ReadOnlyBidSummary({ auction }: { auction: Auction }) {
  const mode = MODE_SUMMARY[auction.mode]

  return (
    <div className="bid-form">
      <div className="bid-current">
        <div className="bid-current__left">
          <span className="bid-current__label">{mode.priceLabel}</span>
          <span className="bid-current__price">{formatVnd(auction.current_price)}</span>
        </div>
        <span className={`mode-badge ${mode.code}`}>
          {mode.label}
        </span>
      </div>
      <div className="bid-gate">
        <span className="bid-gate__msg">Đăng nhập để đặt giá</span>
        <Link to="/login" className="bid-gate__login-btn" aria-label="Đến trang đăng nhập">
          Đăng nhập →
        </Link>
      </div>
    </div>
  )
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function ResultPanel({
  auction,
  currentUserId,
  currentBidderLabel,
  currentParticipantId,
}: {
  auction: Auction
  currentUserId: string | null
  currentBidderLabel: string | null
  currentParticipantId: number | null
}) {
  if (auction.status === 'cancelled') {
    return (
      <div className="result-panel">
        <span className="result-panel__cancelled-badge">Phiên đã bị huỷ</span>
      </div>
    )
  }

  const winnerLabel = auction.winner_label ?? null
  const hasWinner = winnerLabel !== null || auction.bid_count > 0
  const isWinner =
    auction.winner_is_self === true ||
    isSelfBidder(
      {
        user_id: auction.winner_user_id,
        bidder_id: auction.winner_id,
        bidder_label: winnerLabel,
      },
      {
        userId: currentUserId,
        bidderLabel: currentBidderLabel,
        participantId: currentParticipantId,
      },
    )
  const checkoutHref =
    auction.checkout_url ??
    (auction.order_id != null ? `/orders/${auction.order_id}/checkout` : '/orders')

  return (
    <div className="result-panel">
      <span className="result-panel__ended-badge">Phiên đã kết thúc</span>
      <div>
        <div className="result-panel__label">Giá cuối</div>
        <div className="result-panel__price">{formatVnd(auction.current_price)}</div>
      </div>
      <div>
        <div className="result-panel__label">Người thắng</div>
        {hasWinner ? (
          <div className="result-panel__winner">
            {isWinner ? 'Bạn' : winnerLabel ? formatParticipantLabel(winnerLabel) : 'Đang chờ công bố'}
          </div>
        ) : (
          <div className="result-panel__no-winner">Không có người thắng</div>
        )}
      </div>
      {auction.payment_deadline && isWinner && (
        <div className="result-panel__deadline">
          Thanh toán trước {dayjs(auction.payment_deadline).format('DD/MM/YYYY HH:mm')}
        </div>
      )}
      {isWinner && isExternalUrl(checkoutHref) && (
        <a href={checkoutHref} className="result-panel__cta result-panel__cta--pay">
          Thanh toán ngay →
        </a>
      )}
      {isWinner && !isExternalUrl(checkoutHref) && (
        <Link to={checkoutHref} className="result-panel__cta result-panel__cta--pay">
          Thanh toán ngay →
        </Link>
      )}
      {!isWinner && (
        <Link to="/auctions?sort=ending_soon" className="result-panel__cta">
          Xem phiên tương tự →
        </Link>
      )}
    </div>
  )
}

function ModeForm({
  auction,
  currentBidderLabel,
  currentParticipantId,
  onBidPlaced,
}: ModeFormProps) {
  switch (auction.mode) {
    case 'english':
      return (
        <EnglishBidForm
          auction={auction}
          currentBidderLabel={currentBidderLabel}
          currentParticipantId={currentParticipantId}
          onBidPlaced={onBidPlaced}
        />
      )
    case 'dutch':
      return <DutchBidForm auction={auction} onBidPlaced={onBidPlaced} />
    case 'sealed_bid':
      return <SealedBidForm auction={auction} onBidPlaced={onBidPlaced} />
    case 'reverse':
      return <ReverseBidForm auction={auction} onBidPlaced={onBidPlaced} />
  }
}

export function BidPanel({
  auction,
  isLoggedIn,
  currentUserId,
  currentBidderLabel,
  currentParticipantId,
  connectionState,
  onBidPlaced,
}: BidPanelProps) {
  const isEnded = auction.status === 'ended' || auction.status === 'closed_bin'
  const isCancelled = auction.status === 'cancelled'
  const isScheduled = auction.status === 'scheduled'

  const isSeller =
    currentUserId !== null &&
    (String(auction.seller?.id) === currentUserId ||
      String(auction.seller_id) === currentUserId ||
      String(auction.creator_id) === currentUserId)

  function renderBody() {
    if (isEnded || isCancelled) {
      return (
        <ResultPanel
          auction={auction}
          currentUserId={currentUserId}
          currentBidderLabel={currentBidderLabel}
          currentParticipantId={currentParticipantId}
        />
      )
    }

    if (isScheduled) {
      return (
        <div className="bid-gate">
          <span className="bid-gate__msg">Phiên chưa bắt đầu</span>
          <span className="bid-gate__date">
            Bắt đầu lúc {dayjs(auction.starts_at).format('DD/MM/YYYY HH:mm')}
          </span>
        </div>
      )
    }

    if (connectionState === 'failed') {
      return (
        <div className="bid-gate" role="alert">
          <span className="bid-gate__msg">Không thể kết nối phòng đấu giá</span>
          <span className="bid-gate__date">Vui lòng tải lại trang để thử lại.</span>
        </div>
      )
    }

    if (!isLoggedIn) {
      return <ReadOnlyBidSummary auction={auction} />
    }

    if (isSeller) {
      return (
        <div className="bid-gate">
          <span className="bid-gate__msg">Bạn là người bán — không thể đặt giá</span>
        </div>
      )
    }

    return (
      <ModeForm
        auction={auction}
        currentBidderLabel={currentBidderLabel}
        currentParticipantId={currentParticipantId}
        onBidPlaced={onBidPlaced}
      />
    )
  }

  const isActive = auction.status === 'active'
  const bidCount = auction.bid_count ?? 0
  const watcherCount = auction.watcher_count ?? 0

  return (
    <div className="bid-panel" aria-label="Đặt giá">
      {renderBody()}

      <div className="bid-panel-footer">
        <span>
          {bidCount} lượt đặt · {watcherCount} đang xem
        </span>
        {isActive && (
          <span
            className={connectionState === 'failed'
              ? 'bid-panel-footer__offline'
              : 'bid-panel-footer__live'}
            aria-label={connectionState === 'failed'
              ? 'Mất kết nối thời gian thực'
              : connectionState === 'connected'
                ? 'Đang diễn ra trực tiếp'
                : 'Đang đồng bộ kết nối'}
          >
            <span
              className={connectionState === 'failed'
                ? 'bid-panel-footer__offline-dot'
                : 'bid-panel-footer__live-dot'}
              aria-hidden="true"
            />
            {connectionState === 'failed'
              ? 'Mất kết nối'
              : connectionState === 'connected'
                ? 'Đang diễn ra'
                : 'Đang đồng bộ'}
          </span>
        )}
      </div>
    </div>
  )
}
