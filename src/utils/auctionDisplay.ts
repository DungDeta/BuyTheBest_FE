interface AuctionDisplaySource {
  id?: string | null
  mode?: string | null
  title?: string | null
  product?: {
    id?: string | null
    title?: string | null
    slug?: string | null
  } | null
}

function trimText(value?: string | null): string {
  return value?.trim() ?? ''
}

function compactCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function isSyntheticAuctionTitle(value: string, auctionId?: string | null): boolean {
  const normalized = value.toLowerCase()
  const compact = compactCode(value)
  const shortId = auctionId ? auctionId.slice(0, 8).toLowerCase() : ''

  if (shortId && normalized.includes(shortId)) return true
  if (/^#?[0-9a-f]{6,}$/i.test(value.trim())) return true
  if (/^phiên\s+#?[0-9a-f-]{6,}$/i.test(value.trim())) return true
  if (/^yêu cầu đấu giá ngược(?:\s+tài sản)?(?:\s+#?[0-9a-f-]{6,})?$/i.test(value.trim())) return true
  if (compact.startsWith('yeucaudaugianguoc')) return true
  return compact === 'phien' || compact === 'phiendaugia'
}

export function getReadableProductTitle(
  product?: { id?: string | null; title?: string | null; slug?: string | null } | null,
  fallback = 'Sản phẩm chưa đặt tên',
): string {
  const title = trimText(product?.title)
  const id = trimText(product?.id)
  if (
    title &&
    !isSyntheticAuctionTitle(title, id) &&
    compactCode(title) !== compactCode(id)
  ) {
    return title
  }

  const slug = trimText(product?.slug)
  if (
    slug &&
    compactCode(slug) !== compactCode(id) &&
    !isSyntheticAuctionTitle(slug, id)
  ) {
    return slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  return fallback
}

export function getAuctionAssetTitle(auction: AuctionDisplaySource): string {
  if (auction.product) {
    const fallback = auction.mode === 'reverse' ? '' : 'Sản phẩm chưa đặt tên'
    const productTitle = getReadableProductTitle(auction.product, fallback)
    if (productTitle) return productTitle
  }

  const title = trimText(auction.title)
  if (auction.mode === 'reverse' && isSyntheticAuctionTitle(title, auction.id)) {
    return ''
  }
  return title
}

export function getAuctionDisplayTitle(auction: AuctionDisplaySource): string {
  const assetTitle = getAuctionAssetTitle(auction)

  if (auction.mode === 'reverse') {
    return assetTitle
      ? `Yêu cầu đấu giá ngược tài sản ${assetTitle}`
      : 'Yêu cầu đấu giá ngược'
  }

  if (assetTitle) return assetTitle

  const shortId = auction.id?.slice(0, 8).toUpperCase()
  return shortId ? `Phiên đấu giá #${shortId}` : 'Phiên đấu giá'
}
