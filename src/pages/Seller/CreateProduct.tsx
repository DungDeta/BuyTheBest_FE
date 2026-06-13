import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Form, Input, Select, Steps } from 'antd'
import { privateDelete, privatePost, privatePut } from '@/api/api'
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
  id: number
  title: string
  slug: string
  description: string
  condition: ProductCondition
  status: ProductStatus
  rejection_reason: string | null
  category_id: number
  seller_id: number
  images: ProductImageResponse[]
  created_at: string
  updated_at: string
}

interface PresignResponse {
  object_key: string
  upload_url: string
  form_fields: Record<string, string>
  http_method?: string
  max_size: number
  expires_at: string
}

interface BasicInfoValues {
  title: string
  description: string
  category_id: number
  condition: ProductCondition
}

const CATEGORIES = [
  { id: 1, name: 'Điện thoại' },
  { id: 2, name: 'Laptop' },
  { id: 3, name: 'Đồng hồ' },
  { id: 4, name: 'Thời trang' },
  { id: 5, name: 'Điện tử' },
  { id: 6, name: 'Xe' },
  { id: 7, name: 'Khác' },
]

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

const MAX_IMAGES = 10
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
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

export function Component() {
  const { message } = App.useApp()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [product, setProduct] = useState<ProductResponse | null>(null)

  const [images, setImages] = useState<ProductImageResponse[]>([])
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form] = Form.useForm<BasicInfoValues>()

  async function handleCreateProduct(values: BasicInfoValues) {
    setSubmitting(true)
    try {
      const res = await privatePost<ProductResponse>('/products', {
        title: values.title,
        description: values.description,
        category_id: values.category_id,
        condition: values.condition,
      })
      if (!res.data) throw new Error('No data returned')
      setProduct(res.data)
      setImages(res.data.images ?? [])
      setCurrentStep(1)
    } catch {
      message.error('Không thể tạo sản phẩm. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !product) return

    if (images.length >= MAX_IMAGES) {
      message.warning(`Tối đa ${MAX_IMAGES} ảnh`)
      return
    }

    const contentType = getProductImageContentType(file)
    if (!contentType) {
      message.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP')
      return
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      message.error(`Ảnh tối đa ${formatFileSize(MAX_PRODUCT_IMAGE_BYTES)}`)
      return
    }

    const slotIndex = images.length
    setUploadingSlot(slotIndex)

    try {
      const presignRes = await privatePost<PresignResponse>(
        `/products/${product.id}/images/presign`,
        { content_type: contentType },
      )
      if (!presignRes.data) throw new Error('Presign failed')

      const { object_key, upload_url, form_fields } = presignRes.data
      const maxSize = presignRes.data.max_size ?? MAX_PRODUCT_IMAGE_BYTES
      if (file.size > maxSize) {
        message.error(`Ảnh tối đa ${formatFileSize(maxSize)}`)
        return
      }

      const formData = new FormData()
      for (const [key, val] of Object.entries(form_fields)) {
        formData.append(key, val)
      }
      formData.append('file', file)

      const uploadRes = await fetch(upload_url, {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')

      const isPrimary = images.length === 0
      const attachRes = await privatePost<ProductImageResponse>(
        `/products/${product.id}/images`,
        {
          object_key,
          sort_order: images.length,
          is_primary: isPrimary,
        },
      )
      if (!attachRes.data) throw new Error('Attach failed')

      setImages((prev) => [...prev, attachRes.data!])
      message.success('Đã tải lên ảnh')
    } catch {
      message.error('Tải ảnh thất bại. Vui lòng thử lại.')
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
    } catch {
      message.error('Không thể xoá ảnh')
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
    } catch {
      message.error('Không thể đặt ảnh chính')
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
    } catch {
      message.error('Không thể gửi duyệt. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSaveDraft() {
    message.success('Sản phẩm đã được lưu nháp')
    navigate('/seller/products')
  }

  const categoryName =
    CATEGORIES.find((c) => c.id === product?.category_id)?.name ?? ''

  return (
    <div className="seller-page">
      <div className="seller-page__header">
        <h1 className="seller-page__title">Thêm sản phẩm mới</h1>
      </div>

      <div className="wizard-shell">
        <div className="wizard-steps">
          <Steps
            current={currentStep}
            items={[
              { title: 'Thông tin cơ bản' },
              { title: 'Hình ảnh' },
              { title: 'Gửi duyệt' },
            ]}
          />
        </div>

        {currentStep === 0 && (
          <div className="wizard-step">
            <h2 className="wizard-step__title">Thông tin sản phẩm</h2>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleCreateProduct}
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
                  options={CATEGORIES.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
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
                  Tiếp theo
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
            <h2 className="wizard-step__title">Xác nhận & gửi duyệt</h2>

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
              <Button onClick={handleSaveDraft}>Lưu nháp</Button>
              <Button
                type="primary"
                onClick={handleSubmitForReview}
                loading={submitting}
              >
                Gửi duyệt
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
