export interface CurrentBidderIdentity {
  userId: string | null
  bidderLabel: string | null
  participantId: number | null
}

function sameId(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  return a != null && b != null && String(a) === String(b)
}

export function formatParticipantLabel(
  label: string | null | undefined,
  role: 'bidder' | 'seller' = 'bidder',
): string {
  const anonymousLabel = role === 'seller' ? 'Người bán' : 'Người đặt giá'
  if (!label) return anonymousLabel

  const normalized = label.trim()
  if (!normalized) return anonymousLabel

  const roleAliasMatch = normalized.match(/^(seller|buyer|admin)(?:\s*#?\s*(\d+))?$/i)
  if (roleAliasMatch) {
    const normalizedRole = roleAliasMatch[1]?.toLowerCase()
    const roleLabel = normalizedRole === 'seller'
      ? 'Người bán'
      : normalizedRole === 'buyer'
        ? 'Người mua'
        : 'Quản trị viên'
    return roleAliasMatch[2] ? `${roleLabel} ${roleAliasMatch[2]}` : roleLabel
  }
  const bidderMatch = normalized.match(/^bidder(?:\s*#?\s*(\d+))?$/i)
  if (bidderMatch) {
    return bidderMatch[1] ? `${anonymousLabel} ${bidderMatch[1]}` : anonymousLabel
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
  // When the authenticated API supplies an explicit answer it is authoritative.
  // In particular, `false` must stop anonymous room-label heuristics from
  // marking another seller as the current user after ranking is reordered.
  if (typeof item.is_self === 'boolean') return item.is_self
  if (sameId(item.user_id, identity.userId)) return true
  if (sameId(item.bidder_id, identity.userId)) return true
  if (sameId(item.participant_id, identity.participantId)) return true
  if (sameId(item.id, identity.participantId)) return true
  if (identity.bidderLabel && item.label === identity.bidderLabel) return true
  if (identity.bidderLabel && item.bidder_label === identity.bidderLabel) return true
  return false
}
