import { useEffect, useState } from 'react'
import { getOrderProductInitials } from '@/utils/orderDisplay'

interface OrderProductThumbProps {
  className: string
  src: string | null
  title: string
}

export function OrderProductThumb({ className, src, title }: OrderProductThumbProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <div className={className} aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{getOrderProductInitials(title)}</span>
      )}
    </div>
  )
}
