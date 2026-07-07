interface AuctionDisplaySource {
  id?: string | null
  mode?: string | null
  title?: string | null
  product?: {
    title?: string | null
  } | null
}

function trimText(value?: string | null): string {
  return value?.trim() ?? ''
}

function compactCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function isSyntheticAuctionTitle(value: string, auctionId?: string | null): boolean {
  const normalized = value.toLowerCase()
  const compact = compactCode(value)
  const shortId = auctionId ? auctionId.slice(0, 8).toLowerCase() : ''

  if (shortId && normalized.includes(shortId)) return true
  if (/^#?[0-9a-f]{6,}$/i.test(value.trim())) return true
  if (/^phiên\s+#?[0-9a-f-]{6,}$/i.test(value.trim())) return true
  if (normalized.startsWith('yêu cầu đấu giá ngược')) return true
  return compact === 'phien' || compact === 'phiendaugia'
}

export function getAuctionAssetTitle(auction: AuctionDisplaySource): string {
  const productTitle = trimText(auction.product?.title)
  if (productTitle) return productTitle

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
