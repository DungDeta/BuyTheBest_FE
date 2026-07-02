import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import dayjs from 'dayjs'
import { publicGet } from '@/api/api'
import { formatParticipantLabel } from '@/utils/auctionIdentity'
import type { AuditLogEvent } from '@/types/auction'

interface AuctionLogProps {
  auctionId: string
}

const ACTION_LABELS: Record<string, string> = {
  AuctionCreated: 'Tạo phiên đấu giá',
  AuctionStarted: 'Bắt đầu phiên đấu giá',
  AuctionEnded: 'Kết thúc phiên đấu giá',
  BidPlaced: 'Có lượt đặt giá mới',
  AntiSnipingExtended: 'Gia hạn chống đặt giá phút cuối',
  auction_created: 'Tạo phiên đấu giá',
  auction_started: 'Bắt đầu phiên đấu giá',
  auction_ended: 'Kết thúc phiên đấu giá',
  bid_placed: 'Có lượt đặt giá mới',
  anti_sniping_extended: 'Gia hạn chống đặt giá phút cuối',
}

const ACTOR_LABELS: Record<string, string> = {
  System: 'Hệ thống',
  Seller: 'Người bán',
  Buyer: 'Người mua',
  Admin: 'Quản trị viên',
}

const MODE_LABELS: Record<string, string> = {
  english: 'Giá tăng dần',
  dutch: 'Giá giảm dần',
  sealed_bid: 'Đấu giá kín',
  reverse: 'Đấu giá ngược',
}

const BID_TYPE_LABELS: Record<string, string> = {
  manual: 'Đặt trực tiếp',
  auto: 'Đặt tự động',
  buy_now: 'Mua ngay',
}

const DETAIL_LABELS: Record<string, string> = {
  mode: 'Hình thức',
  starting_price: 'Giá khởi điểm',
  amount: 'Số tiền đặt',
  final_price: 'Giá cuối',
  bid_id: 'Mã lượt đặt',
  type: 'Kiểu đặt giá',
  bid_type: 'Kiểu đặt giá',
  new_ends_at: 'Thời điểm kết thúc mới',
  winner_label: 'Người thắng',
  admin_forced: 'Kết thúc bởi quản trị viên',
  reason: 'Lý do',
}

function actionLabel(type: string): string {
  return ACTION_LABELS[type] ?? type
}

function actorLabel(actor: string | null | undefined): string {
  if (!actor) return 'Hệ thống'
  return ACTOR_LABELS[actor] ?? formatParticipantLabel(actor)
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function formatVnd(value: unknown): string | null {
  const amount = asNumber(value)
  return amount == null ? null : `${amount.toLocaleString('vi-VN')} ₫`
}

function formatDateTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const date = dayjs(value)
  return date.isValid() ? date.format('DD/MM/YYYY HH:mm:ss') : value
}

function formatDetailValue(key: string, value: unknown): string {
  if (key === 'mode' && typeof value === 'string') return MODE_LABELS[value] ?? value
  if ((key === 'type' || key === 'bid_type') && typeof value === 'string') {
    return BID_TYPE_LABELS[value] ?? value
  }
  if (key.includes('price') || key === 'amount') return formatVnd(value) ?? String(value)
  if (key.endsWith('_at') || key.endsWith('_ends_at')) return formatDateTime(value) ?? String(value)
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'number') return value.toLocaleString('vi-VN')
  return String(value)
}

function compact(items: Array<string | null | undefined>): string[] {
  return items.filter((item): item is string => Boolean(item))
}

function genericDetails(data: Record<string, unknown>): string[] {
  return Object.entries(data).map(([key, value]) => {
    const label = DETAIL_LABELS[key] ?? key.replace(/_/g, ' ')
    return `${label}: ${formatDetailValue(key, value)}`
  })
}

function formatEventDetails(event: AuditLogEvent): string[] {
  const data = event.data ?? {}

  switch (event.type) {
    case 'AuctionCreated':
    case 'auction_created':
      return compact([
        typeof data.mode === 'string' ? `Hình thức: ${MODE_LABELS[data.mode] ?? data.mode}` : null,
        formatVnd(data.starting_price) ? `Giá khởi điểm: ${formatVnd(data.starting_price)}` : null,
      ])

    case 'AuctionStarted':
    case 'auction_started':
      return ['Phiên bắt đầu nhận lượt đặt giá']

    case 'BidPlaced':
    case 'bid_placed':
      return compact([
        formatVnd(data.amount) ? `Số tiền đặt: ${formatVnd(data.amount)}` : null,
        data.bid_id != null ? `Mã lượt đặt: ${formatDetailValue('bid_id', data.bid_id)}` : null,
        data.type != null ? `Kiểu đặt giá: ${formatDetailValue('type', data.type)}` : null,
        data.bid_type != null ? `Kiểu đặt giá: ${formatDetailValue('bid_type', data.bid_type)}` : null,
      ])

    case 'AntiSnipingExtended':
    case 'anti_sniping_extended':
      return compact([
        data.bid_id != null ? `Kích hoạt bởi lượt đặt #${formatDetailValue('bid_id', data.bid_id)}` : null,
        data.new_ends_at != null
          ? `Gia hạn đến ${formatDetailValue('new_ends_at', data.new_ends_at)}`
          : null,
      ])

    case 'AuctionEnded':
    case 'auction_ended':
      return compact([
        data.admin_forced === true ? 'Quản trị viên kết thúc phiên' : null,
        formatVnd(data.final_price) ? `Giá cuối: ${formatVnd(data.final_price)}` : null,
        typeof data.winner_label === 'string' && data.winner_label
          ? `Người thắng: ${formatParticipantLabel(data.winner_label)}`
          : 'Không có người thắng',
      ])

    default:
      return genericDetails(data)
  }
}

export function AuctionLog({ auctionId }: AuctionLogProps) {
  const [events, setEvents] = useState<AuditLogEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchLog() {
      setLoading(true)
      try {
        const res = await publicGet<{ events: AuditLogEvent[] }>(
          `/auctions/${auctionId}/log`
        )
        if (!cancelled && res.data?.events) {
          setEvents(res.data.events)
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLog()
    return () => { cancelled = true }
  }, [auctionId])

  if (loading) {
    return (
      <div className="tab-content tab-content--center" aria-label="Đang tải nhật ký phiên">
        <Spin size="small" />
      </div>
    )
  }

  return (
    <div className="tab-content" aria-label="Nhật ký phiên đấu giá">
      {events.length === 0 ? (
        <div className="tab-content--empty">Không có sự kiện nào</div>
      ) : (
        <table className="audit-table" aria-label="Bảng nhật ký sự kiện">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Hành động</th>
              <th>Người dùng</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => {
              const details = formatEventDetails(event)

              return (
                <tr key={index} aria-label={`Sự kiện ${event.type} lúc ${event.occurred_at}`}>
                  <td className="audit-table__time" data-label="Thời gian">
                    {dayjs(event.occurred_at).format('HH:mm:ss')}
                  </td>
                  <td className="audit-table__action" data-label="Hành động">
                    {actionLabel(event.type)}
                  </td>
                  <td className="audit-table__actor" data-label="Người thực hiện">
                    {actorLabel(event.actor_label)}
                  </td>
                  <td className="audit-table__detail" data-label="Chi tiết">
                    {details.length > 0 ? (
                      <div className="audit-table__detail-list">
                        {details.map((detail) => (
                          <span key={detail} className="audit-table__detail-item">
                            {detail}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="audit-table__detail-empty">Không có chi tiết bổ sung</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
