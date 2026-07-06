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

export function getAuctionAssetTitle(auction: AuctionDisplaySource): string {
  return trimText(auction.product?.title) || trimText(auction.title)
}

export function getAuctionDisplayTitle(auction: AuctionDisplaySource): string {
  const assetTitle = getAuctionAssetTitle(auction)

  if (auction.mode === 'reverse') {
    return assetTitle
      ? `Yêu cầu đấu giá ngược tài sản ${assetTitle}`
      : 'Yêu cầu đấu giá ngược tài sản'
  }

  if (assetTitle) return assetTitle

  const shortId = auction.id?.slice(0, 8).toUpperCase()
  return shortId ? `Phiên đấu giá #${shortId}` : 'Phiên đấu giá'
}
