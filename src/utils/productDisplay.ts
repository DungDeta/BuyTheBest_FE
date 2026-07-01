const PRODUCT_CONDITION_LABELS: Record<string, string> = {
  new: 'Mới',
  like_new: 'Như mới',
  good: 'Tốt',
  fair: 'Khá',
  poor: 'Kém',
  used: 'Đã sử dụng',
  refurbished: 'Tân trang',
}

export function getProductConditionLabel(
  condition?: string | null,
  fallback = '—',
): string {
  if (!condition) return fallback
  return PRODUCT_CONDITION_LABELS[condition] ?? condition
}
