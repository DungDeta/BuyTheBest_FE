import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Pagination, Spin } from 'antd'
import { privateGet } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import { OrderCard } from '@/components/order/OrderCard'
import type { Order, OrderStatus } from '@/types/order'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './post-win.css'

interface OrdersResponse {
  orders: Order[]
  total: number
}

type RoleTab = 'buyer' | 'seller'

const STATUS_FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending_payment', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'shipped', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã huỷ' },
  { value: 'refunded', label: 'Đã hoàn tiền' },
]

const PAGE_SIZE = 20
const VALID_STATUSES = new Set<OrderStatus>([
  'pending_payment',
  'paid',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
])

export function Component() {
  useDocumentTitle('Đơn hàng')
  const { message } = App.useApp()
  const isSeller = useAuthStore((s) => s.isSeller)
  const [searchParams, setSearchParams] = useSearchParams()

  const showSellerTab = isSeller()
  const roleParam = searchParams.get('role')
  const statusParam = searchParams.get('status')
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10)

  const role: RoleTab = roleParam === 'seller' && showSellerTab ? 'seller' : 'buyer'
  const status: OrderStatus | 'all' =
    statusParam && VALID_STATUSES.has(statusParam as OrderStatus)
      ? statusParam as OrderStatus
      : 'all'
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const canonical = { role, status, page: String(page) }
    if (
      searchParams.get('role') !== canonical.role ||
      searchParams.get('status') !== canonical.status ||
      searchParams.get('page') !== canonical.page
    ) {
      setSearchParams(canonical, { replace: true })
    }
  }, [page, role, searchParams, setSearchParams, status])

  useEffect(() => {
    let cancelled = false

    async function fetchOrders() {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          role,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        }
        if (status !== 'all') {
          params.status = status
        }
        const res = await privateGet<OrdersResponse>('/orders', params)
        if (!cancelled) {
          setOrders(res.data?.orders ?? [])
          setTotal(res.data?.total ?? 0)
        }
      } catch {
        if (!cancelled) {
          message.error('Không thể tải danh sách đơn hàng')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOrders()
    return () => { cancelled = true }
  }, [role, status, page, message])

  function handleRoleChange(next: RoleTab) {
    setSearchParams({ role: next, status: 'all', page: '1' })
  }

  function handleStatusChange(next: OrderStatus | 'all') {
    setSearchParams({ role, status: next, page: '1' })
  }

  function handlePageChange(next: number) {
    setSearchParams({ role, status, page: String(next) })
  }

  return (
    <div className="orders-page">
      <div className="orders-page__header">
        <h1 className="orders-page__title">Đơn hàng</h1>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`escrow-step${role === 'buyer' ? ' escrow-step--active' : ''}`}
            onClick={() => handleRoleChange('buyer')}
            type="button"
            aria-pressed={role === 'buyer'}
          >
            Đơn mua
          </button>
          {showSellerTab && (
            <button
              className={`escrow-step${role === 'seller' ? ' escrow-step--active' : ''}`}
              onClick={() => handleRoleChange('seller')}
              type="button"
              aria-pressed={role === 'seller'}
            >
              Đơn bán
            </button>
          )}
        </div>
      </div>

      <div className="orders-page__filters" role="group" aria-label="Lọc theo trạng thái">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`escrow-step${status === f.value ? ' escrow-step--active' : ''}`}
            onClick={() => handleStatusChange(f.value)}
            type="button"
            aria-pressed={status === f.value}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }} aria-label="Đang tải">
          <Spin size="large" />
        </div>
      ) : orders.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-muted)',
          }}
          role="status"
        >
          Chưa có đơn hàng nào.
        </div>
      ) : (
        <>
          <div style={{ marginTop: 16 }} role="list" aria-label="Danh sách đơn hàng">
            {orders.map((order) => (
              <div key={order.id} role="listitem">
                <OrderCard order={order} role={role} />
              </div>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
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
    </div>
  )
}
