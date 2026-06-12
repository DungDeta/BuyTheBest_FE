import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import dayjs from 'dayjs'
import { publicGet } from '@/api/api'
import type { AuditLogEvent } from '@/types/auction'

interface AuctionLogProps {
  auctionId: string
}

function formatEventData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toLocaleString('vi-VN') : String(v)}`)
    .join(' · ')
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
      <div className="tab-content tab-content--center" aria-label="Đang tải audit log">
        <Spin size="small" />
      </div>
    )
  }

  return (
    <div className="tab-content" aria-label="Audit log phiên đấu giá">
      <div className="audit-header">
        Tất cả thao tác đều được log công khai
      </div>

      {events.length === 0 ? (
        <div className="tab-content--empty">Không có sự kiện nào</div>
      ) : (
        <table className="audit-table" aria-label="Bảng log sự kiện">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Hành động</th>
              <th>Người dùng</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={index} aria-label={`Sự kiện ${event.type} lúc ${event.occurred_at}`}>
                <td className="audit-table__time">
                  {dayjs(event.occurred_at).format('HH:mm:ss')}
                </td>
                <td className="audit-table__action">{event.type}</td>
                <td className="audit-table__actor">{event.actor_label}</td>
                <td className="audit-table__detail">{formatEventData(event.data)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
