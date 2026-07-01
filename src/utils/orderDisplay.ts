import type { Order, OrderProductImage } from '@/types/order'
import { getProductConditionLabel } from '@/utils/productDisplay'

const AUCTION_MODE_LABELS: Record<string, string> = {
  english: 'Giá tăng dần',
  dutch: 'Giá giảm dần',
  sealed_bid: 'Đấu giá kín',
  reverse: 'Đấu giá ngược',
}

const SYSTEM_CANCEL_REASON_LABELS: Record<string, string> = {
  'payment deadline expired': 'Đã quá hạn thanh toán',
}

function isRenderableUrl(value?: string | null): value is string {
  return Boolean(value && /^(https?:|data:|blob:|\/)/i.test(value))
}

function firstRenderableUrl(values: Array<string | null | undefined>): string | null {
  return values.find(isRenderableUrl) ?? null
}

function primaryImage(images?: OrderProductImage[]): OrderProductImage | null {
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return sorted.find((img) => img.is_primary) ?? sorted[0] ?? null
}

export function getOrderProductTitle(order: Order): string {
  return order.auction?.product?.title ?? order.auction?.product_title ?? 'Sản phẩm đấu giá'
}

export function getOrderProductConditionLabel(condition?: string | null): string | null {
  if (!condition) return null
  return getProductConditionLabel(condition)
}

export function getOrderAuctionModeLabel(mode?: string | null): string | null {
  if (!mode) return null
  return AUCTION_MODE_LABELS[mode] ?? mode
}

export function getOrderCancelReasonLabel(reason?: string | null): string | null {
  if (!reason) return null
  return SYSTEM_CANCEL_REASON_LABELS[reason] ?? reason
}

export function getOrderProductImageUrl(order: Order): string | null {
  const image = primaryImage(order.auction?.product?.images)
  return firstRenderableUrl([
    image?.thumbnail_url,
    image?.url,
    image?.thumbnail_key,
    image?.object_key,
    order.auction?.product_image_url,
  ])
}

export function getOrderSellerName(order: Order): string | null {
  return order.auction?.seller?.display_name ?? order.seller?.display_name ?? null
}

export function getOrderBuyerName(order: Order): string | null {
  return order.buyer?.display_name ?? null
}

export function getOrderProductInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'BTB'

  const initials = words
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return initials || 'BTB'
}
