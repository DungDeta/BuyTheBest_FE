const DEMO_PRODUCT_IMAGES = [
  {
    match: ['iphone 15', 'iphone'],
    src: '/demo-products/iphone-15-pro-max.png',
  },
  {
    match: ['macbook pro m3', 'macbook'],
    src: '/demo-products/macbook-pro-m3.png',
  },
  {
    match: ['sony wh-1000xm5', 'wh-1000xm5', 'sony'],
    src: '/demo-products/sony-wh-1000xm5.png',
  },
]

export function getDemoProductImage(title?: string | null): string | null {
  if (!title) return null

  const normalized = title.toLowerCase()
  return DEMO_PRODUCT_IMAGES.find((item) =>
    item.match.some((keyword) => normalized.includes(keyword)),
  )?.src ?? null
}
