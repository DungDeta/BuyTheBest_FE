import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, App, Button, Form, Input, Select, Spin, Steps } from 'antd'
import { privateDelete, privateGet, privatePost, privatePostForm, privatePut, publicGet } from '@/api/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './seller.css'

type ProductCondition = 'new' | 'like_new' | 'used' | 'refurbished'
type ProductStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

interface ProductImageResponse {
  id: number
  url: string
  sort_order: number
  is_primary: boolean
}

interface ProductResponse {
  id: string
  title: string
  slug: string
  description: string
  condition: ProductCondition
  status: ProductStatus
  rejection_reason: string | null
  category_id: number
  seller_id: number
  images: ProductImageResponse[]
  has_open_auction?: boolean
  created_at: string
  updated_at: string
}

interface BasicInfoValues {
  title: string
  description: string
  category_id: number
  condition: ProductCondition
}

interface CategoryOption {
  id: number
  name: string
  slug?: string
  sort_order?: number
}

interface HomeResponse {
  categories?: CategoryOption[]
}

const CONDITIONS: { value: ProductCondition; label: string }[] = [
  { value: 'new', label: 'Mới' },
  { value: 'like_new', label: 'Như mới' },
  { value: 'used', label: 'Đã sử dụng' },
  { value: 'refurbished', label: 'Tân trang' },
]

const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: 'Mới',
  like_new: 'Như mới',
  used: 'Đã sử dụng',
  refurbished: 'Tân trang',
}

const MAX_IMAGES = 6
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
const PRODUCT_IMAGE_MESSAGE_KEY = 'product-image-upload'
const PRODUCT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function getProductImageContentType(file: File): string | null {
  if (file.type === 'image/jpg') return 'image/jpeg'
  if (file.type && PRODUCT_IMAGE_TYPES.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

export function Component() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { id: editProductId } = useParams()
  const isEditing = Boolean(editProductId)
  useDocumentTitle(isEditing ? 'Sửa sản phẩm' : 'Thêm sản phẩm')

  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [loadingProduct, setLoadingProduct] = useState(isEditing)
  const [loadError, setLoadError] = useState(false)

  const [product, setProduct] = useState<ProductResponse | null>(null)

  const [images, setImages] = useState<ProductImageResponse[]>([])
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form] = Form.useForm<BasicInfoValues>()

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      setCategoriesLoading(true)
      setCategoryLoadError(null)
      try {
        const res = await publicGet<HomeResponse>('/home')
        const nextCategories = (res.data?.categories ?? [])
          .filter((category) => Number.isFinite(category.id) && category.name.trim())
          .sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id))
        if (!cancelled) {
          setCategories(nextCategories)
          if (nextCategories.length === 0) {
            setCategoryLoadError('Hệ thống chưa có danh mục khả dụng để tạo sản phẩm.')
          }
        }
      } catch {
        if (!cancelled) {
          setCategories([])
          setCategoryLoadError('Không thể tải danh mục sản phẩm. Vui lòng thử lại trước khi tạo sản phẩm.')
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false)
      }
    }

    loadCategories()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!editProductId) return

    let cancelled = false
    async function loadProduct() {
      setLoadingProduct(true)
      setLoadError(false)
      try {
        const res = await privateGet<ProductResponse>(`/me/products/${editProductId}`)
        if (!res.data || cancelled) return
        setProduct(res.data)
        setImages(res.data.images ?? [])
        form.setFieldsValue({
          title: res.data.title,
          description: res.data.description,
          category_id: res.data.category_id,
          condition: res.data.condition,
        })
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoadingProduct(false)
      }
    }

    loadProduct()
    return () => {
      cancelled = true
    }
  }, [editProductId, form])

  const isDescriptionOnly = Boolean(isEditing && product?.has_open_auction)

  async function handleSaveBasicInfo(values: BasicInfoValues) {
    if (!isDescriptionOnly && categories.length === 0) {
      message.error('Chưa có danh mục hợp lệ để tạo sản phẩm')
      return
    }

    setSubmitting(true)
    try {
      const payload = isDescriptionOnly
        ? { description: values.description }
        : {
            title: values.title,
            description: values.description,
            category_id: values.category_id,
            condition: values.condition,
          }
      const res = isEditing && editProductId
        ? await privatePut<ProductResponse>(`/products/${editProductId}`, payload)
        : await privatePost<ProductResponse>('/products', payload)
      if (!res.data) throw new Error('No data returned')
      const nextProduct = isEditing && product
        ? {
            ...product,
            ...res.data,
            images,
            has_open_auction: product.has_open_auction,
          }
        : res.data
      setProduct(nextProduct)
      setImages(nextProduct.images ?? [])
      if (isDescriptionOnly) {
        message.success('Đã cập nhật mô tả sản phẩm')
        navigate('/seller/products')
        return
      }
      if (isEditing) message.success('Đã cập nhật thông tin sản phẩm')
      setCurrentStep(1)
    } catch (error) {
      const fallback = isEditing
        ? 'Không thể cập nhật sản phẩm. Vui lòng thử lại.'
        : 'Không thể tạo sản phẩm. Vui lòng thử lại.'
      message.error(getApiErrorMessage(error, fallback))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !product) return

    if (images.length >= MAX_IMAGES) {
      message.warning({
        content: `T\u1ed1i \u0111a ${MAX_IMAGES} \u1ea3nh`,
        key: PRODUCT_IMAGE_MESSAGE_KEY,
      })
      return
    }

    const contentType = getProductImageContentType(file)
    if (!contentType) {
      message.error({
        content: 'Ch\u1ec9 h\u1ed7 tr\u1ee3 \u1ea3nh JPG, PNG ho\u1eb7c WEBP',
        key: PRODUCT_IMAGE_MESSAGE_KEY,
      })
      return
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      message.error({
        content: `\u1ea2nh t\u1ed1i \u0111a ${formatFileSize(MAX_PRODUCT_IMAGE_BYTES)}`,
        key: PRODUCT_IMAGE_MESSAGE_KEY,
      })
      return
    }

    const slotIndex = images.length
    setUploadingSlot(slotIndex)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sort_order', String(slotIndex))
      formData.append('is_primary', String(images.length === 0))

      const uploadRes = await privatePostForm<ProductImageResponse>(
        `/products/${product.id}/images/upload`,
        formData,
      )
      if (!uploadRes.data) throw new Error('Upload failed')

      setImages((prev) => [...prev, uploadRes.data!])
      message.success({
        content: '\u0110\u00e3 t\u1ea3i l\u00ean \u1ea3nh',
        key: PRODUCT_IMAGE_MESSAGE_KEY,
        duration: 1.5,
      })
    } catch (error) {
      message.error({
        content: getApiErrorMessage(
          error,
          'T\u1ea3i \u1ea3nh th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.',
        ),
        key: PRODUCT_IMAGE_MESSAGE_KEY,
      })
    } finally {
      setUploadingSlot(null)
    }
  }

  async function handleDeleteImage(img: ProductImageResponse) {
    if (!product) return
    setDeletingId(img.id)
    try {
      await privateDelete(`/products/${product.id}/images/${img.id}`)
      setImages((prev) => prev.filter((i) => i.id !== img.id))
      message.success('Đã xoá ảnh')
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể xoá ảnh'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSetPrimary(img: ProductImageResponse) {
    if (!product || img.is_primary) return
    setSettingPrimaryId(img.id)
    try {
      await privatePut(`/products/${product.id}/images/${img.id}/primary`)
      setImages((prev) =>
        prev.map((i) => ({ ...i, is_primary: i.id === img.id })),
      )
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể đặt ảnh chính'))
    } finally {
      setSettingPrimaryId(null)
    }
  }

  async function handleSubmitForReview() {
    if (!product) return
    setSubmitting(true)
    try {
      await privatePost(`/products/${product.id}/submit`)
      message.success('Đã gửi sản phẩm để duyệt!')
      navigate('/seller/products')
    } catch (error) {
      message.error(
        getApiErrorMessage(
          error,
          'Không thể gửi duyệt. Vui lòng thử lại.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleSaveDraft() {
    message.success(isEditing ? 'Đã lưu thay đổi sản phẩm' : 'Sản phẩm đã được lưu nháp')
    navigate('/seller/products')
  }

  const categoryName =
    categories.find((c) => c.id === product?.category_id)?.name ??
    (product?.category_id != null ? `Danh mục #${product.category_id}` : '')
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }))
  if (
    product?.category_id != null &&
    !categoryOptions.some((option) => option.value === product.category_id)
  ) {
    categoryOptions.push({
      value: product.category_id,
      label: categoryName,
    })
  }
  const canSubmitForReview =
    product?.status === 'draft' || product?.status === 'rejected'
  const steps = isDescriptionOnly
    ? [{ title: 'Chỉnh sửa mô tả' }]
    : [
        { title: 'Thông tin cơ bản' },
        { title: 'Hình ảnh' },
        { title: isEditing ? 'Hoàn tất' : 'Gửi duyệt' },
      ]

  if (loadingProduct) {
    return (
      <div className="seller-page">
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: 80 }}
          aria-label="Đang tải sản phẩm"
        >
          <Spin size="large" />
        </div>
      </div>
    )
  }

  if (loadError || (isEditing && !product)) {
    return (
      <div className="seller-page">
        <div className="seller-empty" role="alert">
          <span className="seller-empty__icon">PRD</span>
          <p className="seller-empty__text">
            Không thể tải sản phẩm hoặc bạn không có quyền chỉnh sửa.
          </p>
          <Button type="primary" onClick={() => navigate('/seller/products')}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="seller-page">
      <div className="seller-page__header">
        <h1 className="seller-page__title">
          {isEditing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
        </h1>
      </div>

      <div className="wizard-shell">
        <div className="wizard-steps">
          <Steps current={currentStep} items={steps} />
        </div>

        {currentStep === 0 && (
          <div className="wizard-step">
            <h2 className="wizard-step__title">
              {isDescriptionOnly
                ? 'Cập nhật mô tả sản phẩm'
                : isEditing
                  ? 'Chỉnh sửa thông tin sản phẩm'
                  : 'Thông tin sản phẩm'}
            </h2>

            {isDescriptionOnly && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
                message="Sản phẩm đang có phiên đấu giá mở"
                description="Để bảo đảm thông tin của phiên đấu giá không thay đổi, bạn chỉ có thể cập nhật phần mô tả."
              />
            )}

            {!isDescriptionOnly && categoryLoadError && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 20 }}
                message="Chưa tải được danh mục"
                description={categoryLoadError}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveBasicInfo}
              requiredMark={false}
            >
              <Form.Item
                label="Tiêu đề"
                name="title"
                rules={[
                  { required: true, message: 'Vui lòng nhập tiêu đề' },
                  { min: 3, message: 'Tối thiểu 3 ký tự' },
                  { max: 200, message: 'Tối đa 200 ký tự' },
                ]}
              >
                <Input
                  placeholder="Tên sản phẩm"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  disabled={isDescriptionOnly}
                />
              </Form.Item>

              <Form.Item
                label="Mô tả"
                name="description"
                rules={[
                  { required: true, message: 'Vui lòng nhập mô tả' },
                  { min: 10, message: 'Tối thiểu 10 ký tự' },
                  { max: 5000, message: 'Tối đa 5000 ký tự' },
                ]}
              >
                <Input.TextArea
                  rows={5}
                  placeholder="Mô tả chi tiết về sản phẩm…"
                  style={{ fontFamily: 'var(--font-mono)', resize: 'vertical' }}
                />
              </Form.Item>

              <Form.Item
                label="Danh mục"
                name="category_id"
                rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
              >
                <Select
                  placeholder="Chọn danh mục"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  disabled={isDescriptionOnly || categoriesLoading || categories.length === 0}
                  loading={categoriesLoading}
                  notFoundContent={categoriesLoading ? <Spin size="small" /> : 'Không có danh mục khả dụng'}
                  options={categoryOptions}
                />
              </Form.Item>

              <Form.Item
                label="Tình trạng"
                name="condition"
                rules={[{ required: true, message: 'Vui lòng chọn tình trạng' }]}
              >
                <Select
                  placeholder="Chọn tình trạng"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  disabled={isDescriptionOnly}
                  options={CONDITIONS.map((c) => ({
                    value: c.value,
                    label: c.label,
                  }))}
                />
              </Form.Item>

              <div className="wizard-step__actions">
                <Button onClick={() => navigate('/seller/products')}>
                  Huỷ
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                >
                  {isDescriptionOnly
                    ? 'Lưu thay đổi'
                    : isEditing
                      ? 'Lưu và tiếp tục'
                      : 'Tiếp theo'}
                </Button>
              </div>
            </Form>
          </div>
        )}

        {currentStep === 1 && product && (
          <div className="wizard-step">
            <h2 className="wizard-step__title">Hình ảnh sản phẩm</h2>

            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--color-muted)',
                marginBottom: 8,
              }}
            >
              Tối đa {MAX_IMAGES} ảnh. Ảnh đầu tiên sẽ là ảnh chính.
              Nhấn vào ảnh đã tải để đặt làm ảnh chính hoặc xoá.
            </p>

            <div className="image-upload-grid">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`image-slot image-slot--filled${img.is_primary ? ' image-slot--primary' : ''}`}
                >
                  <img
                    className="image-slot__img"
                    src={img.url}
                    alt="Product image"
                  />
                  {img.is_primary && (
                    <span className="image-slot__primary-badge">Chính</span>
                  )}
                  <div className="image-slot__overlay">
                    {!img.is_primary && (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        onClick={() => handleSetPrimary(img)}
                        loading={settingPrimaryId === img.id}
                        style={{ fontSize: 11 }}
                      >
                        Đặt làm chính
                      </Button>
                    )}
                    <Button
                      size="small"
                      danger
                      onClick={() => handleDeleteImage(img)}
                      loading={deletingId === img.id}
                      style={{ fontSize: 11 }}
                    >
                      Xoá
                    </Button>
                  </div>
                  {(deletingId === img.id || settingPrimaryId === img.id) && (
                    <div className="image-slot__uploading">
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                        …
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <button
                  className="image-slot"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingSlot !== null}
                  aria-label="Tải ảnh lên"
                >
                  {uploadingSlot !== null ? (
                    <span style={{ fontSize: 12 }}>Đang tải…</span>
                  ) : (
                    <>
                      <span className="image-slot__icon">+</span>
                      <span>Tải ảnh lên</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              aria-hidden="true"
            />

            <div className="wizard-step__actions">
              <Button onClick={() => setCurrentStep(0)}>Quay lại</Button>
              <Button onClick={() => setCurrentStep(2)}>Tiếp theo</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Submit ── */}
        {currentStep === 2 && product && (
          <div className="wizard-step">
            <h2 className="wizard-step__title">
              {isEditing ? 'Xác nhận thay đổi' : 'Xác nhận & gửi duyệt'}
            </h2>

            {product.status === 'pending_review' && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 20 }}
                message="Sản phẩm đang chờ duyệt lại"
                description="Các thay đổi đã được lưu. Sản phẩm sẽ hiển thị lại sau khi quản trị viên phê duyệt."
              />
            )}

            <div className="product-summary">
              <div className="product-summary__row">
                <span className="product-summary__label">Tiêu đề</span>
                <span className="product-summary__value">{product.title}</span>
              </div>
              <div className="product-summary__row">
                <span className="product-summary__label">Danh mục</span>
                <span className="product-summary__value">{categoryName}</span>
              </div>
              <div className="product-summary__row">
                <span className="product-summary__label">Tình trạng</span>
                <span className="product-summary__value">
                  {CONDITION_LABELS[product.condition]}
                </span>
              </div>
              <div className="product-summary__row">
                <span className="product-summary__label">Số ảnh</span>
                <span className="product-summary__value">{images.length}</span>
              </div>
              <div className="product-summary__row">
                <span className="product-summary__label">Mô tả</span>
                <span
                  className="product-summary__value"
                  style={{ maxWidth: 360, whiteSpace: 'pre-line' }}
                >
                  {product.description.slice(0, 200)}
                  {product.description.length > 200 ? '…' : ''}
                </span>
              </div>
            </div>

            <div className="wizard-step__actions">
              <Button onClick={() => setCurrentStep(1)}>Quay lại</Button>
              <Button onClick={handleSaveDraft}>
                {isEditing ? 'Hoàn tất' : 'Lưu nháp'}
              </Button>
              {canSubmitForReview && (
                <Button
                  type="primary"
                  onClick={handleSubmitForReview}
                  loading={submitting}
                >
                  {product.status === 'rejected'
                    ? 'Gửi lại duyệt'
                    : 'Gửi duyệt'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
