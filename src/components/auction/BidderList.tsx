import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { publicGet } from '@/api/api'
import { isSelfBidder } from '@/utils/auctionIdentity'
import type { Participant } from '@/types/auction'

interface BidderListProps {
  auctionId: string
  currentUserId: string | null
  currentBidderLabel: string | null
  currentParticipantId: number | null
  onCountLoaded?: (count: number) => void
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

const DISPLAY_LIMIT = 10

export function BidderList({
  auctionId,
  currentUserId,
  currentBidderLabel,
  currentParticipantId,
  onCountLoaded,
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
          `/auctions/${auctionId}/participants`
        )
        if (!cancelled && res.data) {
          const items = res.data.items ?? []
          const nextTotal = res.data.participant_count ?? items.length
          setParticipants(items)
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
  }, [auctionId, onCountLoaded])

  if (loading) {
    return (
      <div className="tab-content tab-content--center" aria-label="Đang tải danh sách bidder">
        <Spin size="small" />
      </div>
    )
  }

  if (participants.length === 0) {
    return (
      <div className="tab-content tab-content--empty">
        <span>Chưa có người tham gia</span>
      </div>
    )
  }

  const displayed = participants.slice(0, DISPLAY_LIMIT)
  const remaining = total - displayed.length

  return (
    <div className="tab-content bidder-list" aria-label="Danh sách người đấu giá">
      {displayed.map((p, index) => {
        const pos = index + 1
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
            aria-label={`Vị trí ${pos}: ${p.label}`}
          >
            <span className={`bidder-row__pos${isGold ? ' gold' : ''}`}>
              #{pos}
            </span>
            <span className="bidder-row__name">
              {isCurrentUser ? `Bạn (${p.label})` : `@${p.label}`}
              {p.is_active && (
                <span className="bidder-row__active-dot" aria-label="Đang trực tuyến" />
              )}
            </span>
            <span className="bidder-row__bids">{p.bid_count} bids</span>
            <span className="bidder-row__amount">{formatVnd(p.highest_amount)}</span>
          </div>
        )
      })}

      {remaining > 0 && (
        <div className="bidder-row__more" aria-label={`Còn ${remaining} người khác`}>
          + {remaining} bidder khác
        </div>
      )}
    </div>
  )
}
