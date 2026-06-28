import dayjs from 'dayjs'
import { DisputeActions } from './DisputeActions'
import { DisputeChat } from './DisputeChat'
import { DisputeTimeline } from './DisputeTimeline'
import { EvidenceGrid } from './EvidenceGrid'
import type { OrderDispute } from '@/types/order'

interface DisputeSectionProps {
  dispute: OrderDispute
  currentUserId: string
  buyerId?: number
  sellerId?: number
  isBuyer: boolean
  isSeller: boolean
  onUpdate: () => void
}

type DisputeStatusColor = {
  color: string
  borderColor: string
  background: string
}

const REASON_LABELS: Record<string, string> = {
  item_not_received: 'Chưa nhận được hàng',
  item_damaged: 'Hàng bị hư hỏng',
  item_not_as_described: 'Hàng không đúng mô tả',
  fake_item: 'Hàng giả / nhái',
  other: 'Lý do khác',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Đang mở',
  awaiting_seller: 'Chờ Seller',
  awaiting_buyer: 'Chờ Buyer',
  admin_review: 'Admin xem xét',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
}

function getStatusColors(status: string): DisputeStatusColor {
  switch (status) {
    case 'open':
    case 'awaiting_seller':
      return { color: '#cc6d00', borderColor: '#cc6d00', background: '#fff8e1' }
    case 'awaiting_buyer':
    case 'admin_review':
      return { color: '#0654ba', borderColor: '#0654ba', background: '#e3f2fd' }
    case 'resolved':
      return { color: '#118c4f', borderColor: '#118c4f', background: '#e8f5e9' }
    case 'closed':
      return { color: '#888', borderColor: '#888', background: '#f5f5f5' }
    default:
      return { color: '#888', borderColor: '#888', background: '#f5f5f5' }
  }
}

function sectionClass(status: string): string {
  if (status === 'resolved' || status === 'closed') return 'dispute-section dispute-section--resolved'
  return 'dispute-section'
}

function canUploadEvidence(status: string, isBuyer: boolean, isSeller: boolean): boolean {
  if (status === 'open' || status === 'awaiting_seller') return isBuyer || isSeller
  if (status === 'awaiting_buyer') return isBuyer
  return false
}

export function DisputeSection({
  dispute,
  currentUserId,
  buyerId,
  sellerId,
  isBuyer,
  isSeller,
  onUpdate,
}: DisputeSectionProps) {
  const statusColors = getStatusColors(dispute.status)
  const shortId = dispute.id.slice(0, 12).toUpperCase()
  const canUpload = canUploadEvidence(dispute.status, isBuyer, isSeller)

  return (
    <section className={sectionClass(dispute.status)} aria-labelledby="dispute-heading">
      <div className="dispute-header">
        <div>
          <h2
            id="dispute-heading"
            className="dispute-header__title"
          >
            Khiếu nại #{shortId}
          </h2>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--color-muted)',
              marginTop: 4,
            }}
          >
            {REASON_LABELS[dispute.reason] ?? dispute.reason}
            {' · '}
            Mở lúc {dayjs(dispute.created_at).format('DD/MM/YYYY HH:mm')}
          </div>
        </div>
        <div
          className="dispute-header__status"
          style={{
            color: statusColors.color,
            borderColor: statusColors.borderColor,
            background: statusColors.background,
          }}
          aria-label={`Trạng thái khiếu nại: ${STATUS_LABELS[dispute.status] ?? dispute.status}`}
        >
          {STATUS_LABELS[dispute.status] ?? dispute.status.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--color-muted)',
          marginBottom: 20,
          lineHeight: 1.6,
          padding: '12px 14px',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 3,
        }}
      >
        {dispute.description}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 10,
          }}
        >
          Bằng chứng
        </div>
        <EvidenceGrid disputeId={dispute.id} canUpload={canUpload} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 10,
          }}
        >
          Tiến trình
        </div>
        <DisputeTimeline dispute={dispute} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 10,
          }}
        >
          Tin nhắn
        </div>
        <DisputeChat
          disputeId={dispute.id}
          currentUserId={currentUserId}
          currentUserRole={isSeller ? 'seller' : 'buyer'}
          buyerId={buyerId}
          sellerId={sellerId}
          disputeStatus={dispute.status}
        />
      </div>

      <DisputeActions
        dispute={dispute}
        disputeId={dispute.id}
        isBuyer={isBuyer}
        isSeller={isSeller}
        onUpdate={onUpdate}
      />
    </section>
  )
}
