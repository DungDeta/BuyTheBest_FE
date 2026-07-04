export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded'
export type EscrowStatus = 'pending' | 'held' | 'released' | 'refunded' | 'partial_refund' | 'disputed'
export type PaymentStatus = 'initiated' | 'success' | 'failed' | 'refunded'
export type ShipmentStatus = 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'failed'
export type DisputeStatus = 'open' | 'awaiting_seller' | 'awaiting_buyer' | 'admin_review' | 'resolved' | 'closed'
export type DisputeReason = 'item_not_received' | 'item_damaged' | 'item_not_as_described' | 'fake_item' | 'other'
export type DisputeResolution = 'pending' | 'refund_buyer' | 'release_seller' | 'partial_refund'

export interface Order {
  id: string
  auction_id: number | string
  buyer_id: number
  seller_id: number
  final_price: number
  shipping_name?: string | null
  shipping_phone?: string | null
  shipping_address?: string | null
  status: OrderStatus
  payment_deadline?: string | null
  paid_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  cancel_reason?: string | null
  created_at: string
  updated_at: string
  viewer_role?: 'buyer' | 'seller'
  auction?: OrderAuction | null
  payment?: OrderPayment | null
  shipment?: OrderShipment | null
  dispute?: OrderDispute | null
  review?: OrderReview | null
  seller?: OrderSeller | null
  buyer?: OrderBuyer | null
}

export interface OrderAuction {
  id: string
  mode: string
  product_title?: string
  product_image_url?: string | null
  bid_count?: number
  product?: {
    id: string | number
    title: string
    description?: string
    slug: string
    condition: string
    images?: OrderProductImage[]
  } | null
  seller?: {
    id: string
    display_name: string
    avatar_url?: string | null
  } | null
}

export interface OrderProductImage {
  id?: string | number
  object_key?: string | null
  thumbnail_key?: string | null
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean
  sort_order?: number
}

export interface OrderPayment {
  id: number
  provider: string
  amount: number
  platform_fee: number
  refund_amount: number
  seller_amount: number
  status: PaymentStatus
  escrow_status: EscrowStatus
  auto_release_at?: string | null
  released_at?: string | null
  completed_at?: string | null
}

export interface OrderShipment {
  id: number
  tracking_number?: string | null
  carrier?: string | null
  status: ShipmentStatus
  shipped_at?: string | null
  delivered_at?: string | null
  buyer_confirmed_at?: string | null
}

export interface OrderDispute {
  id: string
  reason: DisputeReason
  description: string
  status: DisputeStatus
  resolution: DisputeResolution
  seller_response_deadline?: string | null
  buyer_counter_deadline?: string | null
  admin_notes?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface OrderSeller {
  id: string
  display_name: string
  avatar_url?: string | null
  avg_rating: number
}

export interface OrderBuyer {
  id: string
  display_name: string
  avatar_url?: string | null
}

export interface OrderReview {
  id: number
  rating: number
  comment?: string | null
  seller_reply?: string | null
  reply_at?: string | null
  created_at: string
}

export interface DisputeMessage {
  id: number
  sender_id: number
  sender_role?: 'buyer' | 'seller' | 'admin'
  content: string
  is_admin: boolean
  sent_at: string
}

export interface DisputeEvidence {
  id: number
  uploader_user_id: number
  object_key?: string
  thumbnail_key?: string | null
  file_url?: string
  thumbnail_url?: string | null
  file_type: 'image' | 'video' | 'document'
  description?: string | null
  created_at: string
}

export interface VnpayReturnResponse {
  order_id: string
  success: boolean
}

export interface AddressRequest {
  shipping_name: string
  shipping_phone: string
  shipping_address: string
}

export interface ShipRequest {
  tracking_number: string
  carrier: string
}

export interface CancelRequest {
  reason?: string
}

export interface OpenDisputeRequest {
  reason: DisputeReason
  description: string
}

export interface ReviewRequest {
  rating: number
  comment?: string
}

export interface ReviewReplyRequest {
  reply: string
}
