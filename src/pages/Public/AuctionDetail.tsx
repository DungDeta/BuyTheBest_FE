import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Spin } from 'antd'
import { publicGet, privateDelete, privatePost } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useAuctionWebSocket } from '@/hooks/useAuctionWebSocket'
import { ProductHero } from '@/components/auction/ProductHero'
import { CountdownBox } from '@/components/auction/CountdownBox'
import { BidPanel } from '@/components/auction/BidPanel'
import { RoomTabs } from '@/components/auction/RoomTabs'
import type {
  Auction,
  AuctionEndedPayload,
  AuctionExtendedPayload,
  BidActionResponse,
  BidHistoryItem,
  BidPlacedPayload,
  DutchPriceTickPayload,
  RoomPresenceResponse,
  SealedRevealedPayload,
} from '@/types/auction'
import './auction-room.css'

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)

  const [auction, setAuction] = useState<Auction | null>(null)
  const [loading, setLoading] = useState(true)

  useDocumentTitle(auction?.product?.title ?? 'Chi tiết phiên đấu giá')
  const [notFound, setNotFound] = useState(false)
  const [bidFeed, setBidFeed] = useState<BidHistoryItem[]>([])
  const [serverNow, setServerNow] = useState<string | null>(null)
  const [currentBidderLabel, setCurrentBidderLabel] = useState<string | null>(null)
  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null)
  const [roomParticipantCount, setRoomParticipantCount] = useState(0)
  const pendingSelfBidAmountRef = useRef<number | null>(null)

  const wsAuctionId = auction?.status === 'active' ? (auction.id ?? null) : null
  const { isConnected, participantCount, subscribe, unsubscribe } = useAuctionWebSocket(wsAuctionId)

  const markSelfBid = useCallback((amount: number, data?: BidActionResponse) => {
    pendingSelfBidAmountRef.current = amount
    if (data?.bidder_label) {
      setCurrentBidderLabel(data.bidder_label)
    }
    if (typeof data?.participant_id === 'number') {
      setCurrentParticipantId(data.participant_id)
    }
    if (data?.server_time) {
      setServerNow(data.server_time)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setBidFeed([])
    setCurrentBidderLabel(null)
    setCurrentParticipantId(null)
    setRoomParticipantCount(0)
    pendingSelfBidAmountRef.current = null

    async function fetchAuction() {
      setLoading(true)
      setNotFound(false)
      try {
        const res = await publicGet<Auction>(`/auctions/${id}`)
        if (!cancelled) {
          setServerNow(res.data?.server_time ?? res.timestamp ?? null)
          if (res.data && typeof res.data.id === 'string') {
            setAuction(res.data)
          } else {
            setNotFound(true)
          }
        }
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAuction()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!wsAuctionId || !isAuthenticated()) return

    const auctionId = wsAuctionId
    let joined = false

    async function joinRoom() {
      try {
        const res = await privatePost<RoomPresenceResponse>(`/auctions/${auctionId}/join`)
        const participant = res.data?.participant
        const participantId = participant?.participant_id ?? participant?.id ?? null
        const bidderLabel = participant?.bidder_label ?? participant?.label ?? null

        if (typeof participantId === 'number') {
          setCurrentParticipantId(participantId)
        }
        if (bidderLabel) {
          setCurrentBidderLabel(bidderLabel)
        }
        if (res.data?.server_time ?? res.timestamp) {
          setServerNow(res.data?.server_time ?? res.timestamp)
        }
        if (typeof res.data?.participant_count === 'number') {
          setRoomParticipantCount(res.data.participant_count)
        }
        joined = true
      } catch {
      }
    }

    joinRoom()

    return () => {
      if (!joined) return
      privateDelete(`/auctions/${auctionId}/join`).catch(() => undefined)
    }
  }, [wsAuctionId, isAuthenticated])

  const handleBidPlaced = useCallback((payload: unknown) => {
    const p = payload as BidPlacedPayload
    const isSelf =
      p.is_self === true ||
      (currentUserId !== null && p.bidder_id != null && String(p.bidder_id) === currentUserId) ||
      (currentParticipantId !== null && p.participant_id === currentParticipantId) ||
      (currentBidderLabel !== null && p.bidder_label === currentBidderLabel) ||
      (pendingSelfBidAmountRef.current !== null && pendingSelfBidAmountRef.current === p.amount)

    if (p.server_time) {
      setServerNow(p.server_time)
    }
    if (isSelf) {
      setCurrentBidderLabel(p.bidder_label)
      if (typeof p.participant_id === 'number') {
        setCurrentParticipantId(p.participant_id)
      }
      pendingSelfBidAmountRef.current = null
    }

    setAuction((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        current_price: p.current_price,
        bid_count: p.bid_count,
        highest_bidder_id: p.bidder_id ?? prev.highest_bidder_id,
        highest_bidder_label: p.bidder_label,
        highest_bidder_is_self: isSelf,
        server_time: p.server_time ?? prev.server_time,
      }
    })

    const newItem: BidHistoryItem = {
      id: p.bid_id,
      bidder_label: p.bidder_label,
      bidder_id: p.bidder_id,
      participant_id: p.participant_id,
      amount: p.amount,
      type: p.bid_type,
      is_winning: true,
      is_self: isSelf,
      placed_at: new Date().toISOString(),
    }
    setBidFeed((prev) => [newItem, ...prev])
  }, [currentBidderLabel, currentParticipantId, currentUserId])

  const handleAuctionExtended = useCallback((payload: unknown) => {
    const p = payload as AuctionExtendedPayload
    setAuction((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        ends_at: p.new_ends_at,
        extension_count: p.extension_count,
      }
    })
    message.info(`Phiên đấu giá được gia hạn thêm (lần ${p.extension_count})`)
  }, [message])

  const handleAuctionEnded = useCallback((payload: unknown) => {
    const p = payload as AuctionEndedPayload
    const winnerIsSelf =
      p.winner_is_self === true ||
      (currentUserId !== null && p.winner_user_id != null && String(p.winner_user_id) === currentUserId) ||
      (currentUserId !== null && p.winner_id != null && String(p.winner_id) === currentUserId) ||
      (currentBidderLabel !== null && p.winner_label === currentBidderLabel)

    if (p.server_time) {
      setServerNow(p.server_time)
    }

    setAuction((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        status: 'ended',
        current_price: p.final_price,
        bid_count: p.bid_count,
        winner_label: p.winner_label,
        winner_id: p.winner_id,
        winner_user_id: p.winner_user_id,
        winner_is_self: winnerIsSelf,
        order_id: p.order_id,
        checkout_url: p.checkout_url,
        payment_deadline: p.payment_deadline,
        server_time: p.server_time ?? prev.server_time,
      }
    })

    const winner = p.winner_label ?? 'Không có'
    message.success(`Phiên kết thúc · Người thắng: ${winner}`)
  }, [currentBidderLabel, currentUserId, message])

  const handleDutchTick = useCallback((payload: unknown) => {
    const p = payload as DutchPriceTickPayload
    if (p.server_time) {
      setServerNow(p.server_time)
    }
    setAuction((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        current_price: p.new_price,
        server_time: p.server_time ?? prev.server_time,
      }
    })
  }, [])

  const handleSealedRevealed = useCallback((payload: unknown) => {
    const p = payload as SealedRevealedPayload
    const winnerIsSelf =
      p.winner_is_self === true ||
      (currentUserId !== null && p.winner_user_id != null && String(p.winner_user_id) === currentUserId) ||
      (currentUserId !== null && p.winner_id != null && String(p.winner_id) === currentUserId) ||
      (currentBidderLabel !== null && p.winner_label === currentBidderLabel)

    if (p.server_time) {
      setServerNow(p.server_time)
    }

    setAuction((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        current_price: p.current_price,
        bid_count: p.bid_count,
        status: 'ended',
        winner_label: p.winner_label ?? prev.winner_label,
        winner_id: p.winner_id ?? prev.winner_id,
        winner_user_id: p.winner_user_id ?? prev.winner_user_id,
        winner_is_self: winnerIsSelf,
        order_id: p.order_id ?? prev.order_id,
        checkout_url: p.checkout_url ?? prev.checkout_url,
        payment_deadline: p.payment_deadline ?? prev.payment_deadline,
        server_time: p.server_time ?? prev.server_time,
      }
    })
    message.info('Kết quả sealed bid đã được công bố')
  }, [currentBidderLabel, currentUserId, message])

  useEffect(() => {
    subscribe('bid.placed', handleBidPlaced)
    subscribe('auction.extended', handleAuctionExtended)
    subscribe('auction.ended', handleAuctionEnded)
    subscribe('dutch.price_tick', handleDutchTick)
    subscribe('sealed.revealed', handleSealedRevealed)

    return () => {
      unsubscribe('bid.placed', handleBidPlaced)
      unsubscribe('auction.extended', handleAuctionExtended)
      unsubscribe('auction.ended', handleAuctionEnded)
      unsubscribe('dutch.price_tick', handleDutchTick)
      unsubscribe('sealed.revealed', handleSealedRevealed)
    }
  }, [
    subscribe,
    unsubscribe,
    handleBidPlaced,
    handleAuctionExtended,
    handleAuctionEnded,
    handleDutchTick,
    handleSealedRevealed,
  ])

  if (loading) {
    return (
      <div className="room-loading" aria-label="Đang tải">
        <Spin size="large" />
      </div>
    )
  }

  if (notFound || !auction) {
    return (
      <div className="room-error">
        <p className="room-error__msg">Phiên đấu giá không tồn tại hoặc đã bị xoá.</p>
        <Link to="/auctions" className="room-back-link">← Quay lại danh sách</Link>
      </div>
    )
  }

  const title = auction.product?.title ?? `Auction #${auction.id.slice(0, 8)}`
  const isActive = auction.status === 'active'
  const authed = isAuthenticated()
  const visibleParticipantCount = participantCount > 0 ? participantCount : roomParticipantCount

  return (
    <>
      <nav className="room-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="room-breadcrumb__sep" aria-hidden="true">/</span>
        <Link to="/auctions">Khám phá</Link>
        <span className="room-breadcrumb__sep" aria-hidden="true">/</span>
        <span className="room-breadcrumb__current" aria-current="page">{title}</span>
      </nav>

      <div className="room-shell">
        <div className="room-left">
          <ProductHero auction={auction} />

          <RoomTabs
            auction={auction}
            bidFeed={bidFeed}
            currentUserId={currentUserId}
            currentBidderLabel={currentBidderLabel}
            currentParticipantId={currentParticipantId}
            isLoggedIn={authed}
            participantCount={visibleParticipantCount}
            subscribe={subscribe}
            unsubscribe={unsubscribe}
          />
        </div>

        <aside className="room-right" aria-label="Thông tin và hành động đấu giá">
          {isActive && (
            <div
              className={`room-ws-badge${isConnected ? ' room-ws-badge--live' : ''}`}
              aria-label={isConnected ? 'Đang kết nối trực tiếp' : 'Đang kết nối lại'}
            >
              <span className="room-ws-badge__dot" aria-hidden="true" />
              {isConnected ? 'LIVE' : 'Connecting…'}
            </div>
          )}

          <CountdownBox
            endsAt={auction.ends_at}
            serverNow={serverNow ?? auction.server_time}
            antiSnipeSeconds={auction.anti_snipe_threshold_seconds}
            extensionCount={auction.extension_count}
            maxExtensions={auction.max_extensions}
          />

          <BidPanel
            auction={auction}
            isLoggedIn={authed}
            currentUserId={currentUserId}
            currentBidderLabel={currentBidderLabel}
            currentParticipantId={currentParticipantId}
            onBidPlaced={markSelfBid}
          />

          <div className="escrow-banner">
            <strong>Escrow bảo vệ</strong> — tiền giữ lại an toàn đến khi xác nhận nhận hàng thành công.
          </div>

          {authed && auction.seller && currentUserId !== auction.seller.id && (
            <button
              className="contact-seller-btn"
              onClick={async () => {
                try {
                  const res = await privatePost<{ id: number }>('/conversations', { seller_id: auction.seller_id });
                  if (res.data?.id) {
                    navigate('/chat');
                  }
                } catch {
                  message.error('Không thể mở cuộc trò chuyện');
                }
              }}
            >
              💬 Nhắn tin người bán
            </button>
          )}
        </aside>
      </div>
    </>
  )
}
