import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Empty,
  InputNumber,
  Pagination,
  Popconfirm,
  Radio,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileImageOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type {
  DisputeEvidence,
  DisputeMessage,
  DisputeResolution,
  DisputeStatus,
} from '@/types/order'
import { resolveEvidenceFileUrl, resolveEvidencePreviewUrl } from '@/utils/evidenceUrl'
import './admin.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisputeStatusFilter =
  | 'admin_review'
  | 'open'
  | 'awaiting_seller'
  | 'awaiting_buyer'
  | 'resolved'
  | 'all'

interface AdminDispute {
  id: string
  reason: string
  description: string
  status: DisputeStatus
  resolution: DisputeResolution
  seller_response_deadline: string | null
  buyer_counter_deadline: string | null
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
}

interface DisputeListResponse {
  disputes: AdminDispute[]
  total: number
}

interface DisputeListEnvelope {
  disputes?: AdminDispute[]
  items?: AdminDispute[]
  data?: AdminDispute[] | {
    disputes?: AdminDispute[]
    items?: AdminDispute[]
    total?: number
  }
  total?: number
}

type MessagesResponse = DisputeMessage[] | { data: DisputeMessage[] }
type EvidenceResponse = DisputeEvidence[] | { data: DisputeEvidence[] }

interface ResolveBody {
  resolution: Exclude<DisputeResolution, 'pending'>
  admin_notes: string
  refund_amount?: number
  seller_amount?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const REASON_LABELS: Record<string, string> = {
  item_not_received: 'Chưa nhận hàng',
  item_damaged: 'Hàng hư hỏng',
  item_not_as_described: 'Không đúng mô tả',
  fake_item: 'Hàng giả',
  other: 'Khác',
}

const STATUS_CONFIG: Record<DisputeStatus, { color: string; label: string }> = {
  open: { color: 'orange', label: 'Đang mở' },
  awaiting_seller: { color: 'orange', label: 'Chờ người bán' },
  awaiting_buyer: { color: 'blue', label: 'Chờ người mua' },
  admin_review: { color: 'red', label: 'Chờ xử lý' },
  resolved: { color: 'green', label: 'Đã giải quyết' },
  closed: { color: 'default', label: 'Đã đóng' },
}

const TAB_ITEMS: { key: DisputeStatusFilter; label: string }[] = [
  { key: 'admin_review', label: 'Chờ xử lý' },
  { key: 'open', label: 'Đang mở' },
  { key: 'awaiting_seller', label: 'Chờ người bán' },
  { key: 'awaiting_buyer', label: 'Chờ người mua' },
  { key: 'resolved', label: 'Đã giải quyết' },
  { key: 'all', label: 'Tất cả' },
]

const RESOLUTION_OPTIONS: { value: Exclude<DisputeResolution, 'pending'>; label: string }[] = [
  { value: 'refund_buyer', label: 'Hoàn tiền người mua' },
  { value: 'release_seller', label: 'Giải ngân người bán' },
  { value: 'partial_refund', label: 'Hoàn tiền một phần' },
]

const ROLE_LABEL: Record<string, string> = {
  buyer: 'Người mua',
  seller: 'Người bán',
  admin: 'Quản trị viên',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractMessages(raw: MessagesResponse | undefined): DisputeMessage[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : raw.data ?? []
}

function extractEvidence(raw: EvidenceResponse | undefined): DisputeEvidence[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : raw.data ?? []
}

function normalizeDisputeList(raw: DisputeListEnvelope | AdminDispute[] | null | undefined): DisputeListResponse {
  if (Array.isArray(raw)) {
    return { disputes: raw, total: raw.length }
  }

  const nested = raw?.data
  const disputes =
    raw?.disputes ??
    raw?.items ??
    (Array.isArray(nested) ? nested : nested?.disputes ?? nested?.items) ??
    []
  const total =
    raw?.total ??
    (Array.isArray(nested) ? undefined : nested?.total) ??
    disputes.length

  return { disputes, total }
}

function shortDisputeId(id: string | undefined): string {
  return id ? id.slice(0, 8) : 'N/A'
}

function msgRole(msg: DisputeMessage): 'admin' | 'buyer' | 'seller' {
  if (msg.is_admin) return 'admin'
  if (msg.sender_role === 'buyer' || msg.sender_role === 'seller') return msg.sender_role
  return 'buyer' // legacy API fallback
}

function AdminEvidencePreview({ evidence }: { evidence: DisputeEvidence }) {
  const [imageFailed, setImageFailed] = useState(false)
  const previewUrl = resolveEvidencePreviewUrl(evidence)
  const fileUrl = resolveEvidenceFileUrl(evidence) ?? previewUrl

  const preview = evidence.file_type === 'image' && previewUrl && !imageFailed ? (
    <img
      src={previewUrl}
      alt={evidence.description ?? 'Bằng chứng'}
      className="dispute-evidence-mini__img"
      onError={() => setImageFailed(true)}
    />
  ) : (
    <div className="dispute-evidence-mini__file">
      <FileImageOutlined style={{ fontSize: 20 }} />
      <span>{evidence.file_type}</span>
    </div>
  )

  if (!fileUrl) return preview
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={evidence.description ? `Xem bằng chứng: ${evidence.description}` : 'Xem bằng chứng'}
      style={{ color: 'inherit', display: 'block' }}
    >
      {preview}
    </a>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Component() {
  useDocumentTitle('Quản trị · Tranh chấp')
  const { message } = App.useApp()

  const [statusFilter, setStatusFilter] = useState<DisputeStatusFilter>('admin_review')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DisputeListResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<AdminDispute | null>(null)

  // drawer sub-data
  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([])
  const [subLoading, setSubLoading] = useState(false)

  // resolve form
  const [resolution, setResolution] = useState<Exclude<DisputeResolution, 'pending'>>('refund_buyer')
  const [adminNotes, setAdminNotes] = useState('')
  const [refundAmount, setRefundAmount] = useState<number | null>(null)
  const [sellerAmount, setSellerAmount] = useState<number | null>(null)
  const [resolving, setResolving] = useState(false)

  // ─── Data fetching ───────────────────────────────────────────────

  const fetchList = useCallback(
    async (filter: DisputeStatusFilter, p: number) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          limit: PAGE_SIZE,
          offset: (p - 1) * PAGE_SIZE,
        }
        if (filter !== 'all') params.status = filter

        const res = await privateGet<DisputeListEnvelope | AdminDispute[]>('/admin/disputes', params)
        setData(normalizeDisputeList(res.data))
      } catch (err) {
        const e = err as ErrorResponse
        message.error(e?.error ?? 'Không tải được danh sách khiếu nại')
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    fetchList(statusFilter, page)
  }, [statusFilter, page, fetchList])

  // ─── Handlers ────────────────────────────────────────────────────

  function handleTabChange(key: string) {
    setStatusFilter(key as DisputeStatusFilter)
    setPage(1)
  }

  async function openDrawer(record: AdminDispute) {
    setSelected(record)
    setDrawerOpen(true)
    setMessages([])
    setEvidence([])
    setResolution('refund_buyer')
    setAdminNotes('')
    setRefundAmount(null)
    setSellerAmount(null)
    setSubLoading(true)

    try {
      const [msgRes, evRes] = await Promise.all([
        privateGet<MessagesResponse>(`/admin/disputes/${record.id}/messages`, { limit: 50, offset: 0 }),
        privateGet<EvidenceResponse>(`/admin/disputes/${record.id}/evidence`),
      ])
      setMessages(extractMessages(msgRes.data))
      setEvidence(extractEvidence(evRes.data))
    } catch {
      // non-fatal — drawer still opens with empty sub-sections
    } finally {
      setSubLoading(false)
    }
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelected(null)
    setMessages([])
    setEvidence([])
    setAdminNotes('')
    setRefundAmount(null)
    setSellerAmount(null)
  }

  async function handleResolve() {
    if (!selected) return

    const notes = adminNotes.trim()
    if (notes.length < 50) {
      message.warning('Ghi chú admin phải ít nhất 50 ký tự')
      return
    }
    if (notes.length > 2000) {
      message.warning('Ghi chú admin tối đa 2000 ký tự')
      return
    }
    if (resolution === 'partial_refund') {
      if (refundAmount == null || sellerAmount == null) {
        message.warning('Vui lòng nhập số tiền hoàn trả và số tiền giải ngân cho người bán')
        return
      }
    }

    setResolving(true)
    try {
      const body: ResolveBody = { resolution, admin_notes: notes }
      if (resolution === 'partial_refund') {
        body.refund_amount = refundAmount ?? 0
        body.seller_amount = sellerAmount ?? 0
      }
      await privatePost(`/admin/disputes/${selected.id}/resolve`, body)
      message.success('Đã phân xử khiếu nại thành công')
      closeDrawer()
      fetchList(statusFilter, page)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Phân xử thất bại')
    } finally {
      setResolving(false)
    }
  }

  // ─── Table columns ────────────────────────────────────────────────

  const columns: ColumnsType<AdminDispute> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
      render: (id: string) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          {shortDisputeId(id)}…
        </span>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'reason',
      width: 160,
      render: (r: string) => REASON_LABELS[r] ?? r,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (s: DisputeStatus) => {
        const cfg = STATUS_CONFIG[s]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{s}</Tag>
      },
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      render: (desc: string) => (
        <Tooltip title={desc}>
          <span
            style={{
              display: 'inline-block',
              maxWidth: 280,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: 13,
            }}
          >
            {desc}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      width: 140,
      render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: AdminDispute) => (
        <Button size="small" onClick={() => openDrawer(record)}>
          Chi tiết
        </Button>
      ),
    },
  ]

  // ─── Drawer content ───────────────────────────────────────────────

  function renderDrawerContent() {
    if (!selected) return null

    const cfg = STATUS_CONFIG[selected.status]
    const canResolve = selected.status === 'admin_review'

    return (
      <div className="dispute-drawer">
        {/* Header */}
        <section className="dispute-summary-card">
          <div className="dispute-summary-card__header">
            <div>
              <span className="dispute-drawer__section-title">Thông tin khiếu nại</span>
              <p className="dispute-summary-card__id">{selected.id}</p>
            </div>
            <div className="dispute-summary-card__tags">
              {cfg && <Tag color={cfg.color}>{cfg.label}</Tag>}
              <Tag>{REASON_LABELS[selected.reason] ?? selected.reason}</Tag>
            </div>
          </div>

          <p className="dispute-summary-card__description">{selected.description}</p>

          <div className="dispute-summary-card__meta">
            <div>
              <span>Tạo lúc</span>
              <strong>{dayjs(selected.created_at).format('DD/MM/YYYY HH:mm')}</strong>
            </div>
            {selected.resolved_at && (
              <div>
                <span>Giải quyết</span>
                <strong>{dayjs(selected.resolved_at).format('DD/MM/YYYY HH:mm')}</strong>
              </div>
            )}
          </div>
        </section>

        {/* Evidence */}
        <div className="dispute-drawer__section">
          <div className="dispute-drawer__section-title">Bằng chứng</div>
          {subLoading ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Spin size="small" />
            </div>
          ) : evidence.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Không có bằng chứng.</p>
          ) : (
            <div className="dispute-evidence-mini">
              {evidence.map((ev) => (
                <div key={ev.id} className="dispute-evidence-mini__item">
                  <AdminEvidencePreview evidence={ev} />
                  {ev.description && (
                    <Tooltip title={ev.description}>
                      <p className="dispute-evidence-mini__desc">{ev.description}</p>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="dispute-drawer__section">
          <div className="dispute-drawer__section-title">Tin nhắn</div>
          {subLoading ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Spin size="small" />
            </div>
          ) : messages.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có tin nhắn.</p>
          ) : (
            <div className="dispute-messages-mini" role="log" aria-label="Tin nhắn khiếu nại">
              {messages.map((msg) => {
                const role = msgRole(msg)
                return (
                  <div
                    key={msg.id}
                    className={`dispute-messages-mini__msg dispute-messages-mini__msg--${role}`}
                  >
                    <span
                      className={`dispute-messages-mini__badge dispute-messages-mini__badge--${role}`}
                    >
                      {ROLE_LABEL[role]}
                    </span>
                    <span className="dispute-messages-mini__text">{msg.content}</span>
                    <span className="dispute-messages-mini__ts">
                      {dayjs(msg.sent_at).format('DD/MM HH:mm')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resolve form or read-only state */}
        {canResolve ? (
          <div className="dispute-drawer__section resolve-form">
            <div className="dispute-drawer__section-title">Phân xử</div>

            <div className="resolve-options">
              <Radio.Group
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Exclude<DisputeResolution, 'pending'>)}
              >
                {RESOLUTION_OPTIONS.map((opt) => (
                  <Radio key={opt.value} value={opt.value}>
                    {opt.label}
                  </Radio>
                ))}
              </Radio.Group>
            </div>

            {resolution === 'partial_refund' && (
              <div className="resolve-partial">
                <div className="resolve-partial__field">
                  <label className="resolve-partial__label">Hoàn trả người mua (VNĐ)</label>
                  <InputNumber
                    value={refundAmount}
                    onChange={(v) => setRefundAmount(v)}
                    min={0}
                    step={1000}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => Number((v ?? '').replace(/[^0-9]/g, ''))}
                    style={{ width: '100%' }}
                    placeholder="0"
                  />
                </div>
                <div className="resolve-partial__field">
                  <label className="resolve-partial__label">Giải ngân người bán (VNĐ)</label>
                  <InputNumber
                    value={sellerAmount}
                    onChange={(v) => setSellerAmount(v)}
                    min={0}
                    step={1000}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => Number((v ?? '').replace(/[^0-9]/g, ''))}
                    style={{ width: '100%' }}
                    placeholder="0"
                  />
                </div>
                <p className="resolve-partial__hint">
                  Tổng hai giá trị nên bằng số tiền thanh toán của đơn hàng.
                </p>
              </div>
            )}

            <div className="resolve-notes-field">
              <label>
                Ghi chú admin{' '}
                <span className="resolve-notes-field__required">*</span>{' '}
                <span className="resolve-notes-field__hint">(50–2000 ký tự)</span>
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Nhập lý do / ghi chú quyết định phân xử..."
                aria-label="Ghi chú admin"
              />
              <div className="resolve-notes-field__count">
                {adminNotes.length} / 2000
              </div>
            </div>

            <div className="resolve-submit-row">
              <Popconfirm
                title="Xác nhận phân xử"
                description="Hành động này không thể hoàn tác. Tiếp tục?"
                onConfirm={handleResolve}
                okText="Phân xử"
                cancelText="Huỷ"
                disabled={resolving}
              >
                <Button
                  type="primary"
                  danger
                  loading={resolving}
                  disabled={
                    adminNotes.trim().length < 50 ||
                    (resolution === 'partial_refund' &&
                      (refundAmount == null || sellerAmount == null))
                  }
                >
                  Phân xử
                </Button>
              </Popconfirm>
            </div>
          </div>
        ) : (
          <div className="dispute-drawer__section">
            <div className="dispute-drawer__section-title">Trạng thái hiện tại</div>
            <div className="dispute-current-state">
              <div className="dispute-current-state__row">
                <span>Trạng thái</span>
                <div>{cfg && <Tag color={cfg.color}>{cfg.label}</Tag>}</div>
              </div>
              {selected.resolution && selected.resolution !== 'pending' && (
                <div className="dispute-current-state__row">
                  <span>Quyết định</span>
                  <strong>
                    {RESOLUTION_OPTIONS.find((o) => o.value === selected.resolution)?.label ??
                      selected.resolution}
                  </strong>
                </div>
              )}
              {selected.admin_notes && (
                <div className="dispute-current-state__row">
                  <span>Ghi chú admin</span>
                  <strong className="dispute-current-state__notes">
                    {selected.admin_notes}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────

  const disputes = data?.disputes ?? []

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Quản lý khiếu nại</h1>

      <Tabs
        activeKey={statusFilter}
        onChange={handleTabChange}
        items={TAB_ITEMS.map((t) => ({ key: t.key, label: t.label }))}
        style={{ marginBottom: 16 }}
      />

      <div className="dispute-table">
        <Table<AdminDispute>
          rowKey="id"
          columns={columns}
          dataSource={disputes}
          loading={loading}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openDrawer(record),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <Empty description="Không có khiếu nại nào" />
            ),
          }}
        />
      </div>

      <div className="dispute-mobile-list" aria-label="Danh sách khiếu nại">
        {loading ? (
          <div className="dispute-mobile-card dispute-mobile-card--loading">
            <Spin size="small" />
            <span>Đang tải khiếu nại...</span>
          </div>
        ) : disputes.length ? (
          disputes.map((dispute) => {
            const cfg = STATUS_CONFIG[dispute.status]

            return (
              <button
                key={dispute.id}
                type="button"
                className="dispute-mobile-card"
                onClick={() => openDrawer(dispute)}
                aria-label={`Xem chi tiết khiếu nại ${shortDisputeId(dispute.id)}`}
              >
                <span className="dispute-mobile-card__header">
                  <span className="dispute-mobile-card__id">{shortDisputeId(dispute.id)}...</span>
                  <span className="dispute-mobile-card__tags">
                    {cfg && <Tag color={cfg.color}>{cfg.label}</Tag>}
                    <Tag>{REASON_LABELS[dispute.reason] ?? dispute.reason}</Tag>
                  </span>
                </span>
                <span className="dispute-mobile-card__description">
                  {dispute.description}
                </span>
                <span className="dispute-mobile-card__date">
                  Tạo lúc {dayjs(dispute.created_at).format('DD/MM/YYYY HH:mm')}
                </span>
              </button>
            )
          })
        ) : (
          <div className="dispute-mobile-empty">
            <Empty description="Không có khiếu nại nào" />
          </div>
        )}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onChange={setPage}
            showSizeChanger={false}
            showTotal={(total) => `${total} khiếu nại`}
          />
        </div>
      )}

      <Drawer
        title="Chi tiết khiếu nại"
        open={drawerOpen}
        onClose={closeDrawer}
        width="min(600px, 100vw)"
        placement="right"
        destroyOnHidden
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  )
}
