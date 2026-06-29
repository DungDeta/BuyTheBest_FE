import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Empty,
  Input,
  Pagination,
  Table,
  Tabs,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { StopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './admin.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuctionStatus = 'active' | 'scheduled' | 'ended' | 'cancelled' | 'all'

interface AuctionListItem {
  id: string
  title: string
  mode: string
  status: string
  starting_price: number
  current_price: number
  bid_count: number
  starts_at: string
  ends_at: string
  created_at: string
  seller?: { id: number; display_name: string }
}

interface AuctionsPage {
  items: AuctionListItem[]
  total: number
  limit: number
  offset: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const MODE_LABELS: Record<string, string> = {
  english: 'Tiếng Anh',
  dutch: 'Hà Lan',
  sealed: 'Kín',
  reverse: 'Ngược',
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: 'Chờ bắt đầu' },
  active: { color: 'green', label: 'Đang diễn ra' },
  ended: { color: 'default', label: 'Đã kết thúc' },
  cancelled: { color: 'red', label: 'Đã hủy' },
}

const TAB_ITEMS = [
  { key: 'active', label: 'Đang diễn ra' },
  { key: 'scheduled', label: 'Chờ bắt đầu' },
  { key: 'ended', label: 'Đã kết thúc' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: 'all', label: 'Tất cả' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function Component() {
  useDocumentTitle('Admin · Phiên đấu giá')
  const { message, modal } = App.useApp()

  const [status, setStatus] = useState<AuctionStatus>('active')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuctionsPage | null>(null)
  const [loading, setLoading] = useState(true)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<AuctionListItem | null>(null)

  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchList = useCallback(
    async (s: AuctionStatus, p: number) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          limit: PAGE_SIZE,
          offset: (p - 1) * PAGE_SIZE,
        }
        if (s !== 'all') params.status = s

        const res = await privateGet<AuctionsPage>('/admin/auctions', params)
        setData(res.data)
      } catch (err) {
        const e = err as ErrorResponse
        message.error(e?.error ?? 'Không tải được danh sách phiên đấu giá')
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    fetchList(status, page)
  }, [status, page, fetchList])

  function handleTabChange(key: string) {
    setStatus(key as AuctionStatus)
    setPage(1)
  }

  function openDrawer(record: AuctionListItem) {
    setDrawerOpen(true)
    setSelected(record)
    setCancelReason('')
  }

  function handleCancelAuction() {
    if (!selected) return
    if (!cancelReason.trim()) {
      message.warning('Vui lòng nhập lý do hủy phiên')
      return
    }

    modal.confirm({
      title: 'Xác nhận hủy phiên đấu giá',
      content: `Bạn chắc chắn muốn hủy phiên "${selected.title}"? Hành động này không thể hoàn tác.`,
      okText: 'Hủy phiên',
      okType: 'danger',
      cancelText: 'Quay lại',
      onOk: async () => {
        setCancelLoading(true)
        try {
          await privatePost(`/admin/auctions/${selected.id}/cancel`, {
            reason: cancelReason.trim(),
          })
          message.success('Đã hủy phiên đấu giá')
          setDrawerOpen(false)
          setSelected(null)
          fetchList(status, page)
        } catch (err) {
          const e = err as ErrorResponse
          message.error(e?.error ?? 'Không thể hủy phiên đấu giá')
        } finally {
          setCancelLoading(false)
        }
      },
    })
  }

  const canCancel = selected?.status === 'active' || selected?.status === 'scheduled'

  const columns: ColumnsType<AuctionListItem> = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      ellipsis: true,
      render: (text, record) => (
        <button
          type="button"
          className="admin-link-btn"
          onClick={() => openDrawer(record)}
        >
          {text}
        </button>
      ),
    },
    {
      title: 'Chế độ',
      dataIndex: 'mode',
      width: 100,
      render: (mode: string) => MODE_LABELS[mode] ?? mode,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (s: string) => {
        const cfg = STATUS_CONFIG[s]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{s}</Tag>
      },
    },
    {
      title: 'Giá hiện tại',
      dataIndex: 'current_price',
      width: 140,
      align: 'right',
      render: (v: number) => v?.toLocaleString('vi-VN') + ' ₫',
    },
    {
      title: 'Lượt đặt',
      dataIndex: 'bid_count',
      width: 90,
      align: 'center',
    },
    {
      title: 'Kết thúc',
      dataIndex: 'ends_at',
      width: 160,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Người bán',
      width: 140,
      render: (_: unknown, record: AuctionListItem) =>
        record.seller?.display_name ?? '—',
    },
  ]

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title">Quản lý phiên đấu giá</h1>
      </div>

      <Tabs
        items={TAB_ITEMS}
        activeKey={status}
        onChange={handleTabChange}
        style={{ marginBottom: 16 }}
      />

      <Table<AuctionListItem>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="Không có phiên nào" /> }}
      />

      {data && data.total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Pagination
            current={page}
            total={data.total}
            pageSize={PAGE_SIZE}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
            size="small"
          />
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selected?.title ?? 'Chi tiết phiên'}
        width={480}
        destroyOnClose
      >
        {selected && (
          <div className="admin-drawer-detail">
            <dl className="admin-dl">
              <dt>Trạng thái</dt>
              <dd>
                <Tag color={STATUS_CONFIG[selected.status]?.color}>
                  {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                </Tag>
              </dd>

              <dt>Chế độ</dt>
              <dd>{MODE_LABELS[selected.mode] ?? selected.mode}</dd>

              <dt>Giá khởi điểm</dt>
              <dd>{selected.starting_price?.toLocaleString('vi-VN')} ₫</dd>

              <dt>Giá hiện tại</dt>
              <dd>{selected.current_price?.toLocaleString('vi-VN')} ₫</dd>

              <dt>Số lượt đặt</dt>
              <dd>{selected.bid_count}</dd>

              <dt>Bắt đầu</dt>
              <dd>{dayjs(selected.starts_at).format('DD/MM/YYYY HH:mm')}</dd>

              <dt>Kết thúc</dt>
              <dd>{dayjs(selected.ends_at).format('DD/MM/YYYY HH:mm')}</dd>

              <dt>Người bán</dt>
              <dd>{selected.seller?.display_name ?? '—'}</dd>

              <dt>Tạo lúc</dt>
              <dd>{dayjs(selected.created_at).format('DD/MM/YYYY HH:mm')}</dd>
            </dl>

            {canCancel && (
              <div style={{ marginTop: 24, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 8,
                  }}
                >
                  Hủy phiên đấu giá
                </div>
                <Input.TextArea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do hủy phiên…"
                  maxLength={500}
                  disabled={cancelLoading}
                  style={{ marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 13 }}
                />
                <Button
                  danger
                  type="primary"
                  icon={<StopOutlined />}
                  onClick={handleCancelAuction}
                  loading={cancelLoading}
                  disabled={!cancelReason.trim()}
                >
                  Hủy phiên
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default Component
