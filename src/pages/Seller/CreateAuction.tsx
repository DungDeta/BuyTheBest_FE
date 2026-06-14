import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  App,
  Alert,
  Button,
  Collapse,
  DatePicker,
  Form,
  InputNumber,
  Select,
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import type { AuctionMode } from '@/types/auction'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './seller.css'

interface ProductListItem {
  id: number
  title: string
  slug: string
  condition: string
  status: 'draft' | 'pending_review' | 'approved' | 'rejected'
  category_id: number
  seller_id: number
  cover?: { id: number; url: string; sort_order: number; is_primary: boolean } | null
  created_at: string
}

interface ProductsResponse {
  items: ProductListItem[]
  total: number
  limit: number
  offset: number
}

interface AuctionFormValues {
  product_id: number
  category_id: number
  starting_price: number
  min_increment?: number
  buy_now_price?: number
  end_price?: number
  min_decrement?: number
  decrement_interval_seconds?: number
  reveal_at?: Dayjs
  budget_cap?: number
  starts_at: Dayjs
  ends_at: Dayjs
  max_extensions?: number
  anti_snipe_threshold_seconds?: number
  anti_snipe_extension_seconds?: number
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

const MODE_INFO: {
  value: AuctionMode
  label: string
  desc: string
}[] = [
  {
    value: 'english',
    label: 'Anh (tăng dần)',
    desc: 'Người trả cao nhất thắng. Giá tăng dần theo mỗi lượt đặt.',
  },
  {
    value: 'dutch',
    label: 'Hà Lan (giảm dần)',
    desc: 'Giá tự động giảm dần. Người đầu tiên chấp nhận giá thắng.',
  },
  {
    value: 'sealed_bid',
    label: 'Bịt kín',
    desc: 'Mỗi người đặt một lần. Công bố kết quả sau thời hạn.',
  },
  {
    value: 'reverse',
    label: 'Đảo ngược',
    desc: 'Người bán nhận đề xuất từ người mua, chọn giá phù hợp.',
  },
]

const VND_FORMATTER = (val: number | undefined) =>
  val === undefined ? '' : `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const VND_PARSER = (val: string | undefined) =>
  Number((val ?? '').replace(/,/g, ''))

export function Component() {
  useDocumentTitle('Tạo phiên đấu giá')
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedProductId = searchParams.get('product_id')
    ? Number(searchParams.get('product_id'))
    : undefined

  const [mode, setMode] = useState<AuctionMode>('english')
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [form] = Form.useForm<AuctionFormValues>()
  const hasApprovedProducts = products.length > 0

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingProducts(true)
      try {
        const res = await privateGet<ProductsResponse>('/me/products', {
          status: 'approved',
          limit: 100,
          offset: 0,
        })
        if (!cancelled) {
          setProducts(res.data?.items ?? [])
        }
      } catch {
        if (!cancelled) message.error('Không thể tải danh sách sản phẩm')
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [message])

  async function handleFinish(values: AuctionFormValues) {
    setSubmitting(true)
    try {
      type AuctionBody = {
        mode: AuctionMode
        product_id: number
        category_id: number
        starting_price: number
        starts_at: string
        ends_at: string
        min_increment?: number
        buy_now_price?: number
        end_price?: number
        min_decrement?: number
        decrement_interval_seconds?: number
        reveal_at?: string
        budget_cap?: number
        max_extensions?: number
        anti_snipe_threshold_seconds?: number
        anti_snipe_extension_seconds?: number
      }

      const body: AuctionBody = {
        mode,
        product_id: values.product_id,
        category_id: values.category_id,
        starting_price: mode === 'reverse' ? (values.budget_cap ?? 0) : values.starting_price,
        starts_at: values.starts_at.toISOString(),
        ends_at: values.ends_at.toISOString(),
      }

      if (mode === 'english') {
        if (values.min_increment) body.min_increment = values.min_increment
        if (values.buy_now_price) body.buy_now_price = values.buy_now_price
      }
      if (mode === 'dutch' || mode === 'reverse') {
        if (values.min_decrement) body.min_decrement = values.min_decrement
      }
      if (mode === 'dutch') {
        if (values.end_price) body.end_price = values.end_price
        if (values.decrement_interval_seconds)
          body.decrement_interval_seconds = values.decrement_interval_seconds
      }
      if (mode === 'sealed_bid' && values.reveal_at) {
        body.reveal_at = values.reveal_at.toISOString()
      }
      if (mode === 'reverse' && values.budget_cap) {
        body.budget_cap = values.budget_cap
      }
      if (values.max_extensions !== undefined)
        body.max_extensions = values.max_extensions
      if (values.anti_snipe_threshold_seconds !== undefined)
        body.anti_snipe_threshold_seconds = values.anti_snipe_threshold_seconds
      if (values.anti_snipe_extension_seconds !== undefined)
        body.anti_snipe_extension_seconds = values.anti_snipe_extension_seconds

      await privatePost('/auctions', body)
      message.success('Tạo phiên đấu giá thành công!')
      navigate('/my-auctions')
    } catch {
      message.error('Không thể tạo phiên đấu giá. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePreview() {
    form
      .validateFields()
      .then(() => setShowPreview(true))
      .catch(() => message.warning('Vui lòng điền đầy đủ thông tin bắt buộc'))
  }

  function renderPreview() {
    const vals = form.getFieldsValue()
    const productTitle = products.find((p) => p.id === vals.product_id)?.title ?? '—'
    const categoryName = CATEGORIES.find((c) => c.id === vals.category_id)?.name ?? '—'
    const modeLabel = MODE_INFO.find((m) => m.value === mode)?.label ?? mode

    const rows: { label: string; value: string }[] = [
      { label: 'Sản phẩm', value: productTitle },
      { label: 'Danh mục', value: categoryName },
      { label: 'Chế độ', value: modeLabel },
      {
        label: 'Giá khởi điểm',
        value: vals.starting_price
          ? `${VND_FORMATTER(vals.starting_price)} VND`
          : '—',
      },
      {
        label: 'Bắt đầu',
        value: vals.starts_at ? vals.starts_at.format('DD/MM/YYYY HH:mm') : '—',
      },
      {
        label: 'Kết thúc',
        value: vals.ends_at ? vals.ends_at.format('DD/MM/YYYY HH:mm') : '—',
      },
    ]

    if (mode === 'english' && vals.min_increment) {
      rows.push({ label: 'Bước tối thiểu', value: `${VND_FORMATTER(vals.min_increment)} VND` })
    }
    if (mode === 'english' && vals.buy_now_price) {
      rows.push({ label: 'Mua ngay', value: `${VND_FORMATTER(vals.buy_now_price)} VND` })
    }
    if (mode === 'dutch' && vals.end_price) {
      rows.push({ label: 'Giá kết thúc', value: `${VND_FORMATTER(vals.end_price)} VND` })
    }
    if ((mode === 'dutch' || mode === 'reverse') && vals.min_decrement) {
      rows.push({ label: 'Bước giảm', value: `${VND_FORMATTER(vals.min_decrement)} VND` })
    }
    if (mode === 'reverse' && vals.budget_cap) {
      rows.push({ label: 'Ngân sách tối đa', value: `${VND_FORMATTER(vals.budget_cap)} VND` })
    }
    if (mode === 'sealed_bid' && vals.reveal_at) {
      rows.push({ label: 'Công bố lúc', value: vals.reveal_at.format('DD/MM/YYYY HH:mm') })
    }

    return (
      <div className="auction-preview">
        {rows.map((r) => (
          <div className="auction-preview__row" key={r.label}>
            <span className="auction-preview__label">{r.label}</span>
            <span className="auction-preview__value">{r.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="seller-page">
      <div className="seller-page__header">
        <h1 className="seller-page__title">Tạo phiên đấu giá</h1>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        initialValues={{
          product_id: preselectedProductId,
          max_extensions: 10,
          anti_snipe_threshold_seconds: 120,
          anti_snipe_extension_seconds: 120,
        }}
        className="auction-form"
      >
        <div className="auction-form__section">
          <p className="auction-form__section-title">Sản phẩm</p>

          <Form.Item
            label="Sản phẩm đã duyệt"
            name="product_id"
            rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
          >
            <Select
              placeholder="Chọn sản phẩm"
              loading={loadingProducts}
              style={{ fontFamily: 'var(--font-mono)' }}
              options={products.map((p) => ({ value: p.id, label: p.title }))}
              notFoundContent="Chưa có sản phẩm nào được duyệt"
            />
          </Form.Item>
          {!loadingProducts && !hasApprovedProducts && (
            <Alert
              type="info"
              message="Chưa có sản phẩm đã duyệt"
              description="Bạn cần tạo sản phẩm và gửi duyệt trước khi mở phiên đấu giá."
              action={
                <Button size="small" onClick={() => navigate('/seller/products/new')}>
                  Tạo sản phẩm
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Danh mục đấu giá"
            name="category_id"
            rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
          >
            <Select
              placeholder="Chọn danh mục"
              style={{ fontFamily: 'var(--font-mono)' }}
              options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        </div>

        <div className="auction-form__section">
          <p className="auction-form__section-title">Chế độ đấu giá</p>
          <div className="mode-cards" role="radiogroup" aria-label="Chế độ đấu giá">
            {MODE_INFO.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`mode-card${mode === m.value ? ' mode-card--selected' : ''}`}
                onClick={() => setMode(m.value)}
                role="radio"
                aria-checked={mode === m.value}
              >
                <span className="mode-card__name">
                  <span className="mode-card__radio" aria-hidden="true" />
                  {m.label}
                </span>
                <span className="mode-card__desc">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="auction-form__section">
          <p className="auction-form__section-title">Giá & tham số</p>

          {mode !== 'reverse' && (
            <Form.Item
              label="Giá khởi điểm (VND)"
              name="starting_price"
              rules={[
                { required: true, message: 'Nhập giá khởi điểm' },
                {
                  validator(_, value: number | undefined) {
                    if (value === undefined || value > 0) return Promise.resolve()
                    return Promise.reject(new Error('Giá khởi điểm phải lớn hơn 0'))
                  },
                },
              ]}
            >
              <InputNumber
                min={1}
                formatter={VND_FORMATTER}
                parser={VND_PARSER}
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                placeholder="0"
              />
            </Form.Item>
          )}

          {mode === 'english' && (
            <>
              <Form.Item
                label="Bước đặt giá tối thiểu (VND)"
                name="min_increment"
                rules={[
                  { required: true, message: 'Nhập bước đặt giá tối thiểu' },
                  {
                    validator(_, value: number | undefined) {
                      if (value === undefined || value > 0) return Promise.resolve()
                      return Promise.reject(new Error('Bước đặt giá phải lớn hơn 0'))
                    },
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  formatter={VND_FORMATTER}
                  parser={VND_PARSER}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  placeholder="Tuỳ chọn"
                />
              </Form.Item>
              <Form.Item
                label="Giá mua ngay (VND)"
                name="buy_now_price"
                dependencies={['starting_price']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value: number | undefined) {
                      const start = getFieldValue('starting_price') as number | undefined
                      if (value === undefined || !start || value > start) return Promise.resolve()
                      return Promise.reject(new Error('Giá mua ngay phải lớn hơn giá khởi điểm'))
                    },
                  }),
                ]}
              >
                <InputNumber
                  min={1}
                  formatter={VND_FORMATTER}
                  parser={VND_PARSER}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  placeholder="Tuỳ chọn"
                />
              </Form.Item>
            </>
          )}

          {mode === 'dutch' && (
            <>
              <Form.Item
                label="Giá kết thúc (VND)"
                name="end_price"
                dependencies={['starting_price']}
                rules={[
                  { required: true, message: 'Nhập giá kết thúc' },
                  ({ getFieldValue }) => ({
                    validator(_, value: number | undefined) {
                      const start = getFieldValue('starting_price') as number | undefined
                      if (value === undefined || !start || (value > 0 && value < start)) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('Giá kết thúc phải nhỏ hơn giá khởi điểm'))
                    },
                  }),
                ]}
              >
                <InputNumber
                  min={1}
                  formatter={VND_FORMATTER}
                  parser={VND_PARSER}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </Form.Item>
              <Form.Item
                label="Bước giảm giá (VND)"
                name="min_decrement"
                rules={[
                  { required: true, message: 'Nhập bước giảm giá' },
                  {
                    validator(_, value: number | undefined) {
                      if (value === undefined || value > 0) return Promise.resolve()
                      return Promise.reject(new Error('Bước giảm giá phải lớn hơn 0'))
                    },
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  formatter={VND_FORMATTER}
                  parser={VND_PARSER}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </Form.Item>
              <Form.Item
                label="Chu kỳ giảm giá (giây)"
                name="decrement_interval_seconds"
                rules={[
                  { required: true, message: 'Nhập chu kỳ giảm giá' },
                  {
                    validator(_, value: number | undefined) {
                      if (value === undefined || value > 0) return Promise.resolve()
                      return Promise.reject(new Error('Chu kỳ giảm giá phải lớn hơn 0'))
                    },
                  },
                ]}
              >
                <InputNumber
                  min={10}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </Form.Item>
            </>
          )}

          {mode === 'sealed_bid' && (
            <Form.Item
              label="Thời điểm công bố kết quả"
              name="reveal_at"
              dependencies={['starts_at', 'ends_at']}
              rules={[
                { required: true, message: 'Chọn thời điểm công bố' },
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs | undefined) {
                    const start = getFieldValue('starts_at') as Dayjs | undefined
                    const end = getFieldValue('ends_at') as Dayjs | undefined
                    if (!value || !start || !end) return Promise.resolve()
                    if (!value.isBefore(start) && !value.isAfter(end)) return Promise.resolve()
                    return Promise.reject(new Error('Thời điểm công bố phải nằm trong thời gian phiên'))
                  },
                }),
              ]}
            >
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                disabledDate={(d) => d.isBefore(dayjs(), 'day')}
              />
            </Form.Item>
          )}

          {mode === 'reverse' && (
            <>
              <Form.Item
                label="Ngân sách tối đa (VND)"
                name="budget_cap"
                rules={[
                  { required: true, message: 'Nhập ngân sách tối đa' },
                  {
                    validator(_, value: number | undefined) {
                      if (value === undefined || value > 0) return Promise.resolve()
                      return Promise.reject(new Error('Ngân sách tối đa phải lớn hơn 0'))
                    },
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  formatter={VND_FORMATTER}
                  parser={VND_PARSER}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </Form.Item>
              <Form.Item
                label="Bước giảm tối thiểu (VND)"
                name="min_decrement"
                rules={[
                  { required: true, message: 'Nhập bước giảm' },
                  {
                    validator(_, value: number | undefined) {
                      if (value === undefined || value > 0) return Promise.resolve()
                      return Promise.reject(new Error('Bước giảm phải lớn hơn 0'))
                    },
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  formatter={VND_FORMATTER}
                  parser={VND_PARSER}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </Form.Item>
            </>
          )}
        </div>

        <div className="auction-form__section">
          <p className="auction-form__section-title">Lịch trình</p>

          <Form.Item
            label="Thời gian bắt đầu"
            name="starts_at"
            rules={[
              { required: true, message: 'Chọn thời gian bắt đầu' },
              {
                validator(_, value: Dayjs | undefined) {
                  if (!value || value.isAfter(dayjs())) return Promise.resolve()
                  return Promise.reject(new Error('Thời gian bắt đầu phải sau hiện tại'))
                },
              },
            ]}
          >
            <DatePicker
              showTime
              format="DD/MM/YYYY HH:mm"
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              disabledDate={(d) => d.isBefore(dayjs(), 'day')}
            />
          </Form.Item>

          <Form.Item
            label="Thời gian kết thúc"
            name="ends_at"
            dependencies={['starts_at']}
            rules={[
              { required: true, message: 'Chọn thời gian kết thúc' },
              ({ getFieldValue }) => ({
                validator(_, value: Dayjs | undefined) {
                  const start = getFieldValue('starts_at') as Dayjs | undefined
                  if (!value || !start || value.isAfter(start)) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Kết thúc phải sau bắt đầu'))
                },
              }),
            ]}
          >
            <DatePicker
              showTime
              format="DD/MM/YYYY HH:mm"
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              disabledDate={(d) => d.isBefore(dayjs(), 'day')}
            />
          </Form.Item>
        </div>

        <div className="auction-form__section">
          <Collapse
            ghost
            items={[
              {
                key: 'advanced',
                label: (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                    Cài đặt nâng cao (chống snipe)
                  </span>
                ),
                children: (
                  <>
                    <Form.Item label="Số lần gia hạn tối đa" name="max_extensions">
                      <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="Ngưỡng chống snipe (giây cuối)"
                      name="anti_snipe_threshold_seconds"
                    >
                      <InputNumber
                        min={10}
                        style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="Thời gian gia hạn mỗi lần (giây)"
                      name="anti_snipe_extension_seconds"
                    >
                      <InputNumber
                        min={10}
                        style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                      />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </div>

        {showPreview && (
          <div className="auction-form__section">
            <p className="auction-form__section-title">Xem trước</p>
            {renderPreview()}
          </div>
        )}

        <div className="auction-form__footer">
          <Button onClick={() => navigate('/seller/products')}>Huỷ</Button>
          {!showPreview && (
            <Button
              onClick={handlePreview}
              disabled={loadingProducts || !hasApprovedProducts}
            >
              Xem trước
            </Button>
          )}
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            disabled={loadingProducts || !hasApprovedProducts}
          >
            Tạo phiên đấu giá
          </Button>
        </div>
      </Form>
    </div>
  )
}
