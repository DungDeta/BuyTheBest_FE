import { useCallback, useEffect, useState } from 'react'
import { LiveFeed } from '@/components/auction/LiveFeed'
import { BidderList } from '@/components/auction/BidderList'
import { RoomChat } from '@/components/auction/RoomChat'
import { AuctionLog } from '@/components/auction/AuctionLog'
import { DescriptionTab } from '@/components/auction/DescriptionTab'
import { publicGet } from '@/api/api'
import type { Auction, BidHistoryItem, WsEventType } from '@/types/auction'

interface RoomTabsProps {
  auction: Auction
  bidFeed: BidHistoryItem[]
  currentUserId: string | null
  currentBidderLabel: string | null
  currentParticipantId: number | null
  isLoggedIn: boolean
  participantCount: number
  roomReady: boolean
  subscribe: (eventType: WsEventType, callback: (payload: unknown) => void) => void
  unsubscribe: (eventType: WsEventType, callback: (payload: unknown) => void) => void
}

type TabKey = 'feed' | 'desc' | 'bidders' | 'chat' | 'log'

export function RoomTabs({
  auction,
  bidFeed,
  currentUserId,
  currentBidderLabel,
  currentParticipantId,
  isLoggedIn,
  participantCount,
  roomReady,
  subscribe,
  unsubscribe,
}: RoomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('feed')
  const bidFeedParticipantCount = new Set(
    bidFeed.map((bid) => String(
      bid.bidder_id ?? bid.participant_id ?? bid.bidder_label,
    )),
  ).size
  const [resolvedParticipantCount, setResolvedParticipantCount] = useState(
    Math.max(auction.seller_count ?? 0, bidFeedParticipantCount),
  )

  const showLog =
    auction.status === 'ended' || auction.status === 'closed_bin'
  const hidesSealedParticipants =
    auction.mode === 'sealed_bid' && !showLog

  useEffect(() => {
    let cancelled = false

    async function resolveBidderCount() {
      try {
        const res = await publicGet<{ items: Array<{ bid_count: number }> }>(
          `/auctions/${auction.id}/participants?limit=50`,
        )
        if (cancelled) return

        const apiBidderCount = (res.data?.items ?? [])
          .filter((participant) => participant.bid_count > 0)
          .length
        setResolvedParticipantCount(Math.max(
          auction.seller_count ?? 0,
          apiBidderCount,
          bidFeedParticipantCount,
        ))
      } catch {
        if (!cancelled) {
          setResolvedParticipantCount(Math.max(auction.seller_count ?? 0, bidFeedParticipantCount))
        }
      }
    }

    resolveBidderCount()
    return () => {
      cancelled = true
    }
  }, [auction.id, auction.seller_count, bidFeedParticipantCount, participantCount])

  const handleBidderCountLoaded = useCallback((count: number) => {
    setResolvedParticipantCount(Math.max(
      auction.seller_count ?? 0,
      count,
      bidFeedParticipantCount,
    ))
  }, [auction.seller_count, bidFeedParticipantCount])

  const tabs: { key: TabKey; label: string }[] = [
    {
      key: 'feed',
      label: auction.mode === 'reverse'
        ? `Báo giá (${auction.offer_count ?? auction.bid_count})`
        : auction.mode === 'sealed_bid'
          ? `Giá kín (${auction.bid_count})`
          : `Hoạt động (${bidFeed.length > 0 ? bidFeed.length : auction.bid_count})`,
    },
    { key: 'desc', label: auction.mode === 'reverse' ? 'Yêu cầu' : 'Mô tả' },
    {
      key: 'bidders',
      label: hidesSealedParticipants
        ? 'Người đặt (đã ẩn)'
        : `${auction.mode === 'reverse' ? 'Người bán' : 'Người đặt'} (${resolvedParticipantCount})`,
    },
    { key: 'chat', label: 'Tin nhắn' },
    ...(showLog ? [{ key: 'log' as TabKey, label: 'Nhật ký' }] : []),
  ]

  return (
    <div className="room-tabs" aria-label="Tab nội dung phiên đấu giá">
      <div className="room-tabs__nav" role="tablist" aria-label="Các tab">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
            className={`room-tabs__tab${activeTab === tab.key ? ' room-tabs__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`tabpanel-feed`}
        role="tabpanel"
        aria-labelledby="tab-feed"
        hidden={activeTab !== 'feed'}
      >
        {activeTab === 'feed' && (
          <LiveFeed
            auctionId={auction.id}
            items={bidFeed}
            currentUserId={currentUserId}
            currentBidderLabel={currentBidderLabel}
            currentParticipantId={currentParticipantId}
            mode={auction.mode}
            recordedCount={auction.bid_count}
          />
        )}
      </div>

      <div
        id="tabpanel-desc"
        role="tabpanel"
        aria-labelledby="tab-desc"
        hidden={activeTab !== 'desc'}
      >
        {activeTab === 'desc' && (
          <DescriptionTab auction={auction} />
        )}
      </div>

      <div
        id="tabpanel-bidders"
        role="tabpanel"
        aria-labelledby="tab-bidders"
        hidden={activeTab !== 'bidders'}
      >
        {activeTab === 'bidders' && (
          hidesSealedParticipants
            ? (
              <div className="tab-content tab-content--empty">
                Danh tính người đặt được giữ kín đến khi phiên kết thúc.
              </div>
            )
            : (
              <BidderList
                auctionId={auction.id}
                currentUserId={currentUserId}
                currentBidderLabel={currentBidderLabel}
                currentParticipantId={currentParticipantId}
                mode={auction.mode}
                realtimeCount={participantCount}
                onCountLoaded={handleBidderCountLoaded}
              />
            )
        )}
      </div>

      <div
        id="tabpanel-chat"
        role="tabpanel"
        aria-labelledby="tab-chat"
        hidden={activeTab !== 'chat'}
      >
        {activeTab === 'chat' && (
          <RoomChat
            auctionId={auction.id}
            auctionStatus={auction.status}
            isLoggedIn={isLoggedIn}
            currentUserId={currentUserId}
            roomReady={roomReady}
            subscribe={subscribe}
            unsubscribe={unsubscribe}
          />
        )}
      </div>

      {showLog && (
        <div
          id="tabpanel-log"
          role="tabpanel"
          aria-labelledby="tab-log"
          hidden={activeTab !== 'log'}
        >
          {activeTab === 'log' && (
            <AuctionLog auctionId={auction.id} />
          )}
        </div>
      )}
    </div>
  )
}
