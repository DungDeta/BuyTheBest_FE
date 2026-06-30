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

function formatCurrency(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString('vi-VN')} ₫`
    : '--'
}

function formatDateTime(value?: string) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '--'
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
        title="Chi tiết phiên đấu giá"
        width="min(520px, 100vw)"
        destroyOnClose
      >
        {selected && (
          <div className="auction-detail-drawer">
            <section className="auction-detail-hero">
              <div className="auction-detail-hero__copy">
                <span className="auction-detail-eyebrow">Phiên đấu giá</span>
                <h2>{auctionTitle(selected)}</h2>
                <span className="auction-detail-id">ID: {selected.id}</span>
              </div>
              <Tag color={STATUS_CONFIG[selected.status]?.color}>
                {STATUS_CONFIG[selected.status]?.label ?? selected.status}
              </Tag>
            </section>

            <section className="auction-metric-grid" aria-label="Chỉ số phiên đấu giá">
              <div className="auction-metric auction-metric--primary">
                <span>Giá hiện tại</span>
                <strong>{formatCurrency(selected.current_price)}</strong>
              </div>
              <div className="auction-metric">
                <span>Giá khởi điểm</span>
                <strong>{formatCurrency(selected.starting_price)}</strong>
              </div>
              <div className="auction-metric">
                <span>Lượt đặt</span>
                <strong>{selected.bid_count}</strong>
              </div>
            </section>

            <section className="auction-detail-section">
              <h3>Thông tin phiên</h3>
              <div className="auction-detail-table">
                <div className="auction-detail-row">
                  <span>Chế độ</span>
                  <strong>{MODE_LABELS[selected.mode] ?? selected.mode}</strong>
                </div>
                <div className="auction-detail-row">
                  <span>Người bán</span>
                  <strong>{selected.seller?.display_name ?? '--'}</strong>
                </div>
                <div className="auction-detail-row">
                  <span>Sản phẩm</span>
                  <strong>{auctionTitle(selected)}</strong>
                </div>
              </div>
            </section>

            <section className="auction-detail-section">
              <h3>Mốc thời gian</h3>
              <div className="auction-timeline-list">
                <div className="auction-timeline-item">
                  <span>Tạo lúc</span>
                  <strong>{formatDateTime(selected.created_at)}</strong>
                </div>
                <div className="auction-timeline-item">
                  <span>Bắt đầu</span>
                  <strong>{formatDateTime(selected.starts_at)}</strong>
                </div>
                <div className="auction-timeline-item">
                  <span>Kết thúc</span>
                  <strong>{formatDateTime(selected.ends_at)}</strong>
                </div>
              </div>
            </section>

            {canCancel && (
              <section className="auction-danger-zone">
                <div className="auction-danger-zone__header">
                  <span>Hủy phiên đấu giá</span>
                  <p>
                    Phiên sẽ bị dừng, người bán và người tham gia sẽ nhận thông báo.
                    Hành động này được ghi lại trong nhật ký quản trị.
                  </p>
                </div>
                <label className="auction-cancel-field">
                  <span>Lý do hủy</span>
                  <Input.TextArea
                    rows={4}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ví dụ: Sản phẩm vi phạm quy định hoặc người bán yêu cầu hủy."
                    maxLength={500}
                    disabled={cancelLoading}
                    showCount
                  />
                </label>
                <Button
                  danger
                  type="primary"
                  icon={<StopOutlined />}
                  onClick={handleCancelAuction}
                  loading={cancelLoading}
                  disabled={!cancelReason.trim()}
                  className="auction-cancel-button"
                >
                  Hủy phiên
                </Button>
              </section>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default Component
