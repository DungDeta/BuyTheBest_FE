import { useCallback, useEffect, useState } from 'react'
import { LiveFeed } from '@/components/auction/LiveFeed'
import { BidderList } from '@/components/auction/BidderList'
import { RoomChat } from '@/components/auction/RoomChat'
import { AuctionLog } from '@/components/auction/AuctionLog'
import { DescriptionTab } from '@/components/auction/DescriptionTab'
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
    bidFeedParticipantCount,
  )

  const showLog =
    auction.status === 'ended' || auction.status === 'closed_bin'

  useEffect(() => {
    setResolvedParticipantCount(bidFeedParticipantCount)
  }, [auction.id, bidFeedParticipantCount])

  const handleBidderCountLoaded = useCallback((count: number) => {
    setResolvedParticipantCount(Math.max(count, bidFeedParticipantCount))
  }, [bidFeedParticipantCount])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'feed', label: `Hoạt động (${bidFeed.length > 0 ? bidFeed.length : '…'})` },
    { key: 'desc', label: 'Mô tả' },
    { key: 'bidders', label: `Người đặt (${resolvedParticipantCount})` },
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
          <BidderList
            auctionId={auction.id}
            currentUserId={currentUserId}
            currentBidderLabel={currentBidderLabel}
            currentParticipantId={currentParticipantId}
            realtimeCount={participantCount}
            onCountLoaded={handleBidderCountLoaded}
          />
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
