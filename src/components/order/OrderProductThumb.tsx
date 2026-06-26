import { useEffect, useState } from 'react'
import { getOrderProductInitials } from '@/utils/orderDisplay'
import { getDemoProductImage } from '@/utils/demoProductImages'

interface OrderProductThumbProps {
  className: string
  src: string | null
  title: string
}

export function OrderProductThumb({ className, src, title }: OrderProductThumbProps) {
  const fallbackSrc = getDemoProductImage(title)
  const candidates = [src, fallbackSrc].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  )
  const [attempt, setAttempt] = useState(0)
  const imageSrc = candidates[attempt] ?? null

  useEffect(() => {
    setAttempt(0)
  }, [src, fallbackSrc])

  return (
    <div className={className} aria-hidden="true">
      {imageSrc ? (
        <img src={imageSrc} alt="" onError={() => setAttempt((value) => value + 1)} />
      ) : (
        <span>{getOrderProductInitials(title)}</span>
      )}
    </div>
  )
}
