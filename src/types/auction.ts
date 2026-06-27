export type AuctionMode = 'english' | 'dutch' | 'sealed_bid' | 'reverse'
export type AuctionStatus = 'scheduled' | 'active' | 'ended' | 'closed_bin' | 'cancelled'
export type BidType = 'manual' | 'auto' | 'buy_now'
export type AutoBidStatus = 'active' | 'cancelled' | 'exhausted' | 'won'

export interface Auction {
  id: string
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
}

export interface ProductSummary {
  id: string
  title: string
  slug: string
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
  highest_amount: number
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
  bid_id: number
  bidder_label: string
  bidder_id?: number | string | null
  participant_id?: number | null
  is_self?: boolean
  amount: number
  current_price: number
  bid_count: number
  bid_type: BidType
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
