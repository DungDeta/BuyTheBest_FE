import dayjs from 'dayjs'
import type { OrderDispute } from '@/types/order'

interface DisputeTimelineProps {
  dispute: OrderDispute
}

type TlState = 'done' | 'active' | 'warn' | 'default'

interface TlItem {
  title: string
  desc: string
  ts: string | null
  state: TlState
}

const RESOLUTION_LABELS: Record<string, string> = {
  refund_buyer: 'Hoàn tiền cho người mua',
  release_seller: 'Giải ngân cho người bán',
  partial_refund: 'Hoàn tiền một phần',
  pending: 'Đang xử lý',
}

function fmtTs(ts: string | null | undefined): string {
  if (!ts) return ''
  return dayjs(ts).format('DD/MM/YYYY HH:mm')
}

function buildItems(dispute: OrderDispute): TlItem[] {
  const { status, created_at, seller_response_deadline, buyer_counter_deadline, resolved_at, resolution } = dispute
  const items: TlItem[] = []

  items.push({
    title: 'Người mua mở khiếu nại',
    desc: `Lý do: ${reasonLabel(dispute.reason)}`,
    ts: fmtTs(created_at),
    state: 'done',
  })

  const sellerDone = status === 'awaiting_buyer' || status === 'admin_review' || status === 'resolved' || status === 'closed'
  if (sellerDone) {
    items.push({
      title: 'Người bán phản hồi',
      desc: 'Người bán đã gửi phản hồi khiếu nại',
      // The API exposes the response deadline, not the actual response time.
      // Omitting the timestamp is more accurate than presenting the deadline as an event time.
      ts: null,
      state: 'done',
    })
  } else if (status === 'open' || status === 'awaiting_seller') {
    items.push({
      title: 'Chờ người bán phản hồi',
      desc: seller_response_deadline
        ? `Hạn chót: ${fmtTs(seller_response_deadline)}`
        : 'Người bán cần phản hồi trong thời gian quy định',
      ts: null,
      state: 'warn',
    })
  }

  if (status === 'awaiting_buyer') {
    items.push({
      title: 'Người mua phản hồi',
      desc: buyer_counter_deadline
        ? `Hạn chót: ${fmtTs(buyer_counter_deadline)}`
        : 'Người mua cần chấp nhận hoặc chuyển quản trị viên xem xét',
      ts: null,
      state: 'active',
    })
  }

  if (status === 'admin_review') {
    items.push({
      title: 'Quản trị viên xem xét',
      desc: 'Khiếu nại đang được quản trị viên xử lý',
      ts: null,
      state: 'active',
    })
  }

  if (status === 'resolved' || status === 'closed') {
    items.push({
      title: 'Đã giải quyết',
      desc: RESOLUTION_LABELS[resolution] ?? resolution,
      ts: fmtTs(resolved_at),
      state: 'done',
    })
  }

  if (status === 'closed') {
    items.push({
      title: 'Khiếu nại đã đóng',
      desc: 'Khiếu nại đã được đóng lại',
      ts: null,
      state: 'done',
    })
  }

  return items
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    item_not_received: 'Chưa nhận được hàng',
    item_damaged: 'Hàng bị hư hỏng',
    item_not_as_described: 'Hàng không đúng mô tả',
    fake_item: 'Hàng giả / nhái',
    other: 'Lý do khác',
  }
  return map[reason] ?? reason
}

export function DisputeTimeline({ dispute }: DisputeTimelineProps) {
  const items = buildItems(dispute)

  return (
    <div className="dispute-timeline" role="list" aria-label="Tiến trình khiếu nại">
      {items.map((item, idx) => {
        const cls = [
          'dispute-tl-item',
          item.state === 'done' ? 'dispute-tl-item--done' : '',
          item.state === 'active' ? 'dispute-tl-item--active' : '',
          item.state === 'warn' ? 'dispute-tl-item--warn' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={idx} className={cls} role="listitem">
            {item.ts && <div className="dispute-tl-item__ts">{item.ts}</div>}
            <div className="dispute-tl-item__title">{item.title}</div>
            {item.desc && <div className="dispute-tl-item__desc">{item.desc}</div>}
          </div>
        )
      })}
    </div>
  )
}
