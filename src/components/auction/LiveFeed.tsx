import { useEffect, useRef, useState } from 'react'
import { Spin } from 'antd'
import dayjs from 'dayjs'
import { publicGet } from '@/api/api'
import { formatParticipantLabel, isSelfBidder } from '@/utils/auctionIdentity'
import type { BidHistoryItem } from '@/types/auction'

interface LiveFeedProps {
  auctionId: string
  items: BidHistoryItem[]
  currentUserId: string | null
  currentBidderLabel: string | null
  currentParticipantId: number | null
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatDelta(items: BidHistoryItem[], index: number): string | null {
  if (index >= items.length - 1) return null
  const current = items[index]
  const prev = items[index + 1]
  if (!current || !prev) return null
  const delta = current.amount - prev.amount
  if (delta <= 0) return null
  return '+' + formatVnd(delta)
}

interface FeedItemProps {
  item: BidHistoryItem
  delta: string | null
  isCurrentUser: boolean
  isOutbid: boolean
}

function FeedItem({ item, delta, isCurrentUser, isOutbid }: FeedItemProps) {
  const isSystem = item.type === 'buy_now' && item.bidder_label === 'system'
  const time = dayjs(item.placed_at).format('HH:mm:ss')

  if (isSystem) {
    return (
      <div className="feed-item feed-item--system" aria-label={`Sự kiện hệ thống lúc ${time}`}>
        <span className="feed-item__time">{time}</span>
        <span className="feed-item__content feed-item__content--system">
          — {formatParticipantLabel(item.bidder_label)} · {formatVnd(item.amount)} —
        </span>
      </div>
    )
  }

  const label = isCurrentUser ? 'Bạn' : formatParticipantLabel(item.bidder_label)
  const typeTag = item.type === 'auto' ? ' · đặt tự động' : item.type === 'buy_now' ? ' · mua ngay' : ''

  return (
    <div
      className={`feed-item${isOutbid ? ' feed-item--outbid' : ''}${isCurrentUser ? ' feed-item--self' : ''}`}
      aria-label={`Lượt đặt của ${label} lúc ${time}`}
    >
      <span className="feed-item__time">{time}</span>
      <span className="feed-item__content">
        <span className="feed-item__label">{label}</span>
        {' đặt giá '}
        <span className="feed-item__amount">{formatVnd(item.amount)}</span>
        {delta && <span className="feed-item__delta"> · {delta}</span>}
        {typeTag && <span className="feed-item__tag">{typeTag}</span>}
        {isOutbid && <span className="feed-item__outbid-note"> → đã bị vượt giá</span>}
      </span>
    </div>
  )
}

export function LiveFeed({
  auctionId,
  items,
  currentUserId,
  currentBidderLabel,
  currentParticipantId,
}: LiveFeedProps) {
  const [loading, setLoading] = useState(true)
  const [initialItems, setInitialItems] = useState<BidHistoryItem[]>([])
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchBids() {
      setLoading(true)
      try {
        const res = await publicGet<{ items: BidHistoryItem[]; limit: number; offset: number }>(
          `/auctions/${auctionId}/bids?limit=50`
        )
        if (!cancelled && res.data?.items) {
          setInitialItems(res.data.items)
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBids()
    return () => { cancelled = true }
  }, [auctionId])

  const merged = items.length > 0 ? [...items, ...initialItems] : initialItems

  const seen = new Set<number>()
  const feed = merged.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  useEffect(() => {
    if (items.length > 0 && topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [items.length])

  if (loading) {
    return (
      <div className="tab-content tab-content--center" aria-label="Đang tải hoạt động">
        <Spin size="small" />
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className="tab-content tab-content--empty">
        <span>Chưa có hoạt động nào</span>
      </div>
    )
  }

  return (
    <div className="tab-content feed-list" role="log" aria-live="polite" aria-label="Lịch sử đặt giá">
      <div ref={topRef} />
      {feed.map((item, index) => {
        const isCurrentUser = isSelfBidder(item, {
          userId: currentUserId,
          bidderLabel: currentBidderLabel,
          participantId: currentParticipantId,
        })
        const isOutbid =
          isCurrentUser && !item.is_winning && index !== 0
        const delta = formatDelta(feed, index)

        return (
          <FeedItem
            key={item.id}
            item={item}
            delta={delta}
            isCurrentUser={isCurrentUser}
            isOutbid={isOutbid}
          />
        )
      })}
    </div>
  )
}
