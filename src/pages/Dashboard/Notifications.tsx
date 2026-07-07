import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Modal, Pagination, Spin, Switch } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import { privateGet, privatePut } from '@/api/api'
import type { Notification, NotificationFilter, NotificationPreference } from '@/types/notification'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNotifications } from '@/hooks/useNotifications'
import { NetworkError } from '@/components/common/NetworkError'
import './notifications.css'

dayjs.extend(relativeTime)
dayjs.locale('vi')

const PAGE_SIZE = 20

const FILTER_TABS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'auction', label: 'Đấu giá' },
  { value: 'order', label: 'Đơn hàng' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'dispute', label: 'Khiếu nại' },
  { value: 'unread', label: 'Chưa đọc' },
]

const EVENT_TYPE_MARKS: Record<string, string> = {
  auction: 'Đấu giá',
  outbid: 'Đấu giá',
  order: 'Đơn hàng',
  payment: 'Thanh toán',
  escrow: 'Thanh toán',
  payout: 'Thanh toán',
  dispute: 'Khiếu nại',
  new_message: 'Tin nhắn',
}

const PREF_LABELS: Record<string, string> = {
  auction: 'Đấu giá',
  payment: 'Thanh toán',
  shipping: 'Giao hàng',
  dispute: 'Khiếu nại',
  system: 'Hệ thống',
  outbid: 'Bị vượt giá',
  auction_won: 'Thắng phiên đấu giá',
  auction_ended: 'Phiên đã kết thúc',
  auto_bid_exhausted: 'Đặt giá tự động hết ngân sách',
  payment_received: 'Thanh toán đã ghi nhận',
  order_created: 'Đơn hàng mới',
  order_paid: 'Đơn hàng đã thanh toán',
  order_shipped: 'Đơn hàng đã gửi',
  order_delivered: 'Người mua đã xác nhận nhận hàng',
  order_cancelled: 'Đơn hàng đã hủy',
  dispute_opened: 'Khiếu nại đã mở',
  dispute_seller_responded: 'Người bán đã phản hồi khiếu nại',
  dispute_escalated: 'Khiếu nại đã chuyển quản trị viên',
  dispute_message: 'Tin nhắn trong khiếu nại',
  dispute_resolved: 'Khiếu nại đã xử lý',
  review_created: 'Đánh giá mới',
  review_replied: 'Phản hồi đánh giá',
  escrow_released: 'Escrow đã giải ngân',
  payout_released: 'Tiền bán đã giải ngân',
  account_locked: 'Tài khoản bị khóa',
  account_unlocked: 'Tài khoản đã được mở khóa',
  auction_ending_soon: 'Phiên sắp kết thúc',
  registration: 'Đăng ký tài khoản',
  password_reset: 'Đặt lại mật khẩu',
  new_message: 'Tin nhắn mới',
}

const MANDATORY_EVENT_TYPES = new Set([
  'auction_won',
  'payment_received',
  'auto_bid_exhausted',
  'order_created',
  'order_paid',
  'order_cancelled',
  'dispute_opened',
  'dispute_seller_responded',
  'dispute_escalated',
  'dispute_resolved',
  'escrow_released',
  'account_locked',
  'account_unlocked',
])

interface NotificationsResponse {
  notifications: Notification[]
  total: number
  unread_count: number
}

function getIcon(eventType: string): string {
  for (const key of Object.keys(EVENT_TYPE_MARKS) as Array<keyof typeof EVENT_TYPE_MARKS>) {
    if (eventType.startsWith(key)) return EVENT_TYPE_MARKS[key] ?? ''
  }
  return 'Hệ thống'
}

function relativeTimeStr(createdAt: string): string {
  return dayjs(createdAt).fromNow()
}

function filterToParams(filter: NotificationFilter): Record<string, unknown> {
  if (filter === 'all') return {}
  if (filter === 'unread') return { is_read: false }
  return { event_type: filter }
}

function isMandatoryPreference(eventType: string): boolean {
  return MANDATORY_EVENT_TYPES.has(eventType)
}

export function Component() {
  useDocumentTitle('Thông báo')
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { latestNotification } = useNotifications(false)
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [page, setPage] = useState(1)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const requestIdRef = useRef(0)

  const [prefOpen, setPrefOpen] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [prefLoading, setPrefLoading] = useState(false)
  const [prefSaving, setPrefSaving] = useState(false)

  const fetchNotifications = useCallback(
    async (currentFilter: NotificationFilter, currentPage: number) => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      setLoadError(null)
      try {
        const params: Record<string, unknown> = {
          page: currentPage,
          limit: PAGE_SIZE,
          ...filterToParams(currentFilter),
        }
        const res = await privateGet<NotificationsResponse>('/notifications', params)
        if (requestId === requestIdRef.current) {
          setNotifications(res.data?.notifications ?? [])
          setTotal(res.data?.total ?? 0)
        }
      } catch {
        if (requestId === requestIdRef.current) {
          setNotifications([])
          setTotal(0)
          setLoadError('Không thể tải danh sách thông báo. Vui lòng kiểm tra kết nối và thử lại.')
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchNotifications(filter, page)
  }, [filter, page, fetchNotifications])

  useEffect(() => {
    if (!latestNotification) return
    void fetchNotifications(filter, page)
  }, [latestNotification, filter, page, fetchNotifications])

  function handleFilterChange(next: NotificationFilter) {
    setFilter(next)
    setPage(1)
  }

  function handlePageChange(next: number) {
    setPage(next)
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await privatePut('/notifications/read-all')
      message.success('Đã đánh dấu tất cả đã đọc')
      await fetchNotifications(filter, page)
    } catch {
      message.error('Không thể cập nhật trạng thái')
    } finally {
      setMarkingAll(false)
    }
  }

  async function handleItemClick(notif: Notification) {
    if (!notif.is_read) {
      try {
        await privatePut(`/notifications/${notif.id}/read`)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
        )
      } catch {
        message.error('Không thể đánh dấu thông báo đã đọc')
        return
      }
    }
    if (notif.link) {
      navigate(notif.link)
    }
  }

  async function openPreferences() {
    setPrefOpen(true)
    setPrefLoading(true)
    try {
      const res = await privateGet<NotificationPreference[]>('/notifications/preferences')
      setPreferences(res.data ?? [])
    } catch {
      message.error('Không thể tải cài đặt thông báo')
    } finally {
      setPrefLoading(false)
    }
  }

  function handlePrefToggle(
    eventType: string,
    channel: 'channel_email' | 'channel_in_app',
    value: boolean,
  ) {
    if (isMandatoryPreference(eventType)) return
    setPreferences((prev) =>
      prev.map((p) =>
        p.event_type === eventType ? { ...p, [channel]: value } : p,
      ),
    )
  }

  async function savePreferences() {
    setPrefSaving(true)
    try {
      const normalized = preferences.map((pref) =>
        isMandatoryPreference(pref.event_type)
          ? { ...pref, channel_email: true, channel_in_app: true }
          : pref,
      )
      await privatePut('/notifications/preferences', { preferences: normalized })
      message.success('Đã lưu cài đặt thông báo')
      setPrefOpen(false)
    } catch {
      message.error('Không thể lưu cài đặt')
    } finally {
      setPrefSaving(false)
    }
  }

  return (
    <div className="notif-page">
      <div className="notif-header">
        <h1 className="notif-header__title">Thông báo</h1>
        <div className="notif-header__actions">
          <button
            className="notif-action-btn"
            type="button"
            onClick={openPreferences}
          >
            Cài đặt
          </button>
          <button
            className="notif-action-btn"
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            aria-disabled={markingAll}
          >
            {markingAll ? 'Đang xử lý…' : 'Đánh dấu tất cả đã đọc'}
          </button>
        </div>
      </div>

      <div className="notif-filters" role="group" aria-label="Lọc thông báo">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`notif-filter-btn${filter === tab.value ? ' notif-filter-btn--active' : ''}`}
            onClick={() => handleFilterChange(tab.value)}
            aria-pressed={filter === tab.value}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: 60 }}
          aria-label="Đang tải"
        >
          <Spin size="large" />
        </div>
      ) : loadError ? (
        <NetworkError
          message={loadError}
          onRetry={() => void fetchNotifications(filter, page)}
        />
      ) : notifications.length === 0 ? (
        <div className="notif-empty" role="status">
          <span className="notif-empty__icon">Hệ thống</span>
          Không có thông báo nào.
        </div>
      ) : (
        <>
          <div className="notif-list" role="list" aria-label="Danh sách thông báo">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                role="listitem"
                className={`notif-item${notif.is_read ? '' : ' notif-item--unread'}`}
                onClick={() => handleItemClick(notif)}
                aria-label={`${notif.title}${notif.is_read ? '' : ', chưa đọc'}`}
              >
                <span className="notif-item__icon" aria-hidden="true">
                  {getIcon(notif.event_type)}
                </span>
                <span className="notif-item__body">
                  <span className="notif-item__title">{notif.title}</span>
                  <span className="notif-item__content">{notif.content}</span>
                </span>
                <span className="notif-item__time">
                  {relativeTimeStr(notif.created_at)}
                </span>
                {!notif.is_read && (
                  <span className="notif-item__dot" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="notif-pagination">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={handlePageChange}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      )}

      <Modal
        title={
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            Cài đặt thông báo
          </span>
        }
        open={prefOpen}
        onCancel={() => setPrefOpen(false)}
        onOk={savePreferences}
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={prefSaving}
        width={480}
      >
        {prefLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : (
          <>
            <div className="pref-header">
              <span className="pref-header__col">Email</span>
              <span className="pref-header__col">In-app</span>
            </div>
            {preferences.map((pref) => (
              <div key={pref.event_type} className="pref-row">
                <span className="pref-row__label">
                  {PREF_LABELS[pref.event_type] ?? pref.event_type}
                  {isMandatoryPreference(pref.event_type) && (
                    <span className="pref-row__mandatory">Bắt buộc</span>
                  )}
                </span>
                <div className="pref-row__toggles">
                  <span className="pref-toggle">
                    <Switch
                      size="small"
                      checked={isMandatoryPreference(pref.event_type) || pref.channel_email}
                      disabled={isMandatoryPreference(pref.event_type)}
                      onChange={(val) =>
                        handlePrefToggle(pref.event_type, 'channel_email', val)
                      }
                      aria-label={`Email cho ${pref.event_type}`}
                    />
                  </span>
                  <span className="pref-toggle">
                    <Switch
                      size="small"
                      checked={isMandatoryPreference(pref.event_type) || pref.channel_in_app}
                      disabled={isMandatoryPreference(pref.event_type)}
                      onChange={(val) =>
                        handlePrefToggle(pref.event_type, 'channel_in_app', val)
                      }
                      aria-label={`In-app cho ${pref.event_type}`}
                    />
                  </span>
                </div>
              </div>
            ))}
            {preferences.length === 0 && (
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-muted)',
                  textAlign: 'center',
                  padding: '20px 0',
                }}
              >
                Không có tuỳ chọn nào.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
