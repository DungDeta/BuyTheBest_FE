import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Badge,
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
import { CheckOutlined, CloseOutlined, PictureOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import './admin.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductStatus = 'pending_review' | 'approved' | 'rejected' | 'all'

interface ProductCover {
  id: number
  url: string
  sort_order: number
  is_primary: boolean
}

interface ProductListItem {
  id: string
  title: string
  slug: string
  condition: string
  status: ProductStatus
  category_id: number
  seller_id: number
  cover: ProductCover | null
  created_at: string
}

interface ProductDetail extends ProductListItem {
  description: string
  images: ProductCover[]
  seller?: {
    id: number
    username: string
    email: string
  }
}

interface ProductsPage {
  items: ProductListItem[]
  total: number
  limit: number
  offset: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const CONDITION_LABELS: Record<string, string> = {
  new: 'Mới',
  like_new: 'Như mới',
  good: 'Tốt',
  fair: 'Khá',
  poor: 'Kém',
}

const STATUS_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  pending_review: { color: 'orange', label: 'Chờ duyệt' },
  approved: { color: 'green', label: 'Đã duyệt' },
  rejected: { color: 'red', label: 'Bị từ chối' },
}

const TAB_ITEMS = [
  { key: 'pending_review', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Bị từ chối' },
  { key: 'all', label: 'Tất cả' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function Component() {
  const { message } = App.useApp()

  const [status, setStatus] = useState<ProductStatus>('pending_review')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ProductsPage | null>(null)
  const [loading, setLoading] = useState(true)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<ProductDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchList = useCallback(
    async (s: ProductStatus, p: number) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          limit: PAGE_SIZE,
          offset: (p - 1) * PAGE_SIZE,
        }
        if (s !== 'all') params.status = s

        const res = await privateGet<ProductsPage>('/admin/products', params)
        setData(res.data)
      } catch (err) {
        const e = err as ErrorResponse
        message.error(e?.error ?? 'Không tải được danh sách sản phẩm')
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
    setStatus(key as ProductStatus)
    setPage(1)
  }

  async function openDrawer(record: ProductListItem) {
    setDrawerOpen(true)
    setSelected(null)
    setRejecting(false)
    setRejectReason('')
    setDetailLoading(true)
    try {
      const res = await privateGet<ProductDetail>(
        `/admin/products/${record.id}`,
      )
      setSelected(res.data)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không tải được chi tiết sản phẩm')
      setDrawerOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelected(null)
    setRejecting(false)
    setRejectReason('')
  }

  async function handleApprove() {
    if (!selected) return
    setActionLoading(true)
    try {
      await privatePost(`/admin/products/${selected.id}/approve`)
      message.success('Đã duyệt sản phẩm')
      closeDrawer()
      fetchList(status, page)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Duyệt thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!selected) return
    if (rejectReason.trim().length < 10) {
      message.warning('Lý do từ chối phải ít nhất 10 ký tự')
      return
    }
    setActionLoading(true)
    try {
      await privatePost(`/admin/products/${selected.id}/reject`, {
        reason: rejectReason.trim(),
      })
      message.success('Đã từ chối sản phẩm')
      closeDrawer()
      fetchList(status, page)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Từ chối thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  const columns: ColumnsType<ProductListItem> = [
    {
      title: '',
      dataIndex: 'cover',
      width: 72,
      render: (cover: ProductCover | null) =>
        cover?.url ? (
          <img src={cover.url} alt="" className="product-cover" />
        ) : (
          <div className="product-cover--empty">
            <PictureOutlined />
          </div>
        ),
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'title',
      render: (title: string) => (
        <span style={{ fontWeight: 500 }}>{title}</span>
      ),
    },
    {
      title: 'Tình trạng',
      dataIndex: 'condition',
      width: 120,
      render: (c: string) => CONDITION_LABELS[c] ?? c,
    },
    {
      title: 'Seller ID',
      dataIndex: 'seller_id',
      width: 100,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      width: 140,
      render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (s: string) => {
        const cfg = STATUS_CONFIG[s]
        return cfg ? (
          <Tag color={cfg.color}>{cfg.label}</Tag>
        ) : (
          <Tag>{s}</Tag>
        )
      },
    },
  ]

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Duyệt sản phẩm</h1>

      <Tabs
        activeKey={status}
        onChange={handleTabChange}
        items={TAB_ITEMS.map((t) => ({
          key: t.key,
          label:
            t.key === 'pending_review' && data?.total && status === 'pending_review' ? (
              <Badge count={data.total} size="small" offset={[6, 0]}>
                {t.label}
              </Badge>
            ) : (
              t.label
            ),
        }))}
        style={{ marginBottom: 16 }}
      />

      <div className="product-queue">
        <Table<ProductListItem>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={loading}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openDrawer(record),
            className: 'product-row',
          })}
          locale={{
            emptyText: (
              <Empty
                description={
                  status === 'pending_review'
                    ? 'Không có sản phẩm chờ duyệt'
                    : status === 'approved'
                      ? 'Chưa có sản phẩm được duyệt'
                      : status === 'rejected'
                        ? 'Chưa có sản phẩm bị từ chối'
                        : 'Không có sản phẩm nào'
                }
              />
            ),
          }}
        />
      </div>

      {data && data.total > PAGE_SIZE && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onChange={setPage}
            showSizeChanger={false}
            showTotal={(total) => `${total} sản phẩm`}
          />
        </div>
      )}

      <Drawer
        title={selected?.title ?? 'Chi tiết sản phẩm'}
        open={drawerOpen}
        onClose={closeDrawer}
        width={600}
        placement="right"
        loading={detailLoading}
      >
        {selected && (
          <div className="review-drawer">
            {/* Gallery */}
            {selected.images && selected.images.length > 0 && (
              <div>
                <p className="review-drawer__section-title">Hình ảnh</p>
                <div className="review-gallery">
                  {selected.images
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((img, idx) => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt={`${selected.title} ${idx + 1}`}
                        className={`review-gallery__img${img.is_primary ? ' review-gallery__img--primary' : ''}`}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div>
              <p className="review-drawer__section-title">Thông tin sản phẩm</p>
              <h2 className="review-drawer__title">{selected.title}</h2>

              <div className="review-drawer__field">
                <p className="review-drawer__field-label">Tình trạng</p>
                <p className="review-drawer__field-value">
                  {CONDITION_LABELS[selected.condition] ?? selected.condition}
                </p>
              </div>

              <div className="review-drawer__field">
                <p className="review-drawer__field-label">Danh mục</p>
                <p className="review-drawer__field-value">
                  ID: {selected.category_id}
                </p>
              </div>

              {selected.description && (
                <div className="review-drawer__field">
                  <p className="review-drawer__field-label">Mô tả</p>
                  <p className="review-drawer__field-value" style={{ whiteSpace: 'pre-wrap' }}>
                    {selected.description}
                  </p>
                </div>
              )}

              <div className="review-drawer__field">
                <p className="review-drawer__field-label">Ngày tạo</p>
                <p className="review-drawer__field-value">
                  {dayjs(selected.created_at).format('DD/MM/YYYY HH:mm')}
                </p>
              </div>
            </div>

            {/* Seller */}
            <div>
              <p className="review-drawer__section-title">Người bán</p>
              {selected.seller ? (
                <>
                  <div className="review-drawer__field">
                    <p className="review-drawer__field-label">Username</p>
                    <p className="review-drawer__field-value">
                      {selected.seller.username}
                    </p>
                  </div>
                  <div className="review-drawer__field">
                    <p className="review-drawer__field-label">Email</p>
                    <p className="review-drawer__field-value">
                      {selected.seller.email}
                    </p>
                  </div>
                </>
              ) : (
                <p className="review-drawer__field-value">
                  Seller ID: {selected.seller_id}
                </p>
              )}
            </div>

            {/* Reject reason form */}
            {rejecting && (
              <div className="review-reject-form">
                <p className="review-reject-form__label">
                  Lý do từ chối (tối thiểu 10 ký tự)
                </p>
                <Input.TextArea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  showCount
                  placeholder="Nhập lý do từ chối sản phẩm này..."
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    danger
                    type="primary"
                    icon={<CloseOutlined />}
                    loading={actionLoading}
                    onClick={handleReject}
                    disabled={rejectReason.trim().length < 10}
                  >
                    Xác nhận từ chối
                  </Button>
                  <Button
                    onClick={() => {
                      setRejecting(false)
                      setRejectReason('')
                    }}
                    disabled={actionLoading}
                  >
                    Huỷ
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            {!rejecting && (
              <div className="review-actions">
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={actionLoading}
                  onClick={handleApprove}
                  style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                >
                  Duyệt ✓
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setRejecting(true)}
                  disabled={actionLoading}
                >
                  Từ chối ✗
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
