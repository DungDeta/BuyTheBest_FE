import type { Order, OrderProductImage } from '@/types/order'

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

  if (words.length === 1) {
    return Array.from(words[0] ?? 'BTB').slice(0, 3).join('').toUpperCase()
  }

  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()
}
