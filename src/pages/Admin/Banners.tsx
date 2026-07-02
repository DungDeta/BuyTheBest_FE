import { useCallback, useEffect, useRef, useState } from 'react'
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Switch,
  Tag,
  Tooltip,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { privateDelete, privateGet, privatePost, privatePut } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './admin.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BannerResponse {
  id: number
  title: string
  image_url: string
  link_url?: string | null
  sort_order: number
  is_active: boolean
  start_at: string | null
  end_at: string | null
  created_at: string
}

interface UploadUrlResponse {
  upload_url: string
  fields: Record<string, string>
  image_url: string
  object_key: string
  max_size: number
}

interface BannerFormValues {
  title: string
  link_url: string
  sort_order: number
  is_active: boolean
  start_at: Dayjs | null
  end_at: Dayjs | null
}

type FormMode = 'create' | 'edit'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// ─── Component ────────────────────────────────────────────────────────────────

export function Component() {
  useDocumentTitle('Quản trị · Banner')
  const { message } = App.useApp()
  const [form] = Form.useForm<BannerFormValues>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [banners, setBanners] = useState<BannerResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageObjectKey, setImageObjectKey] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const fetchBanners = useCallback(async () => {
    setLoading(true)
    try {
      const res = await privateGet<BannerResponse[]>('/admin/banners')
      const bannerList = Array.isArray(res.data) ? res.data : []
      const sorted = bannerList
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
      setBanners(sorted)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không tải được banner')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchBanners()
  }, [fetchBanners])

  function openCreate() {
    setMode('create')
    setEditingId(null)
    setImagePreview(null)
    setImageUrl(null)
    setImageObjectKey(null)
    form.resetFields()
    form.setFieldsValue({ title: '', sort_order: 0, is_active: true })
    setModalOpen(true)
  }

  function openEdit(banner: BannerResponse) {
    setMode('edit')
    setEditingId(banner.id)
    setImagePreview(banner.image_url)
    setImageUrl(banner.image_url)
    setImageObjectKey(null) // no re-upload needed unless user picks new file
    form.setFieldsValue({
      title: banner.title,
      link_url: banner.link_url ?? '',
      sort_order: banner.sort_order,
      is_active: banner.is_active,
      start_at: banner.start_at ? dayjs(banner.start_at) : null,
      end_at: banner.end_at ? dayjs(banner.end_at) : null,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setImagePreview(null)
    setImageUrl(null)
    setImageObjectKey(null)
    form.resetFields()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      message.error('Chỉ chấp nhận JPEG, PNG, hoặc WebP')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      message.error('Ảnh không được vượt quá 2MB')
      return
    }

    setUploading(true)
    try {
      // Step 1: get presigned URL
      const presignRes = await privatePost<UploadUrlResponse>(
        '/admin/banners/upload-url',
      )
      const { upload_url, fields, image_url, object_key } = presignRes.data

      // Step 2: upload via multipart
      const formData = new FormData()
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v))
      formData.append('file', file)

      const uploadRes = await fetch(upload_url, {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`)
      }

      // Step 3: store result and show preview
      setImageUrl(image_url)
      setImageObjectKey(object_key)
      setImagePreview(URL.createObjectURL(file))
      message.success('Đã tải ảnh lên')
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Tải ảnh thất bại')
    } finally {
      setUploading(false)
      // reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(values: BannerFormValues) {
    if (!imageUrl) {
      message.error('Vui lòng tải ảnh banner lên')
      return
    }

    if (values.start_at && values.end_at) {
      if (!values.end_at.isAfter(values.start_at)) {
        message.error('Ngày kết thúc phải sau ngày bắt đầu')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        title: values.title.trim(),
        image_url: imageUrl,
        link_url: values.link_url?.trim() || undefined,
        sort_order: values.sort_order ?? 0,
        is_active: values.is_active,
        start_at: values.start_at ? values.start_at.toISOString() : undefined,
        end_at: values.end_at ? values.end_at.toISOString() : undefined,
      }
      // only include object_key when a new file was uploaded
      if (imageObjectKey) {
        payload.image_object_key = imageObjectKey
      }

      if (mode === 'create') {
        await privatePost('/admin/banners', payload)
        message.success('Đã thêm banner')
      } else if (editingId !== null) {
        await privatePut(`/admin/banners/${editingId}`, payload)
        message.success('Đã cập nhật banner')
      }

      closeModal()
      await fetchBanners()
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Lưu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id)
    try {
      await privateDelete(`/admin/banners/${id}`)
      message.success('Đã xoá banner')
      await fetchBanners()
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Xoá thất bại')
    } finally {
      setDeleting(null)
    }
  }

  async function handleToggleActive(banner: BannerResponse) {
    setToggling(banner.id)
    try {
      await privatePut(`/admin/banners/${banner.id}`, {
        title: banner.title,
        image_url: banner.image_url,
        link_url: banner.link_url,
        sort_order: banner.sort_order,
        is_active: !banner.is_active,
        start_at: banner.start_at ?? undefined,
        end_at: banner.end_at ?? undefined,
      })
      await fetchBanners()
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Cập nhật trạng thái thất bại')
    } finally {
      setToggling(null)
    }
  }

  function formatSchedule(banner: BannerResponse): string {
    if (!banner.start_at && !banner.end_at) return '—'
    const start = banner.start_at
      ? dayjs(banner.start_at).format('DD/MM/YY')
      : '∞'
    const end = banner.end_at ? dayjs(banner.end_at).format('DD/MM/YY') : '∞'
    return `${start} → ${end}`
  }

  function bannerTitle(banner: BannerResponse): string {
    return banner.title?.trim() || `Banner #${banner.id}`
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title">Banners</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
        >
          Thêm banner
        </Button>
      </div>

      {loading ? (
        <div className="banner-loading">Đang tải...</div>
      ) : banners.length === 0 ? (
        <div className="banner-empty">Chưa có banner nào</div>
      ) : (
        <div className="banner-grid">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className={`banner-card${banner.is_active ? ' banner-card--active' : ''}`}
            >
              <div className="banner-card__image">
                <img
                  src={banner.image_url}
                  alt={bannerTitle(banner)}
                  className="banner-card__img"
                />
              </div>
              <div className="banner-card__info">
                <h2 className="banner-card__title">{bannerTitle(banner)}</h2>
                <div className="banner-card__meta">
                  <span className="banner-card__order">
                    #{banner.sort_order}
                  </span>
                  {banner.is_active ? (
                    <Tag color="green">Đang hiển thị</Tag>
                  ) : (
                    <Tag color="default">Ẩn</Tag>
                  )}
                </div>
                {banner.link_url ? (
                  <a
                    href={banner.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="banner-card__link"
                  >
                    <LinkOutlined style={{ marginRight: 4 }} />
                    {banner.link_url}
                  </a>
                ) : (
                  <span className="banner-card__link banner-card__link--empty">
                    Chưa gắn đường dẫn
                  </span>
                )}
                <div className="banner-card__schedule">
                  {formatSchedule(banner)}
                </div>
              </div>
              <div className="banner-card__actions">
                <Switch
                  size="small"
                  checked={banner.is_active}
                  loading={toggling === banner.id}
                  onChange={() => handleToggleActive(banner)}
                  aria-label={`${banner.is_active ? 'Ẩn' : 'Hiển thị'} ${bannerTitle(banner)}`}
                />
                <Tooltip title="Sửa banner">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    aria-label={`Sửa ${bannerTitle(banner)}`}
                    onClick={() => openEdit(banner)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Xoá banner này?"
                  onConfirm={() => handleDelete(banner.id)}
                  okText="Xoá"
                  cancelText="Huỷ"
                  okButtonProps={{ danger: true }}
                >
                  <Tooltip title="Xoá banner">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`Xoá ${bannerTitle(banner)}`}
                      loading={deleting === banner.id}
                    />
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={mode === 'create' ? 'Thêm banner mới' : 'Sửa banner'}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        width={560}
        forceRender
        destroyOnHidden
      >
        <div className="banner-modal">
          {/* Image upload */}
          <div className="banner-upload-section">
            <p className="banner-upload-label">Ảnh banner</p>
            {imagePreview ? (
              <div className="banner-preview-wrap">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="banner-preview-img"
                />
                <Button
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                  style={{ marginTop: 8 }}
                >
                  Đổi ảnh
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="banner-upload"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <span>Đang tải lên...</span>
                ) : (
                  <>
                    <UploadOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                    <span>Nhấn để chọn ảnh</span>
                    <span className="banner-upload__hint">
                      JPEG, PNG, WebP — tối đa 2MB
                    </span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Form */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ title: '', sort_order: 0, is_active: true }}
          >
            <Form.Item
              label="Tiêu đề"
              name="title"
              rules={[
                { required: true, whitespace: true, message: 'Nhập tiêu đề banner' },
                { max: 120, message: 'Tiêu đề tối đa 120 ký tự' },
              ]}
            >
              <Input
                maxLength={120}
                showCount
                placeholder="Ví dụ: Tuần lễ đấu giá máy ảnh film"
              />
            </Form.Item>

            <Form.Item
              label="Link URL"
              name="link_url"
              rules={[
                { required: true, message: 'Nhập link URL' },
                { type: 'url', message: 'URL không hợp lệ' },
              ]}
            >
              <Input placeholder="https://..." />
            </Form.Item>

            <Form.Item label="Thứ tự hiển thị" name="sort_order">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Hiển thị" name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>

            <div className="banner-modal__schedule">
              <Form.Item label="Từ ngày" name="start_at" style={{ flex: 1 }}>
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: '100%' }}
                  placeholder="Không giới hạn"
                />
              </Form.Item>
              <Form.Item label="Đến ngày" name="end_at" style={{ flex: 1 }}>
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: '100%' }}
                  placeholder="Không giới hạn"
                />
              </Form.Item>
            </div>

            <div className="banner-modal__footer">
              <Button onClick={closeModal} disabled={submitting}>
                Huỷ
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
              >
                {mode === 'create' ? 'Thêm' : 'Lưu thay đổi'}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  )
}
