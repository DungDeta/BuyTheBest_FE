import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Pagination, Popconfirm, Spin } from 'antd'
import { privateDelete, privateGet, privatePost } from '@/api/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getDemoProductImage } from '@/utils/demoProductImages'
import './seller.css'

type ProductStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'
type StatusFilter = ProductStatus | 'all'

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
  cover?: ProductCover | null
  created_at: string
  rejection_reason?: string | null
}

interface ProductsResponse {
  items: ProductListItem[]
  total: number
  limit: number
  offset: number
}

const PAGE_SIZE = 20

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'draft', label: 'Nháp' },
  { value: 'pending_review', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Bị từ chối' },
]

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Nháp',
  pending_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Mới',
  like_new: 'Như mới',
  used: 'Đã sử dụng',
  refurbished: 'Tân trang',
}

export function Component() {
  useDocumentTitle('Sản phẩm của tôi')
  const { message } = App.useApp()
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false

    async function fetchProducts() {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        }
        if (statusFilter !== 'all') {
          params.status = statusFilter
        }
        const res = await privateGet<ProductsResponse>('/me/products', params)
        if (!cancelled) {
          setProducts(res.data?.items ?? [])
          setTotal(res.data?.total ?? 0)
        }
      } catch {
        if (!cancelled) {
          message.error('Không thể tải danh sách sản phẩm')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProducts()
    return () => { cancelled = true }
  }, [statusFilter, page, message])

  function handleFilterChange(next: StatusFilter) {
    setStatusFilter(next)
    setPage(1)
  }

  function setItemLoading(id: string, state: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: state }))
  }

  async function handleDelete(product: ProductListItem) {
    setItemLoading(product.id, true)
    try {
      await privateDelete(`/products/${product.id}`)
      message.success('Đã xoá sản phẩm')
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setTotal((t) => t - 1)
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể xoá sản phẩm'))
    } finally {
      setItemLoading(product.id, false)
    }
  }

  async function handleSubmit(product: ProductListItem) {
    setItemLoading(product.id, true)
    try {
      await privatePost(`/products/${product.id}/submit`)
      message.success('Đã gửi yêu cầu duyệt')
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, status: 'pending_review' } : p,
        ),
      )
    } catch {
      message.error('Không thể gửi yêu cầu duyệt')
    } finally {
      setItemLoading(product.id, false)
    }
  }

  return (
    <div className="seller-page">
      <div className="seller-page__header">
        <h1 className="seller-page__title">Sản phẩm của tôi</h1>
        <Button
          type="primary"
          onClick={() => navigate('/seller/products/new')}
        >
          + Thêm sản phẩm mới
        </Button>
      </div>

      <div className="seller-page__filters" role="group" aria-label="Lọc theo trạng thái">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`seller-filter-btn${statusFilter === tab.value ? ' seller-filter-btn--active' : ''}`}
            onClick={() => handleFilterChange(tab.value)}
            type="button"
            aria-pressed={statusFilter === tab.value}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }} aria-label="Đang tải">
          <Spin size="large" />
        </div>
      ) : products.length === 0 ? (
        <div className="seller-empty" role="status">
          <span className="seller-empty__icon">PRD</span>
          <p className="seller-empty__text">Chưa có sản phẩm nào.</p>
          <Button type="primary" onClick={() => navigate('/seller/products/new')}>
            Thêm sản phẩm đầu tiên
          </Button>
        </div>
      ) : (
        <>
          <div className="seller-product-grid" role="list" aria-label="Danh sách sản phẩm">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                loading={actionLoading[product.id] ?? false}
                onEdit={() => navigate(`/seller/products/${product.id}/edit`)}
                onDelete={() => handleDelete(product)}
                onSubmit={() => handleSubmit(product)}
                onCreateAuction={() =>
                  navigate(`/seller/auctions/new?product_id=${product.id}`)
                }
              />
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'string'
  ) {
    return error.error
  }
  return fallback
}

interface ProductCardProps {
  product: ProductListItem
  loading: boolean
  onEdit: () => void
  onDelete: () => void
  onSubmit: () => void
  onCreateAuction: () => void
}

function ProductCard({
  product,
  loading,
  onEdit,
  onDelete,
  onSubmit,
  onCreateAuction,
}: ProductCardProps) {
  const createdDate = new Date(product.created_at).toLocaleDateString('vi-VN')
  const imageUrl = product.cover?.url || getDemoProductImage(product.title)

  return (
    <article className="product-card" role="listitem">
      {imageUrl ? (
        <img
          className="product-card__thumb"
          src={imageUrl}
          alt={product.title}
        />
      ) : (
        <div className="product-card__thumb--placeholder" aria-hidden="true">
          IMG
        </div>
      )}

      <div className="product-card__body">
        <h3 className="product-card__title">{product.title}</h3>

        <p className="product-card__meta">
          {CONDITION_LABELS[product.condition] ?? product.condition}
          {' · '}
          {createdDate}
        </p>

        <span className={`product-card__status product-card__status--${product.status}`}>
          {STATUS_LABELS[product.status]}
        </span>

        {product.status === 'rejected' && product.rejection_reason && (
          <p className="product-card__rejection">
            Lý do từ chối: {product.rejection_reason}
          </p>
        )}
      </div>

      <div className="product-card__actions">
        {product.status === 'draft' && (
          <>
            <Button size="small" onClick={onEdit} disabled={loading}>
              Sửa
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={onSubmit}
              loading={loading}
            >
              Gửi duyệt
            </Button>
          </>
        )}

        {product.status === 'pending_review' && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-muted)',
            }}
          >
            Đang chờ duyệt…
          </span>
        )}

        {product.status === 'approved' && (
          <>
            <Button size="small" onClick={onEdit} disabled={loading}>
              Sửa
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={onCreateAuction}
              disabled={loading}
            >
              Tạo phiên đấu giá
            </Button>
          </>
        )}

        {product.status === 'rejected' && (
          <>
            <Button size="small" onClick={onEdit} disabled={loading}>
              Sửa
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={onSubmit}
              loading={loading}
            >
              Gửi lại duyệt
            </Button>
          </>
        )}

        <Popconfirm
          title="Xoá sản phẩm?"
          description="Sản phẩm có phiên đấu giá đang mở sẽ không thể xoá."
          onConfirm={onDelete}
          okText="Xoá"
          cancelText="Huỷ"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger disabled={loading}>
            Xoá
          </Button>
        </Popconfirm>
      </div>
    </article>
  )
}
