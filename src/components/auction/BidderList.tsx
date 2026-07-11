import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { publicGet } from '@/api/api'
import { formatParticipantLabel, isSelfBidder } from '@/utils/auctionIdentity'
import type { AuctionMode, Participant } from '@/types/auction'

interface BidderListProps {
  auctionId: string
  currentUserId: string | null
  currentBidderLabel: string | null
  currentParticipantId: number | null
  realtimeCount: number
  onCountLoaded?: (count: number) => void
  mode: AuctionMode
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function participantAmount(participant: Participant, mode: AuctionMode): string {
  const amount = mode === 'reverse'
    ? participant.best_amount
    : participant.highest_amount
  return typeof amount === 'number' ? formatVnd(amount) : '—'
}

const DISPLAY_LIMIT = 10

export function BidderList({
  auctionId,
  currentUserId,
  currentBidderLabel,
  currentParticipantId,
  realtimeCount,
  onCountLoaded,
  mode,
}: BidderListProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchParticipants() {
      setLoading(true)
      try {
        const res = await publicGet<{ items: Participant[]; participant_count: number }>(
          `/auctions/${auctionId}/participants?limit=50`
        )
        if (!cancelled && res.data) {
          const items = res.data.items ?? []
          const bidders = items.filter((participant) => participant.bid_count > 0)
          const nextTotal = bidders.length
          setParticipants(bidders)
          setTotal(nextTotal)
          onCountLoaded?.(nextTotal)
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchParticipants()
    return () => { cancelled = true }
  }, [auctionId, onCountLoaded, realtimeCount])

  if (loading) {
    return (
      <div className="tab-content tab-content--center" aria-label="Đang tải danh sách người đặt giá">
        <Spin size="small" />
      </div>
    )
  }

  if (participants.length === 0) {
    return (
      <div className="tab-content tab-content--empty">
        <span>{mode === 'reverse' ? 'Chưa có người bán báo giá' : 'Chưa có người đặt giá'}</span>
      </div>
    )
  }

  const displayed = participants.slice(0, DISPLAY_LIMIT)
  const remaining = total - displayed.length

  return (
    <div
      className="tab-content bidder-list"
      aria-label={mode === 'reverse' ? 'Danh sách người bán báo giá' : 'Danh sách người đấu giá'}
      data-testid={mode === 'reverse' ? 'reverse-seller-list' : 'bidder-list'}
    >
      {displayed.map((p, index) => {
        const pos = index + 1
        const participantLabel = formatParticipantLabel(
          p.label,
          mode === 'reverse' ? 'seller' : 'bidder',
        )
        const isCurrentUser = isSelfBidder(p, {
          userId: currentUserId,
          bidderLabel: currentBidderLabel,
          participantId: currentParticipantId,
        })
        const isGold = pos === 1

        return (
          <div
            key={p.label}
            className={`bidder-row${isCurrentUser ? ' bidder-row--self' : ''}`}
            aria-label={`Vị trí ${pos}: ${participantLabel}`}
          >
            <span className={`bidder-row__pos${isGold ? ' gold' : ''}`}>
              #{pos}
            </span>
            <span className="bidder-row__name">
              {isCurrentUser ? `Bạn (${participantLabel})` : participantLabel}
              {p.is_active && (
                <span className="bidder-row__active-dot" aria-label="Đang trực tuyến" />
              )}
            </span>
            <span className="bidder-row__bids">
              {p.bid_count} {mode === 'reverse' ? 'báo giá' : 'lượt đặt'}
            </span>
            <span className="bidder-row__amount">
              {participantAmount(p, mode)}
            </span>
          </div>
        )
      })}

      {remaining > 0 && (
        <div className="bidder-row__more" aria-label={`Còn ${remaining} người khác`}>
          + {remaining} {mode === 'reverse' ? 'người bán khác' : 'người đặt giá khác'}
        </div>
      )}
    </div>
  )
}
