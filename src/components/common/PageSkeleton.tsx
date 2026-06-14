import { CardSkeleton } from './CardSkeleton'
import '@/pages/Public/error-pages.css'

interface PageSkeletonProps {
  type?: 'list' | 'detail' | 'grid'
}

function GridSkeleton() {
  return (
    <div className="skeleton-grid">
      <CardSkeleton />
      <CardSkeleton titleWidth="60%" priceWidth="35%" subtextWidth="50%" />
      <CardSkeleton titleWidth="75%" priceWidth="45%" subtextWidth="65%" />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="skeleton-list">
      {[80, 65, 72, 58].map((w, i) => (
        <div key={i} className="skeleton-list__item">
          <div className="skeleton-bar" style={{ height: 14, width: '100%' }} />
          <div className="skeleton-bar" style={{ height: 12, width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="skeleton-detail">
      <div className="skeleton-detail__image" />
      <div className="skeleton-detail__info">
        <div className="skeleton-bar" style={{ height: 20, width: '90%' }} />
        <div className="skeleton-bar" style={{ height: 14, width: '60%' }} />
        <div className="skeleton-bar" style={{ height: 14, width: '75%' }} />
        <div className="skeleton-bar" style={{ height: 14, width: '50%' }} />
        <div className="skeleton-bar" style={{ height: 36, width: '40%', marginTop: 8 }} />
      </div>
    </div>
  )
}

export function PageSkeleton({ type = 'grid' }: PageSkeletonProps) {
  return (
    <div style={{ padding: '24px' }}>
      {/* Header bar */}
      <div className="skeleton-bar" style={{ height: 20, width: '100%', marginBottom: 12 }} />
      {/* Content bars */}
      <div className="skeleton-bar" style={{ height: 14, width: '80%', marginBottom: 8 }} />
      <div className="skeleton-bar" style={{ height: 14, width: '65%', marginBottom: 24 }} />

      {type === 'grid' && <GridSkeleton />}
      {type === 'list' && <ListSkeleton />}
      {type === 'detail' && <DetailSkeleton />}
    </div>
  )
}
