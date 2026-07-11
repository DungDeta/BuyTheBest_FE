import type { DisputeEvidence } from '@/types/order'

function firstUsableUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value && /^(https?:|data:|blob:)/i.test(value)) return value
  }
  return null
}

export function resolveEvidenceFileUrl(evidence: DisputeEvidence): string | null {
  // object_key remains as a backwards-compatible fallback only when an older
  // API already returned an absolute URL in that field. Raw storage keys must
  // never be rendered as browser-relative URLs.
  return firstUsableUrl(evidence.file_url, evidence.object_key)
}

export function resolveEvidencePreviewUrl(evidence: DisputeEvidence): string | null {
  return firstUsableUrl(
    evidence.thumbnail_url,
    evidence.thumbnail_key,
    evidence.file_url,
    evidence.object_key,
  )
}
