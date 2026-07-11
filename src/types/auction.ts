export type AuctionMode = 'english' | 'dutch' | 'sealed_bid' | 'reverse'
export type AuctionStatus = 'scheduled' | 'active' | 'ended' | 'closed_bin' | 'cancelled'
export type BidType = 'manual' | 'auto' | 'buy_now'
export type AutoBidStatus = 'active' | 'cancelled' | 'exhausted' | 'won'
export type AuctionConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
export type AuctionRoomMembershipState = 'guest' | 'joining' | 'joined' | 'failed'

export interface Auction {
  id: string
  title?: string | null
  description?: string | null
  product_id?: number | null
  seller_id?: number | null
  creator_id: number
  category_id: number
  mode: AuctionMode
  status: AuctionStatus
  starting_price: number
  current_price: number
  min_increment?: number | null
  min_decrement?: number | null
  end_price?: number | null
  decrement_interval_seconds?: number | null
  buy_now_price?: number | null
  buy_now_fee_estimate?: number | null
  fee_estimate?: number | null
  budget_cap?: number | null
  highest_bid_id?: number | null
  highest_bidder_id?: number | string | null
  highest_bidder_label?: string | null
  highest_bidder_is_self?: boolean
  bid_count: number
  view_count?: number
  watcher_count?: number
  offer_count?: number
  seller_count?: number
  starts_at: string
  ends_at: string
  original_ends_at: string
  reveal_at?: string | null
  extension_count: number
  max_extensions: number
  anti_snipe_threshold_seconds: number
  anti_snipe_extension_seconds: number
  created_at: string
  updated_at: string
  winner_label?: string | null
  winner_id?: number | string | null
  winner_user_id?: number | string | null
  winner_is_self?: boolean
  order_id?: number | string | null
  checkout_url?: string | null
  payment_deadline?: string | null
  server_time?: string | null
  product?: ProductSummary | null
  seller?: SellerSummary | null
  creator?: AuctionCreatorSummary | null
  demand?: ReverseDemand | null
  winning_offer?: ReverseOffer | null
  reverse_contract_version?: number | null
  viewer?: AuctionViewerCapabilities | null
  viewer_capabilities?: AuctionViewerCapabilities | null
  viewer_is_creator?: boolean
  viewer_is_winning_seller?: boolean
  viewer_can_offer?: boolean
  viewer_can_pay?: boolean
  viewer_can_cancel?: boolean
}

export interface AuctionCreatorSummary {
  id: string
  display_name: string
  avatar_url?: string | null
}

export interface ReverseDemand {
  title: string
  description: string
  category_id: number
}

export interface AuctionViewerCapabilities {
  is_creator?: boolean
  is_seller?: boolean
  can_offer?: boolean
  can_cancel?: boolean
  is_leading_offer_seller?: boolean
  is_winning_seller?: boolean
  is_winner?: boolean
  can_checkout?: boolean
  can_pay?: boolean
  order_role?: 'buyer' | 'seller' | null
}

export interface ReverseOffer {
  id?: number
  bid_id: number
  amount: number
  seller_label?: string | null
  seller?: SellerSummary | null
  product: ProductSummary
  is_leading?: boolean
  is_self?: boolean
  placed_at?: string | null
}

export interface ProductSummary {
  id: string
  title: string
  slug: string
  description?: string | null
  category_id?: number | null
  condition: string
  images: ProductImage[]
}

export interface ProductImage {
  id: number
  url: string
  thumbnail_url: string
  is_primary: boolean
  sort_order: number
}

export interface SellerSummary {
  id: string
  display_name: string
  avatar_url: string | null
  avg_rating: number
  total_sales: number
}

export interface BidHistoryItem {
  id: number
  bidder_label: string
  bidder_id?: number | string | null
  participant_id?: number | null
  amount: number
  type: BidType
  is_winning: boolean
  is_self?: boolean
  placed_at: string
  product?: ProductSummary | null
}

export interface AutoBid {
  id: number
  auction_id: number
  max_price: number
  current_bid_amount: number
  status: AutoBidStatus
  trigger_count: number | null
  created_at: string | null
  updated_at: string | null
}

export interface AutoBidEvent {
  type: 'auto_bid_configured' | 'auto_bid_triggered' | 'auto_bid_exhausted'
  data: Record<string, unknown>
  created_at: string
}

export interface ChatMessage {
  id: number
  auction_id: number
  user_id: number | null
  message_type: 'user' | 'system_bid' | 'system_extension' | 'system_end'
  content: string
  sender_label: string | null
  sent_at: string
}

export interface Participant {
  id?: number | null
  participant_id?: number | null
  label: string
  user_id?: number | string | null
  bid_count: number
  highest_amount?: number | null
  best_amount?: number | null
  last_bid_at: string
  is_active: boolean
  is_self?: boolean
}

export interface AuditLogEvent {
  type: string
  actor_label: string
  data: Record<string, unknown>
  occurred_at: string
}

export type WsEventType =
  | 'room.joined'
  | 'room.join_failed'
  | 'bid.placed'
  | 'autobid.triggered'
  | 'auction.extended'
  | 'auction.ended'
  | 'auction.started'
  | 'dutch.price_tick'
  | 'sealed.revealed'
  | 'participant.joined'
  | 'participant.left'
  | 'chat.message'

export interface WsEvent<T = unknown> {
  type: WsEventType
  payload: T
}

export interface BidPlacedPayload {
  auction_id: string
  bid_id?: number
  bidder_label?: string
  bidder_id?: number | string | null
  participant_id?: number | null
  is_self?: boolean
  amount?: number
  current_price?: number
  bid_count: number
  bid_type?: BidType
  masked?: boolean
  product?: ProductSummary | null
  server_time?: string | null
}

export interface AuctionExtendedPayload {
  auction_id: string
  new_ends_at: string
  extension_count: number
  reason: string
}

export interface AuctionEndedPayload {
  auction_id: string
  winner_label: string | null
  winner_id?: number | string | null
  winner_user_id?: number | string | null
  winner_is_self?: boolean
  final_price: number
  bid_count: number
  reason: string
  order_id?: number | string | null
  checkout_url?: string | null
  payment_deadline?: string | null
  server_time?: string | null
}

export interface DutchPriceTickPayload {
  auction_id: string
  new_price: number
  old_price: number
  server_time?: string | null
}

export interface SealedRevealedPayload {
  auction_id: string
  current_price: number
  bid_count: number
  winner_label?: string | null
  winner_id?: number | string | null
  winner_user_id?: number | string | null
  winner_is_self?: boolean
  order_id?: number | string | null
  checkout_url?: string | null
  payment_deadline?: string | null
  server_time?: string | null
}

export interface ParticipantPayload {
  auction_id: string
  participant_count: number
}

export interface RoomJoinedPayload extends ParticipantPayload {
  participant_id?: number | null
  bidder_label?: string | null
  official_participant?: boolean
  server_time?: string | null
  product?: ProductSummary | null
}

export interface AuctionStartedPayload {
  auction_id: string
  starts_at?: string | null
  status?: AuctionStatus
  server_time?: string | null
}

export interface RoomJoinFailedPayload {
  auction_id?: string
  message?: string
}

export interface RoomPresenceResponse {
  auction_id: string
  participant_count: number
  participant?: {
    id?: number | null
    participant_id?: number | null
    label?: string | null
    bidder_label?: string | null
  } | null
  server_time?: string | null
}

export interface BidActionResponse {
  bid_id?: number
  bidder_label?: string | null
  bidder_id?: number | string | null
  participant_id?: number | null
  current_price?: number
  bid_count?: number
  order_id?: number | string | null
  checkout_url?: string | null
  payment_url?: string | null
  payment_deadline?: string | null
  server_time?: string | null
}
