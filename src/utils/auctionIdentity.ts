export interface CurrentBidderIdentity {
  userId: string | null
  bidderLabel: string | null
  participantId: number | null
}

function sameId(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  return a != null && b != null && String(a) === String(b)
}

export function formatParticipantLabel(label: string | null | undefined): string {
  if (!label) return 'Người đặt giá'

  const normalized = label.trim()
  const bidderMatch = normalized.match(/^bidder(?:\s*#?\s*(\d+))?$/i)
  if (bidderMatch) {
    return bidderMatch[1] ? `Người đặt giá ${bidderMatch[1]}` : 'Người đặt giá'
  }
  if (/^system$/i.test(normalized)) return 'Hệ thống'
  return normalized
}

export function isSelfBidder(
  item: {
    is_self?: boolean
    user_id?: number | string | null
    bidder_id?: number | string | null
    participant_id?: number | null
    id?: number | null
    label?: string | null
    bidder_label?: string | null
  },
  identity: CurrentBidderIdentity,
): boolean {
  if (item.is_self === true) return true
  if (sameId(item.user_id, identity.userId)) return true
  if (sameId(item.bidder_id, identity.userId)) return true
  if (sameId(item.participant_id, identity.participantId)) return true
  if (sameId(item.id, identity.participantId)) return true
  if (identity.bidderLabel && item.label === identity.bidderLabel) return true
  if (identity.bidderLabel && item.bidder_label === identity.bidderLabel) return true
  return false
}
