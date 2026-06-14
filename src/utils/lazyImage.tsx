interface LazyImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  placeholder?: string
}

export function LazyImage({ src, alt, className, width, height, placeholder }: LazyImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      style={{ background: placeholder ?? 'var(--color-bg)' }}
    />
  )
}
