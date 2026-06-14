import '@/pages/Public/error-pages.css'

interface CardSkeletonProps {
  titleWidth?: string
  priceWidth?: string
  subtextWidth?: string
}

export function CardSkeleton({
  titleWidth = '70%',
  priceWidth = '40%',
  subtextWidth = '60%',
}: CardSkeletonProps) {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card__image" />
      <div className="skeleton-card__body">
        <div className="skeleton-bar" style={{ height: 14, width: titleWidth }} />
        <div className="skeleton-bar" style={{ height: 16, width: priceWidth }} />
        <div className="skeleton-bar" style={{ height: 12, width: subtextWidth }} />
      </div>
    </div>
  )
}
