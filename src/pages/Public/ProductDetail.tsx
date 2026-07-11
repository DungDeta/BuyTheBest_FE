import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Spin } from 'antd'
import dayjs from 'dayjs'
import { publicGet } from '@/api/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { ErrorResponse } from '@/types/api'
import type { PublicProduct } from '@/types/product'
import { getDemoProductImage } from '@/utils/demoProductImages'
import { getProductConditionLabel } from '@/utils/productDisplay'
import './product-public.css'

type ProductLoadError = 'not_found' | 'request_failed'

export function Component() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<PublicProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<ProductLoadError | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const [activeImage, setActiveImage] = useState(0)

  useDocumentTitle(product?.title ?? 'Chi tiết sản phẩm')

  useEffect(() => {
    if (!id) {
      setProduct(null)
      setLoadError('not_found')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setProduct(null)
    setActiveImage(0)

    publicGet<PublicProduct>(`/products/${id}`)
      .then((response) => {
        if (!cancelled) setProduct(response.data)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const apiError = error as ErrorResponse
          setProduct(null)
          setLoadError(apiError.code === 404 ? 'not_found' : 'request_failed')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, requestVersion])

  const images = useMemo(
    () => [...(product?.images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [product?.images],
  )

  if (loading) {
    return (
      <div className="public-product-detail__loading" aria-label="Đang tải sản phẩm">
        <Spin size="large" />
      </div>
    )
  }

  if (loadError === 'not_found') {
    return (
      <div className="public-product-detail public-product-detail--empty" data-testid="public-product-not-found">
        <h1>Không tìm thấy sản phẩm</h1>
        <p>Sản phẩm không tồn tại hoặc chưa được duyệt để hiển thị công khai.</p>
        <Link to="/products" className="public-products__auction-link">Về danh mục sản phẩm</Link>
      </div>
    )
  }

  if (loadError === 'request_failed' || !product) {
    return (
      <div className="public-product-detail public-product-detail--empty" data-testid="public-product-load-error">
        <h1>Không thể tải sản phẩm</h1>
        <p>Kết nối đến máy chủ đang gặp sự cố. Vui lòng thử lại.</p>
        <div className="public-product-detail__error-actions">
          <Button
            type="primary"
            onClick={() => setRequestVersion((version) => version + 1)}
            data-testid="public-product-retry"
          >
            Thử lại
          </Button>
          <Link to="/products" className="public-products__auction-link">Về danh mục sản phẩm</Link>
        </div>
      </div>
    )
  }

  const selectedImage = images[activeImage]?.url || getDemoProductImage(product.title)
  const sellerName = product.seller?.shop_name || product.seller?.display_name
  const sellerPublicId = product.seller?.public_id

  return (
    <div className="public-product-detail" data-testid="public-product-detail-page">
      <nav className="public-product-detail__breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/products">Sản phẩm</Link>
        <span>/</span>
        <span aria-current="page">{product.title}</span>
      </nav>

      <div className="public-product-detail__grid">
        <section className="public-product-gallery" aria-label={`Hình ảnh ${product.title}`}>
          <div className="public-product-gallery__main">
            {selectedImage ? (
              <img src={selectedImage} alt={product.title} data-testid="public-product-main-image" />
            ) : (
              <span>Không có ảnh</span>
            )}
          </div>
          {images.length > 1 && (
            <ul className="public-product-gallery__thumbs" aria-label="Ảnh thu nhỏ">
              {images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    className={index === activeImage ? 'is-active' : ''}
                    onClick={() => setActiveImage(index)}
                    aria-label={`Xem ảnh ${index + 1}`}
                    aria-pressed={index === activeImage}
                  >
                    <img src={image.url} alt="" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="public-product-copy">
          <p className="public-products__eyebrow">SẢN PHẨM ĐÃ DUYỆT</p>
          <h1 data-testid="public-product-title">{product.title}</h1>
          <div className="public-product-copy__badges">
            <span>{getProductConditionLabel(product.condition)}</span>
            {product.category && (
              <Link to={`/categories/${product.category.slug}`}>{product.category.name}</Link>
            )}
          </div>

          <div className="public-product-copy__facts">
            <div>
              <span>Tình trạng</span>
              <strong>{getProductConditionLabel(product.condition)}</strong>
            </div>
            <div>
              <span>Ngày đăng</span>
              <strong>{dayjs(product.created_at).format('DD/MM/YYYY')}</strong>
            </div>
            {sellerName && (
              <div>
                <span>Người bán</span>
                {sellerPublicId ? (
                  <Link to={`/sellers/${sellerPublicId}`}>{sellerName}</Link>
                ) : (
                  <strong>{sellerName}</strong>
                )}
              </div>
            )}
          </div>

          <Link
            to={`/auctions?q=${encodeURIComponent(product.title)}`}
            className="public-product-copy__cta"
            data-testid="public-product-find-auctions"
          >
            Tìm phiên đấu giá sản phẩm này
          </Link>
        </section>
      </div>

      <section className="public-product-description" data-testid="public-product-description">
        <h2>Mô tả sản phẩm</h2>
        <p>{product.description}</p>
      </section>
    </div>
  )
}
