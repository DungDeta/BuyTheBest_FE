import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Empty,
  Input,
  Pagination,
  Skeleton,
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

type AuctionStatus = 'active' | 'scheduled' | 'ended' | 'closed_bin' | 'cancelled' | 'all'

interface AuctionListItem {
  id: string
  mode: string
  status: string
  starting_price: number
  current_price: number
  bid_count: number
  starts_at: string
  ends_at: string
  created_at: string
  product?: { id: string; title: string }
  seller?: { id: string; display_name: string }
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
  sealed_bid: 'Kín',
  reverse: 'Ngược',
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: 'Chờ bắt đầu' },
  active: { color: 'green', label: 'Đang diễn ra' },
  ended: { color: 'default', label: 'Đã kết thúc' },
  closed_bin: { color: 'purple', label: 'Đã mua ngay' },
  cancelled: { color: 'red', label: 'Đã hủy' },
}

const TAB_ITEMS = [
  { key: 'active', label: 'Đang diễn ra' },
  { key: 'scheduled', label: 'Chờ bắt đầu' },
  { key: 'ended', label: 'Đã kết thúc' },
  { key: 'closed_bin', label: 'Đã mua ngay' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: 'all', label: 'Tất cả' },
]

function auctionTitle(auction: AuctionListItem) {
  return auction.product?.title ?? 'Phiên không có sản phẩm'
}

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
      content: `Bạn chắc chắn muốn hủy phiên "${auctionTitle(selected)}"? Hành động này không thể hoàn tác.`,
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
      ellipsis: true,
      render: (_: unknown, record) => (
        <button
          type="button"
          className="admin-link-btn"
          onClick={() => openDrawer(record)}
        >
          {auctionTitle(record)}
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

      <div className="auction-desktop-table">
        <Table<AuctionListItem>
          columns={columns}
          dataSource={data?.items ?? []}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 860 }}
          locale={{ emptyText: <Empty description="Không có phiên nào" /> }}
        />
      </div>

      <div className="auction-mobile-list" aria-label="Danh sách phiên đấu giá">
        {loading ? (
          <div className="auction-mobile-card auction-mobile-card--loading">
            <Skeleton active title paragraph={{ rows: 3 }} />
          </div>
        ) : data?.items.length ? (
          data.items.map((auction) => {
            const statusConfig = STATUS_CONFIG[auction.status]

            return (
              <button
                key={auction.id}
                type="button"
                className="auction-mobile-card"
                onClick={() => openDrawer(auction)}
                aria-label={`Xem chi tiết ${auctionTitle(auction)}`}
              >
                <span className="auction-mobile-card__header">
                  <span className="auction-mobile-card__title">
                    {auctionTitle(auction)}
                  </span>
                  <Tag color={statusConfig?.color}>
                    {statusConfig?.label ?? auction.status}
                  </Tag>
                </span>

                <span className="auction-mobile-card__meta">
                  <span>
                    <small>Chế độ</small>
                    <strong>{MODE_LABELS[auction.mode] ?? auction.mode}</strong>
                  </span>
                  <span>
                    <small>Giá hiện tại</small>
                    <strong>{auction.current_price?.toLocaleString('vi-VN')} ₫</strong>
                  </span>
                  <span>
                    <small>Lượt đặt</small>
                    <strong>{auction.bid_count}</strong>
                  </span>
                  <span>
                    <small>Kết thúc</small>
                    <strong>{dayjs(auction.ends_at).format('DD/MM/YYYY HH:mm')}</strong>
                  </span>
                </span>

                <span className="auction-mobile-card__seller">
                  Người bán: {auction.seller?.display_name ?? '—'}
                </span>
              </button>
            )
          })
        ) : (
          <div className="auction-mobile-empty">
            <Empty description="Không có phiên nào" />
          </div>
        )}
      </div>

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
        title={selected ? auctionTitle(selected) : 'Chi tiết phiên'}
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
