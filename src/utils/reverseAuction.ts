import type {
  Auction,
  AuctionViewerCapabilities,
  ReverseDemand,
} from '@/types/auction'

export interface ResolvedReverseViewer {
  isCreator: boolean
  isSeller: boolean
  canOffer: boolean
  canCancel: boolean
  isWinningSeller: boolean
  canPay: boolean
  orderRole: 'buyer' | 'seller' | null
}

export function getReverseDemand(auction: Auction): ReverseDemand {
  return {
    title:
      auction.demand?.title?.trim() ||
      auction.title?.trim() ||
      auction.product?.title?.trim() ||
      'Yêu cầu đấu giá ngược',
    description:
      auction.demand?.description?.trim() ||
      auction.description?.trim() ||
      auction.product?.description?.trim() ||
      '',
    category_id: auction.demand?.category_id ?? auction.category_id,
  }
}

function serverViewer(auction: Auction): AuctionViewerCapabilities {
  return auction.viewer ?? auction.viewer_capabilities ?? {}
}

export function resolveReverseViewer(
  auction: Auction,
  currentUserId: string | null,
  currentUserIsSeller: boolean,
): ResolvedReverseViewer {
  const viewer = serverViewer(auction)
  const creatorPublicId = auction.creator?.id ?? null
  const creatorMatchesPublicId =
    currentUserId !== null &&
    creatorPublicId !== null &&
    String(creatorPublicId) === currentUserId
  const isCreator = auction.viewer_is_creator ?? viewer.is_creator ?? creatorMatchesPublicId
  const isSeller = viewer.is_seller ?? currentUserIsSeller
  const isWinningSeller =
    auction.viewer_is_winning_seller ??
    viewer.is_winning_seller ??
    viewer.is_leading_offer_seller ??
    false
  const canPay =
    auction.viewer_can_pay ??
    viewer.can_pay ??
    viewer.can_checkout ??
    (isCreator && auction.order_id != null)
  const canOffer =
    auction.viewer_can_offer ??
    viewer.can_offer ??
    (auction.status === 'active' && isSeller && !isCreator)
  const canCancel =
    auction.viewer_can_cancel ??
    viewer.can_cancel ??
    (isCreator &&
      (auction.status === 'scheduled' || auction.status === 'active') &&
      auction.bid_count === 0)
  const orderRole =
    viewer.order_role ??
    (canPay ? 'buyer' : isWinningSeller && auction.order_id != null ? 'seller' : null)

  return {
    isCreator,
    isSeller,
    canOffer,
    canCancel,
    isWinningSeller,
    canPay,
    orderRole,
  }
}

export function reverseOfferCount(auction: Auction): number {
  return auction.offer_count ?? auction.bid_count ?? 0
}

export function reverseSellerCount(auction: Auction): number | null {
  return typeof auction.seller_count === 'number' ? auction.seller_count : null
}
