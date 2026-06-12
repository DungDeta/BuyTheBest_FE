interface BidStatusBannerProps {
  isLeading: boolean
  outbidBy: string | null
}

export function BidStatusBanner({ isLeading, outbidBy }: BidStatusBannerProps) {
  if (outbidBy === null && !isLeading) return null

  if (isLeading) {
    return (
      <div className="bid-status bid-status--leading" role="status" aria-live="polite">
        ✓ Bạn đang dẫn đầu
      </div>
    )
  }

  return (
    <div className="bid-status bid-status--outbid" role="status" aria-live="polite">
      × Bạn đang bị vượt bởi {outbidBy}
    </div>
  )
}
