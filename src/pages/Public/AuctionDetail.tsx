import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App, Spin } from 'antd'
import { EyeOutlined, MessageOutlined } from '@ant-design/icons'
import { publicGet, privateGet, privatePost } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useAuctionWebSocket } from '@/hooks/useAuctionWebSocket'
import { ProductHero } from '@/components/auction/ProductHero'
import { CountdownBox } from '@/components/auction/CountdownBox'
import { BidPanel } from '@/components/auction/BidPanel'
import { RoomTabs } from '@/components/auction/RoomTabs'
import { getAuctionDisplayTitle } from '@/utils/auctionDisplay'
import { resolveReverseViewer } from '@/utils/reverseAuction'
import type {
  Auction,
  AuctionEndedPayload,
  AuctionExtendedPayload,
  AuctionStartedPayload,
  AuditLogEvent,
  BidActionResponse,
  BidHistoryItem,
  BidPlacedPayload,
  DutchPriceTickPayload,
  SealedRevealedPayload,
} from '@/types/auction'
import './auction-room.css'

interface ProductDetailResponse {
  description?: string | null
  images?: NonNullable<Auction['product']>['images']
}

interface WatchStatusResponse {
  watching: boolean
}

interface WatchToggleResponse {
  added: boolean
  auction_id: string
  watcher_count?: number
}

const SCHEDULED_START_MAX_ATTEMPTS = 20
const SCHEDULED_START_FAST_ATTEMPTS = 5
const SCHEDULED_START_FAST_INTERVAL_MS = 2_000
const SCHEDULED_START_SLOW_INTERVAL_MS = 5_000
const SCHEDULED_START_MAX_WAKE_DELAY_MS = 60_000
const SCHEDULED_START_GRACE_MS = 250
const ACTIVE_END_GRACE_MS = 1_500
const ACTIVE_END_POLL_INTERVAL_MS = 3_000
const ACTIVE_END_MAX_ATTEMPTS = 80
const ACTIVE_END_MAX_WAKE_DELAY_MS = 60_000

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const currentUserIsSeller = useAuthStore((s) => s.user?.is_seller ?? false)

  const [auction, setAuction] = useState<Auction | null>(null)
  const [loading, setLoading] = useState(true)

  const documentTitle = auction ? getAuctionDisplayTitle(auction) : 'Chi tiết phiên đấu giá'
  useDocumentTitle(documentTitle)
  const [notFound, setNotFound] = useState(false)
  const [bidFeed, setBidFeed] = useState<BidHistoryItem[]>([])
  const [serverNow, setServerNow] = useState<string | null>(null)
  const [currentBidderLabel, setCurrentBidderLabel] = useState<string | null>(null)
  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null)
  const [roomParticipantCount, setRoomParticipantCount] = useState(0)
  const [watching, setWatching] = useState(false)
  const [watchLoading, setWatchLoading] = useState(false)
  const pendingSelfBidAmountRef = useRef<number | null>(null)

  // Some servers reject room membership before an auction is active. The
  // scheduled-start refresh below transitions state first, then this null -> id
  // change starts a fresh WebSocket connection without exhausted pre-start retries.
  const wsAuctionId = auction?.status === 'active' ? (auction.id ?? null) : null
  const {
    isConnected,
    connectionState,
    membershipState,
    joinError,
    participantCount,
    currentParticipantId: joinedParticipantId,
    currentBidderLabel: joinedBidderLabel,
    serverNow: joinedServerNow,
    subscribe,
    unsubscribe,
  } = useAuctionWebSocket(wsAuctionId)

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
            let nextAuction = res.data
            if (nextAuction.product?.id && !nextAuction.product.description) {
              try {
                const productRes = await publicGet<ProductDetailResponse>(
                  `/products/${nextAuction.product.id}`,
                )
                if (productRes.data) {
                  nextAuction = {
                    ...nextAuction,
                    product: {
                      ...nextAuction.product,
                      description: productRes.data.description ?? nextAuction.product.description,
                      images: productRes.data.images ?? nextAuction.product.images,
                    },
                  }
                }
              } catch {
              }
            }
            if (
              nextAuction.mode === 'reverse' &&
              isAuthenticated() &&
              nextAuction.viewer_is_creator === undefined &&
              nextAuction.viewer?.is_creator === undefined &&
              nextAuction.viewer_capabilities?.is_creator === undefined
            ) {
              try {
                const owned = await privateGet<Auction>(`/me/auctions/${id}`)
                if (owned.data?.id === nextAuction.id) {
                  nextAuction = {
                    ...nextAuction,
                    ...owned.data,
                    product: nextAuction.product ?? owned.data.product,
                    viewer_is_creator: true,
                    viewer_can_offer: false,
                  }
                }
              } catch {
              }
            }
            if (res.data.status === 'ended' || res.data.status === 'closed_bin') {
              try {
                const log = await publicGet<{ events: AuditLogEvent[] }>(
                  `/auctions/${id}/log`,
                )
                const endedEvent = log.data?.events?.find(
                  (event) => event.type === 'AuctionEnded' || event.type === 'auction.ended',
                )
                const winnerLabel = endedEvent?.data?.winner_label
                if (typeof winnerLabel === 'string') {
                  nextAuction = {
                    ...nextAuction,
                    winner_label: winnerLabel,
                    winner_is_self: nextAuction.highest_bidder_is_self,
                  }
                }
              } catch {
              }
            }
            if (!cancelled) setAuction(nextAuction)
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
  }, [id, isAuthenticated])

  useEffect(() => {
    if (!id || !isAuthenticated()) {
      setWatching(false)
      return
    }

    let cancelled = false
    setWatchLoading(true)
    privateGet<WatchStatusResponse>(`/watchlist/${id}/status`)
      .then((res) => {
        if (!cancelled) {
          setWatching(Boolean(res.data?.watching))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWatching(false)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWatchLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [id, isAuthenticated])

  useEffect(() => {
    if (typeof joinedParticipantId === 'number') {
      setCurrentParticipantId(joinedParticipantId)
    }
    if (joinedBidderLabel) {
      setCurrentBidderLabel(joinedBidderLabel)
    }
    if (joinedServerNow) {
      setServerNow(joinedServerNow)
    }
  }, [joinedBidderLabel, joinedParticipantId, joinedServerNow])

  useEffect(() => {
    if (!id) return

    let cancelled = false
    publicGet<{ participant_count: number }>(`/auctions/${id}/participants?limit=1`)
      .then((res) => {
        if (!cancelled && typeof res.data?.participant_count === 'number') {
          setRoomParticipantCount(res.data.participant_count)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [id])

  const refreshAuctionSnapshot = useCallback(async (): Promise<Auction | null> => {
    if (!id) return null
    try {
      const response = await publicGet<Auction>(`/auctions/${id}`)
      let nextAuction = response.data
      if (
        nextAuction.mode === 'reverse' &&
        isAuthenticated() &&
        nextAuction.viewer_is_creator === undefined &&
        nextAuction.viewer?.is_creator === undefined &&
        nextAuction.viewer_capabilities?.is_creator === undefined
      ) {
        try {
          const owned = await privateGet<Auction>(`/me/auctions/${id}`)
          if (owned.data?.id === nextAuction.id) {
            nextAuction = {
              ...nextAuction,
              ...owned.data,
              viewer_is_creator: true,
              viewer_can_offer: false,
            }
          }
        } catch {
        }
      }

      setServerNow(nextAuction.server_time ?? response.timestamp ?? null)
      setAuction((previous) => {
        if (!previous) return nextAuction
        return {
          ...previous,
          ...nextAuction,
          product: nextAuction.product
            ? {
                ...previous.product,
                ...nextAuction.product,
                description: nextAuction.product.description ?? previous.product?.description,
              }
            : previous.product,
          viewer_is_creator: nextAuction.viewer_is_creator ?? previous.viewer_is_creator,
          viewer_can_offer: nextAuction.viewer_can_offer ?? previous.viewer_can_offer,
          viewer_is_winning_seller:
            nextAuction.viewer_is_winning_seller ?? previous.viewer_is_winning_seller,
          viewer_can_pay: nextAuction.viewer_can_pay ?? previous.viewer_can_pay,
        }
      })
      return nextAuction
    } catch {
      return null
    }
  }, [id, isAuthenticated])

  const scheduledAuctionId = auction?.id ?? null
  const scheduledStartsAt = auction?.starts_at ?? null
  const scheduledStatus = auction?.status ?? null

  useEffect(() => {
    if (!scheduledAuctionId || !scheduledStartsAt || scheduledStatus !== 'scheduled') return

    const startsAtMs = Date.parse(scheduledStartsAt)
    if (!Number.isFinite(startsAtMs)) return

    let cancelled = false
    let refreshAttempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = (callback: () => void, delayMs: number) => {
      timer = setTimeout(callback, delayMs)
    }

    const pollForTransition = async () => {
      if (cancelled) return
      refreshAttempts += 1

      const snapshot = await refreshAuctionSnapshot()
      if (cancelled || (snapshot && snapshot.status !== 'scheduled')) return
      if (refreshAttempts >= SCHEDULED_START_MAX_ATTEMPTS) return

      const interval = refreshAttempts < SCHEDULED_START_FAST_ATTEMPTS
        ? SCHEDULED_START_FAST_INTERVAL_MS
        : SCHEDULED_START_SLOW_INTERVAL_MS
      schedule(() => void pollForTransition(), interval)
    }

    const waitUntilStart = () => {
      if (cancelled) return
      const remainingMs = startsAtMs + SCHEDULED_START_GRACE_MS - Date.now()
      if (remainingMs <= 0) {
        void pollForTransition()
        return
      }

      schedule(
        waitUntilStart,
        Math.min(remainingMs, SCHEDULED_START_MAX_WAKE_DELAY_MS),
      )
    }

    waitUntilStart()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [scheduledAuctionId, scheduledStartsAt, scheduledStatus, refreshAuctionSnapshot])

  const activeAuctionId = auction?.id ?? null
  const activeEndsAt = auction?.ends_at ?? null
  const activeStatus = auction?.status ?? null

  useEffect(() => {
    if (!activeAuctionId || !activeEndsAt || activeStatus !== 'active') return

    const endsAtMs = Date.parse(activeEndsAt)
    if (!Number.isFinite(endsAtMs)) return

    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = (callback: () => void, delayMs: number) => {
      timer = setTimeout(callback, delayMs)
    }

    const pollForSettlement = async () => {
      if (cancelled) return
      attempts += 1

      const snapshot = await refreshAuctionSnapshot()
      if (cancelled || (snapshot && snapshot.status !== 'active')) return
      if (attempts >= ACTIVE_END_MAX_ATTEMPTS) return

      schedule(() => void pollForSettlement(), ACTIVE_END_POLL_INTERVAL_MS)
    }

    const waitUntilExpectedEnd = () => {
      if (cancelled) return
      const remainingMs = endsAtMs + ACTIVE_END_GRACE_MS - Date.now()
      if (remainingMs <= 0) {
        void pollForSettlement()
        return
      }

      schedule(
        waitUntilExpectedEnd,
        Math.min(remainingMs, ACTIVE_END_MAX_WAKE_DELAY_MS),
      )
    }

    waitUntilExpectedEnd()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [activeAuctionId, activeEndsAt, activeStatus, refreshAuctionSnapshot])

  const handleBidPlaced = useCallback((payload: unknown) => {
    const p = payload as BidPlacedPayload
    if (auction?.mode === 'sealed_bid') {
      if (p.server_time) setServerNow(p.server_time)
      setAuction((previous) => previous
        ? {
            ...previous,
            bid_count: typeof p.bid_count === 'number' ? p.bid_count : previous.bid_count,
            server_time: p.server_time ?? previous.server_time,
          }
        : previous)
      // Sealed bids are count-only until sealed.revealed, even if an older server
      // accidentally includes bidder or amount fields in the realtime payload.
      void refreshAuctionSnapshot()
      return
    }

    if (
      p.bid_id == null ||
      p.bidder_label == null ||
      p.amount == null ||
      p.current_price == null ||
      p.bid_type == null
    ) {
      void refreshAuctionSnapshot()
      return
    }
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
        current_price: p.current_price ?? prev.current_price,
        bid_count: p.bid_count,
        highest_bidder_id: p.bidder_id ?? null,
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
      product: p.product,
    }
    setBidFeed((prev) => [newItem, ...prev])
    if (auction?.mode === 'reverse') {
      void refreshAuctionSnapshot()
    }
  }, [auction?.mode, currentBidderLabel, currentParticipantId, currentUserId, refreshAuctionSnapshot])

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

    if (p.server_time) {
      setServerNow(p.server_time)
    }

    setAuction((prev) => {
      if (!prev) return prev
      const winnerLabel = p.winner_label ?? prev.highest_bidder_label ?? null
      const winnerIsSelf =
        p.winner_is_self === true ||
        prev.highest_bidder_is_self === true ||
        (currentUserId !== null && p.winner_user_id != null && String(p.winner_user_id) === currentUserId) ||
        (currentUserId !== null && p.winner_id != null && String(p.winner_id) === currentUserId) ||
        (currentBidderLabel !== null && winnerLabel === currentBidderLabel)

      return {
        ...prev,
        status: 'ended',
        current_price: p.final_price,
        bid_count: p.bid_count,
        winner_label: winnerLabel,
        winner_id: p.winner_id ?? prev.highest_bidder_id,
        winner_user_id: p.winner_user_id,
        winner_is_self: winnerIsSelf,
        order_id: p.order_id,
        checkout_url: p.checkout_url,
        payment_deadline: p.payment_deadline,
        server_time: p.server_time ?? prev.server_time,
      }
    })

    if (p.winner_label) {
      message.success(`Phiên kết thúc · Người thắng: ${p.winner_label}`)
    } else {
      message.success('Phiên đấu giá đã kết thúc')
    }
    void refreshAuctionSnapshot()
  }, [currentBidderLabel, currentUserId, message, refreshAuctionSnapshot])

  const handleAuctionStarted = useCallback((payload: unknown) => {
    const p = payload as AuctionStartedPayload
    if (p.server_time) setServerNow(p.server_time)
    setAuction((previous) => previous
      ? {
          ...previous,
          status: 'active',
          starts_at: p.starts_at ?? previous.starts_at,
          server_time: p.server_time ?? previous.server_time,
        }
      : previous)
    message.info('Phiên đấu giá đã bắt đầu')
    void refreshAuctionSnapshot()
  }, [message, refreshAuctionSnapshot])

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
    message.info('Kết quả đấu giá kín đã được công bố')
  }, [currentBidderLabel, currentUserId, message])

  const handleToggleWatch = useCallback(async () => {
    if (!auction) return
    if (!isAuthenticated()) {
      message.info('Vui lòng đăng nhập để theo dõi phiên đấu giá')
      navigate('/login')
      return
    }

    setWatchLoading(true)
    try {
      const res = await privatePost<WatchToggleResponse>(`/watchlist/${auction.id}`)
      const nextWatching = Boolean(res.data?.added)
      const watcherCount = res.data?.watcher_count
      setWatching(nextWatching)
      setAuction((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          watcher_count: typeof watcherCount === 'number'
            ? Math.max(0, watcherCount)
            : Math.max(0, (prev.watcher_count ?? 0) + (nextWatching ? 1 : -1)),
        }
      })
      message.success(
        nextWatching
          ? 'Đã thêm phiên vào danh sách theo dõi'
          : 'Đã bỏ theo dõi phiên đấu giá',
      )
    } catch (err) {
      const e = err as { error?: string }
      message.error(e?.error ?? 'Không thể cập nhật trạng thái theo dõi')
    } finally {
      setWatchLoading(false)
    }
  }, [auction, isAuthenticated, message, navigate])

  useEffect(() => {
    subscribe('bid.placed', handleBidPlaced)
    subscribe('auction.extended', handleAuctionExtended)
    subscribe('auction.ended', handleAuctionEnded)
    subscribe('auction.started', handleAuctionStarted)
    subscribe('dutch.price_tick', handleDutchTick)
    subscribe('sealed.revealed', handleSealedRevealed)

    return () => {
      unsubscribe('bid.placed', handleBidPlaced)
      unsubscribe('auction.extended', handleAuctionExtended)
      unsubscribe('auction.ended', handleAuctionEnded)
      unsubscribe('auction.started', handleAuctionStarted)
      unsubscribe('dutch.price_tick', handleDutchTick)
      unsubscribe('sealed.revealed', handleSealedRevealed)
    }
  }, [
    subscribe,
    unsubscribe,
    handleBidPlaced,
    handleAuctionExtended,
    handleAuctionEnded,
    handleAuctionStarted,
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

  const title = getAuctionDisplayTitle(auction)
  const isActive = auction.status === 'active'
  const authed = isAuthenticated()
  const reverseViewer = resolveReverseViewer(auction, currentUserId, currentUserIsSeller)
  const roomConnectionState =
    membershipState === 'failed'
      ? 'failed'
      : authed && connectionState === 'connected' && membershipState !== 'joined'
        ? 'connecting'
        : connectionState
  const roomReady =
    roomConnectionState === 'connected' &&
    (!authed || membershipState === 'joined')
  const visibleParticipantCount = participantCount ?? roomParticipantCount
  const canToggleWatch =
    auction.status === 'active' ||
    auction.status === 'scheduled' ||
    watching

  return (
    <>
      <nav className="room-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="room-breadcrumb__sep" aria-hidden="true">/</span>
        <Link to="/auctions">Khám phá</Link>
        <span className="room-breadcrumb__sep" aria-hidden="true">/</span>
        <span className="room-breadcrumb__current" aria-current="page">{title}</span>
      </nav>

      <div
        className="room-shell"
        data-testid={auction.mode === 'reverse' ? 'reverse-auction-detail' : 'auction-detail'}
      >
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
            roomReady={roomReady}
            subscribe={subscribe}
            unsubscribe={unsubscribe}
          />
        </div>

        <aside className="room-right" aria-label="Thông tin và hành động đấu giá">
          {isActive && (
            <div
              className={`room-ws-badge${
                roomReady
                  ? ' room-ws-badge--live'
                  : roomConnectionState === 'failed'
                    ? ' room-ws-badge--error'
                    : ''
              }`}
              aria-label={
                roomReady
                  ? 'Đang kết nối trực tiếp'
                  : roomConnectionState === 'failed'
                    ? joinError ?? 'Không thể kết nối phòng đấu giá'
                    : authed && isConnected
                      ? 'Đang ghi nhận người tham gia'
                      : 'Đang kết nối lại'
              }
              role={roomConnectionState === 'failed' ? 'alert' : 'status'}
            >
              <span className="room-ws-badge__dot" aria-hidden="true" />
              {roomReady
                ? 'Đang diễn ra'
                : roomConnectionState === 'failed'
                  ? 'Mất kết nối'
                  : authed && isConnected
                    ? 'Đang tham gia phòng…'
                    : 'Đang kết nối…'}
            </div>
          )}

          <CountdownBox
            endsAt={auction.ends_at}
            startsAt={auction.starts_at}
            serverNow={serverNow ?? auction.server_time}
            antiSnipeSeconds={auction.anti_snipe_threshold_seconds}
            extensionCount={auction.extension_count}
            maxExtensions={auction.max_extensions}
            ended={
              auction.status === 'ended' ||
              auction.status === 'closed_bin' ||
              auction.status === 'cancelled'
            }
            scheduled={auction.status === 'scheduled'}
          />

          <button
            type="button"
            className={`watch-toggle-btn${watching ? ' watch-toggle-btn--active' : ''}`}
            onClick={handleToggleWatch}
            disabled={watchLoading || !canToggleWatch}
            aria-pressed={watching}
          >
            <span>
              <EyeOutlined aria-hidden="true" /> {watching ? 'Đang theo dõi' : 'Theo dõi phiên này'}
            </span>
            <small>{auction.watcher_count ?? 0} người theo dõi</small>
          </button>

          <BidPanel
            auction={auction}
            isLoggedIn={authed}
            currentUserId={currentUserId}
            currentUserIsSeller={currentUserIsSeller}
            currentBidderLabel={currentBidderLabel}
            currentParticipantId={currentParticipantId}
            connectionState={roomConnectionState}
            onBidPlaced={markSelfBid}
          />

          {authed &&
            auction.seller &&
            currentUserId !== auction.seller.id &&
            (auction.mode !== 'reverse' || reverseViewer.isCreator) && (
            <button
              className="contact-seller-btn"
              onClick={async () => {
                try {
                  const res = await privatePost<{ id: number }>('/conversations', { seller_id: auction.seller_id })
                  if (res.data?.id) {
                    navigate(`/chat?conversation=${res.data.id}`)
                  }
                } catch {
                  message.error('Không thể mở cuộc trò chuyện')
                }
              }}
            >
              <MessageOutlined aria-hidden="true" /> Nhắn tin người bán
            </button>
          )}
        </aside>
      </div>
    </>
  )
}
