import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Input, Pagination, Select, Spin } from 'antd'
import { publicGet } from '@/api/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { PublicProductListResponse } from '@/types/product'
import { getDemoProductImage } from '@/utils/demoProductImages'
import { getProductConditionLabel } from '@/utils/productDisplay'
import './product-public.css'

interface CategoryOption {
  id: number
  name: string
  slug: string
  sort_order?: number
}

interface HomeResponse {
  categories?: CategoryOption[]
}

const PAGE_SIZE = 12

export function Component() {
  useDocumentTitle('Danh mục sản phẩm')
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState<PublicProductListResponse['items']>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const q = searchParams.get('q') ?? ''
  const categoryId = searchParams.get('category_id') ?? ''
  const condition = searchParams.get('condition') ?? ''
  const sort = searchParams.get('sort') ?? 'newest'
  const rawPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  useEffect(() => {
    let cancelled = false
    publicGet<HomeResponse>('/home')
      .then((response) => {
        if (!cancelled) setCategories(response.data?.categories ?? [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)

    const params: Record<string, unknown> = {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sort,
    }
    if (q.trim()) params.q = q.trim()
    if (categoryId) params.category_id = Number(categoryId)
    if (condition) params.condition = condition

    publicGet<PublicProductListResponse>('/products', params)
      .then((response) => {
        if (cancelled) return
        setProducts(response.data?.items ?? [])
        setTotal(response.data?.total ?? 0)
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([])
          setTotal(0)
          setLoadError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [categoryId, condition, page, q, sort])

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  function updateFilters(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.set('page', '1')
    setSearchParams(next)
  }

  return (
    <div className="public-products" data-testid="public-product-list-page">
      <header className="public-products__header">
        <div>
          <p className="public-products__eyebrow">SẢN PHẨM ĐÃ DUYỆT</p>
          <h1>Danh mục sản phẩm</h1>
          <p>Khám phá sản phẩm từ những người bán trên Buy The Best.</p>
        </div>
        <Link to="/auctions" className="public-products__auction-link">
          Xem phiên đấu giá
        </Link>
      </header>

      <section className="public-products__filters" aria-label="Bộ lọc sản phẩm">
        <Input.Search
          defaultValue={q}
          key={q}
          allowClear
          placeholder="Tìm theo tên sản phẩm"
          aria-label="Tìm sản phẩm theo tên"
          enterButton="Tìm kiếm"
          onSearch={(value) => updateFilters({ q: value.trim() })}
          data-testid="public-product-search"
        />
        <Select
          value={categoryId || undefined}
          allowClear
          placeholder="Tất cả danh mục"
          aria-label="Lọc sản phẩm theo danh mục"
          onChange={(value?: string) => updateFilters({ category_id: value ?? '' })}
          options={categories.map((category) => ({
            value: String(category.id),
            label: category.name,
          }))}
          data-testid="public-product-category-filter"
        />
        <Select
          value={condition || undefined}
          allowClear
          placeholder="Mọi tình trạng"
          aria-label="Lọc sản phẩm theo tình trạng"
          onChange={(value?: string) => updateFilters({ condition: value ?? '' })}
          options={[
            { value: 'new', label: 'Mới' },
            { value: 'like_new', label: 'Như mới' },
            { value: 'used', label: 'Đã sử dụng' },
            { value: 'refurbished', label: 'Tân trang' },
          ]}
          data-testid="public-product-condition-filter"
        />
        <Select
          value={sort}
          aria-label="Sắp xếp sản phẩm"
          onChange={(value: string) => updateFilters({ sort: value })}
          options={[
            { value: 'newest', label: 'Mới nhất' },
            { value: 'oldest', label: 'Cũ nhất' },
            { value: 'title', label: 'Tên A–Z' },
          ]}
          data-testid="public-product-sort"
        />
      </section>

      <div className="public-products__summary" role="status">
        {loading ? 'Đang tải sản phẩm…' : `${total.toLocaleString('vi-VN')} sản phẩm`}
      </div>

      {loading ? (
        <div className="public-products__loading" aria-label="Đang tải sản phẩm">
          <Spin size="large" />
        </div>
      ) : loadError ? (
        <div className="public-products__empty" role="alert">
          Không thể tải danh sách sản phẩm. Vui lòng thử lại sau.
        </div>
      ) : products.length === 0 ? (
        <div className="public-products__empty" role="status">
          Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <section className="public-products__grid" aria-label="Danh sách sản phẩm">
          {products.map((product) => {
            const image = product.cover?.url || getDemoProductImage(product.title)
            const sellerName = product.seller?.shop_name || product.seller?.display_name
            return (
              <Link
                to={`/products/${product.id}`}
                className="public-product-card"
                key={product.id}
                data-testid={`public-product-card-${product.id}`}
                data-test-group="public-product-card"
              >
                <div className="public-product-card__media">
                  {image ? <img src={image} alt={product.title} loading="lazy" /> : <span>BTB</span>}
                </div>
                <div className="public-product-card__body">
                  <span className="public-product-card__condition">
                    {getProductConditionLabel(product.condition)}
                  </span>
                  <h2>{product.title}</h2>
                  <p>
                    {product.category?.name || categoryNames.get(product.category_id) || 'Sản phẩm'}
                    {sellerName ? ` · ${sellerName}` : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </section>
      )}

      {total > PAGE_SIZE && (
        <div className="public-products__pagination">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={(nextPage) => updateFilters({ page: String(nextPage) })}
          />
        </div>
      )}
    </div>
  )
}
