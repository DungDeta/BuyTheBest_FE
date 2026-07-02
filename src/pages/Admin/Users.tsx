import { useCallback, useEffect, useRef, useState } from 'react'
import {
  App,
  Avatar,
  Button,
  DatePicker,
  Empty,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Radio,
  Select,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, UserOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './admin.css'

// ─── Types ────────────────────────────────────────────────────────

interface AdminUser {
  id: number
  public_id: string
  email: string
  display_name: string
  avatar_url: string
  is_seller: boolean
  is_admin: boolean
  status: 'active' | 'banned'
  avg_rating: number
  total_sales: number
  total_bought: number
  created_at: string
}

interface AdminUserDetail extends AdminUser {
  bid_count: number
  order_count: number
  dispute_count: number
  review_count: number
  auctions_won: number
  total_spent: number
}

interface ListUsersResponse {
  users: AdminUser[]
  total: number
  page: number
  limit: number
}

type RoleFilter = '' | 'buyer' | 'seller' | 'admin'
type StatusFilter = '' | 'active' | 'banned'
type BanMode = 'permanent' | 'temporary'

// ─── Helpers ──────────────────────────────────────────────────────

function roleBadge(user: AdminUser) {
  if (user.is_admin) return <Tag color="blue" className="role-badge">Quản trị viên</Tag>
  if (user.is_seller) return <Tag color="green" className="role-badge">Người bán</Tag>
  return <Tag className="role-badge">Người mua</Tag>
}

function statusBadge(status: 'active' | 'banned') {
  return status === 'active'
    ? <Tag color="success" className="status-badge">Hoạt động</Tag>
    : <Tag color="error" className="status-badge">Đã khoá</Tag>
}

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatDate(iso: string): string {
  return dayjs(iso).format('DD/MM/YYYY')
}

// ─── Component ────────────────────────────────────────────────────

export function Component() {
  useDocumentTitle('Quản trị · Người dùng')
  const { message } = App.useApp()

  // Filter state
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [role, setRole] = useState<RoleFilter>('')
  const [status, setStatus] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // List state
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Detail modal
  const [detailUser, setDetailUser] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  // Ban modal
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null)
  const [banOpen, setBanOpen] = useState(false)
  const [banMode, setBanMode] = useState<BanMode>('permanent')
  const [banUntil, setBanUntil] = useState<Dayjs | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banSubmitting, setBanSubmitting] = useState(false)

  // CSV export
  const [exporting, setExporting] = useState(false)

  // Debounce keyword
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedKeyword(keyword)
      setPage(1)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [keyword])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit: PAGE_SIZE }
      if (role) params.role = role
      if (status) params.status = status
      if (debouncedKeyword) params.keyword = debouncedKeyword

      const res = await privateGet<ListUsersResponse>('/admin/users', params)
      setUsers(res.data.users)
      setTotal(res.data.total)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không tải được danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }, [page, role, status, debouncedKeyword, message])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [role, status])

  // ── Detail ──────────────────────────────────────────────────────

  async function openDetail(userId: number) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailUser(null)
    try {
      const res = await privateGet<AdminUserDetail>(`/admin/users/${userId}`)
      setDetailUser(res.data)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không tải được thông tin người dùng')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetailUser(null)
  }

  // ── Ban ─────────────────────────────────────────────────────────

  function openBan(user: AdminUser) {
    setBanTarget(user)
    setBanMode('permanent')
    setBanUntil(null)
    setBanReason('')
    setBanOpen(true)
  }

  function closeBan() {
    setBanOpen(false)
    setBanTarget(null)
  }

  async function submitBan() {
    if (!banTarget) return
    if (banReason.trim().length < 5) {
      message.warning('Lý do khoá phải ít nhất 5 ký tự')
      return
    }
    if (banMode === 'temporary' && !banUntil) {
      message.warning('Vui lòng chọn ngày hết hạn khoá')
      return
    }

    setBanSubmitting(true)
    try {
      const body: { reason: string; banned_until?: string } = {
        reason: banReason.trim(),
      }
      if (banMode === 'temporary' && banUntil) {
        body.banned_until = banUntil.toISOString()
      }
      await privatePost(`/admin/users/${banTarget.id}/ban`, body)
      message.success(`Đã khoá tài khoản ${banTarget.display_name}`)
      closeBan()
      fetchUsers()
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không thể khoá tài khoản')
    } finally {
      setBanSubmitting(false)
    }
  }

  // ── Unban ───────────────────────────────────────────────────────

  async function handleUnban(user: AdminUser) {
    try {
      await privatePost(`/admin/users/${user.id}/unban`)
      message.success(`Đã mở khoá tài khoản ${user.display_name}`)
      fetchUsers()
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không thể mở khoá tài khoản')
    }
  }

  // ── CSV Export ──────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    try {
      const token = useAuthStore.getState().accessToken
      const base = import.meta.env.VITE_API_BASE_URL as string
      const params = new URLSearchParams()
      if (role) params.set('role', role)
      if (status) params.set('status', status)
      if (debouncedKeyword) params.set('keyword', debouncedKeyword)

      const url = `${base}/admin/users/export?${params.toString()}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        message.error('Xuất CSV thất bại')
        return
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `users-export-${dayjs().format('YYYYMMDD-HHmmss')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      message.error('Xuất CSV thất bại')
    } finally {
      setExporting(false)
    }
  }

  // ── Table columns ───────────────────────────────────────────────

  const columns: ColumnsType<AdminUser> = [
    {
      title: 'Người dùng',
      key: 'user',
      width: 220,
      render: (_, record) => (
        <div className="user-cell">
          <Avatar
            src={record.avatar_url || undefined}
            icon={!record.avatar_url ? <UserOutlined /> : undefined}
            size={36}
          />
          <span className="user-cell__name">{record.display_name}</span>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'Vai trò',
      key: 'role',
      width: 90,
      render: (_, record) => roleBadge(record),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 110,
      render: (_, record) => statusBadge(record.status),
    },
    {
      title: 'Rating',
      dataIndex: 'avg_rating',
      key: 'avg_rating',
      width: 80,
      render: (val: number) => (val > 0 ? val.toFixed(1) : '—'),
    },
    {
      title: 'Ngày tham gia',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (val: string) => formatDate(val),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <div className="user-actions">
          <Button size="small" onClick={() => openDetail(record.id)}>
            Chi tiết
          </Button>
          {record.status === 'active' ? (
            <Button
              size="small"
              danger
              onClick={() => openBan(record)}
            >
              Khoá
            </Button>
          ) : (
            <Popconfirm
              title="Mở khoá user này?"
              onConfirm={() => handleUnban(record)}
              okText="Xác nhận"
              cancelText="Huỷ"
            >
              <Button size="small">Mở khoá</Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ]

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Quản lý người dùng</h1>

      {/* Filters */}
      <div className="user-filters">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm kiếm tên, email…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <Select<RoleFilter>
          value={role}
          onChange={(v) => setRole(v)}
          style={{ width: 140 }}
          options={[
            { label: 'Tất cả vai trò', value: '' },
            { label: 'Người mua', value: 'buyer' },
            { label: 'Người bán', value: 'seller' },
            { label: 'Quản trị viên', value: 'admin' },
          ]}
        />
        <Select<StatusFilter>
          value={status}
          onChange={(v) => setStatus(v)}
          style={{ width: 150 }}
          options={[
            { label: 'Tất cả trạng thái', value: '' },
            { label: 'Hoạt động', value: 'active' },
            { label: 'Đã khoá', value: 'banned' },
          ]}
        />
        <Button onClick={handleExport} loading={exporting}>
          Xuất CSV
        </Button>
      </div>

      {/* Table */}
      <Table<AdminUser>
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 900 }}
        className="user-table"
      />

      <div className="user-mobile-list" aria-label="Danh sách người dùng">
        {loading ? (
          <div className="user-mobile-card user-mobile-card--loading">
            Đang tải người dùng...
          </div>
        ) : users.length ? (
          users.map((item) => (
            <div key={item.id} className="user-mobile-card">
              <div className="user-mobile-card__header">
                <Avatar
                  src={item.avatar_url || undefined}
                  icon={!item.avatar_url ? <UserOutlined /> : undefined}
                  size={44}
                />
                <div className="user-mobile-card__identity">
                  <strong>{item.display_name}</strong>
                  <span>{item.email}</span>
                </div>
              </div>

              <div className="user-mobile-card__badges">
                {roleBadge(item)}
                {statusBadge(item.status)}
              </div>

              <div className="user-mobile-card__facts">
                <span>
                  <small>Rating</small>
                  <strong>{item.avg_rating > 0 ? item.avg_rating.toFixed(1) : '—'}</strong>
                </span>
                <span>
                  <small>Tham gia</small>
                  <strong>{formatDate(item.created_at)}</strong>
                </span>
                <span>
                  <small>Đã bán</small>
                  <strong>{item.total_sales.toLocaleString('vi-VN')}</strong>
                </span>
              </div>

              <div className="user-mobile-card__actions">
                <Button size="small" onClick={() => openDetail(item.id)}>
                  Chi tiết
                </Button>
                {item.status === 'active' ? (
                  <Button size="small" danger onClick={() => openBan(item)}>
                    Khoá
                  </Button>
                ) : (
                  <Popconfirm
                    title="Mở khoá user này?"
                    onConfirm={() => handleUnban(item)}
                    okText="Xác nhận"
                    cancelText="Huỷ"
                  >
                    <Button size="small">Mở khoá</Button>
                  </Popconfirm>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="user-mobile-empty">
            <Empty description="Không có người dùng nào" />
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="user-pagination">
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={total}
          onChange={(p) => setPage(p)}
          showSizeChanger={false}
          showTotal={(t) => `${t} người dùng`}
        />
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onCancel={closeDetail}
        footer={null}
        width={680}
        title="Chi tiết người dùng"
        className="user-detail-modal"
      >
        {detailLoading && !detailUser ? (
          <div className="modal-loading">Đang tải…</div>
        ) : detailUser ? (
          <DetailContent user={detailUser} />
        ) : null}
      </Modal>

      {/* Ban Modal */}
      <Modal
        open={banOpen}
        onCancel={closeBan}
        title="Khoá tài khoản"
        onOk={submitBan}
        okText="Xác nhận khoá"
        okButtonProps={{ danger: true, loading: banSubmitting }}
        cancelText="Huỷ"
        width={480}
      >
        <div className="ban-modal">
          {banTarget && (
            <div className="ban-modal__target">
              <span>Tài khoản</span>
              <strong>{banTarget.display_name}</strong>
              <small>{banTarget.email}</small>
            </div>
          )}
          <div className="ban-modal__row">
            <span className="ban-modal__label">Loại khoá</span>
            <Radio.Group
              value={banMode}
              onChange={(e) => setBanMode(e.target.value as BanMode)}
            >
              <Radio value="permanent">Vĩnh viễn</Radio>
              <Radio value="temporary">Tạm thời</Radio>
            </Radio.Group>
          </div>

          {banMode === 'temporary' && (
            <div className="ban-modal__row">
              <span className="ban-modal__label">Hết hạn khoá</span>
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                value={banUntil}
                onChange={(d) => setBanUntil(d)}
                disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div className="ban-modal__row">
            <span className="ban-modal__label">
              Lý do khoá <span className="ban-modal__required">*</span>
            </span>
            <Input.TextArea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Nhập lý do khoá tài khoản (tối thiểu 5 ký tự)…"
              rows={3}
              maxLength={500}
              showCount
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Detail content sub-component ────────────────────────────────

interface DetailContentProps {
  user: AdminUserDetail
}

function DetailContent({ user }: DetailContentProps) {
  return (
    <div className="user-detail-modal__body">
      {/* Header */}
      <div className="user-detail-modal__header">
        <Avatar
          src={user.avatar_url || undefined}
          icon={!user.avatar_url ? <UserOutlined /> : undefined}
          size={64}
        />
        <div className="user-detail-modal__info">
          <p className="user-detail-modal__name">{user.display_name}</p>
          <p className="user-detail-modal__email">{user.email}</p>
          <div className="user-detail-modal__badges">
            {user.is_admin ? (
              <Tag color="blue">Quản trị viên</Tag>
            ) : user.is_seller ? (
              <Tag color="green">Người bán</Tag>
            ) : (
              <Tag>Người mua</Tag>
            )}
            {user.status === 'active' ? (
              <Tag color="success">Hoạt động</Tag>
            ) : (
              <Tag color="error">Đã khoá</Tag>
            )}
          </div>
          <p className="user-detail-modal__joined">
            Tham gia: {dayjs(user.created_at).format('DD/MM/YYYY')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="user-stats-grid">
        <StatCard label="Lượt đấu giá" value={user.bid_count.toLocaleString('vi-VN')} />
        <StatCard label="Đơn hàng" value={user.order_count.toLocaleString('vi-VN')} />
        <StatCard label="Tranh chấp" value={user.dispute_count.toLocaleString('vi-VN')} />
        <StatCard label="Đánh giá" value={user.review_count.toLocaleString('vi-VN')} />
        <StatCard label="Phiên đã thắng" value={user.auctions_won.toLocaleString('vi-VN')} />
        <StatCard label="Tổng chi tiêu" value={formatVND(user.total_spent)} />
      </div>

      {/* Seller stats */}
      {user.is_seller && (
        <div className="user-detail-modal__seller">
          <span className="user-detail-modal__section-label">Thông tin bán hàng</span>
          <div className="user-stats-grid user-stats-grid--small">
            <StatCard label="Đã bán" value={user.total_sales.toLocaleString('vi-VN')} />
            <StatCard label="Đã mua" value={user.total_bought.toLocaleString('vi-VN')} />
            <StatCard
              label="Đánh giá TB"
              value={user.avg_rating > 0 ? user.avg_rating.toFixed(1) + ' ★' : '—'}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat card sub-component ──────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="user-stat" aria-label={`${label}: ${value}`}>
      <span className="user-stat__value">{value}</span>
      <span className="user-stat__label">{label}</span>
    </div>
  )
}
