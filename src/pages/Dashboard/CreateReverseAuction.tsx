import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { privatePost, publicGet } from '@/api/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { ErrorResponse } from '@/types/api'
import type { Auction } from '@/types/auction'
import '@/pages/Seller/seller.css'

interface CategoryOption {
  id: number
  name: string
  slug: string
  sort_order?: number
}

interface HomeResponse {
  categories?: CategoryOption[]
}

interface ReverseDemandFormValues {
  title: string
  description: string
  category_id: number
  budget_cap: number
  min_decrement: number
  starts_at: Dayjs
  ends_at: Dayjs
  max_extensions: number
  anti_snipe_threshold_seconds: number
  anti_snipe_extension_seconds: number
}

const VND_FORMATTER = (value: number | undefined) =>
  value === undefined ? '' : `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const VND_PARSER = (value: string | undefined) =>
  Number((value ?? '').replace(/,/g, ''))

export function Component() {
  useDocumentTitle('Đăng nhu cầu mua')
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<ReverseDemandFormValues>()
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    publicGet<HomeResponse>('/home')
      .then((response) => {
        if (cancelled) return
        const next = (response.data?.categories ?? [])
          .filter((category) => Number.isFinite(category.id) && category.name.trim())
          .sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id))
        setCategories(next)
      })
      .catch(() => {
        if (!cancelled) message.error('Không thể tải danh mục sản phẩm')
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false)
      })

    return () => {
      cancelled = true
    }
  }, [message])

  async function handleFinish(values: ReverseDemandFormValues) {
    setSubmitting(true)
    try {
      const response = await privatePost<Auction>('/auctions', {
        mode: 'reverse',
        title: values.title.trim(),
        description: values.description.trim(),
        category_id: values.category_id,
        budget_cap: values.budget_cap,
        min_decrement: values.min_decrement,
        starts_at: values.starts_at.toISOString(),
        ends_at: values.ends_at.toISOString(),
        max_extensions: values.max_extensions,
        anti_snipe_threshold_seconds: values.anti_snipe_threshold_seconds,
        anti_snipe_extension_seconds: values.anti_snipe_extension_seconds,
      })
      message.success('Đã đăng nhu cầu đấu giá ngược')
      navigate(`/auctions/${response.data.id}`)
    } catch (error) {
      const apiError = error as ErrorResponse
      message.error(apiError.error || 'Không thể đăng nhu cầu. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="seller-page" data-testid="reverse-demand-create-page">
      <div className="seller-page__header">
        <div>
          <h1 className="seller-page__title">Đăng nhu cầu mua</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--color-muted)' }}>
            Người bán sẽ dùng sản phẩm đã được duyệt để cạnh tranh bằng mức giá thấp hơn.
          </p>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        message="Giá thấp nhất hợp lệ sẽ thắng khi phiên kết thúc"
        description="Hãy mô tả rõ yêu cầu và chọn đúng danh mục để người bán gửi sản phẩm phù hợp."
        style={{ marginBottom: 20 }}
      />

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="auction-form"
        data-testid="reverse-demand-form"
        onFinish={handleFinish}
        initialValues={{
          starts_at: dayjs().add(10, 'minute'),
          ends_at: dayjs().add(1, 'day'),
          max_extensions: 10,
          anti_snipe_threshold_seconds: 120,
          anti_snipe_extension_seconds: 120,
        }}
      >
        <div className="auction-form__section">
          <p className="auction-form__section-title">Nhu cầu</p>
          <Form.Item
            label="Tiêu đề nhu cầu"
            name="title"
            rules={[
              { required: true, message: 'Nhập tiêu đề nhu cầu' },
              { min: 5, message: 'Tiêu đề cần ít nhất 5 ký tự' },
              { max: 200, message: 'Tiêu đề tối đa 200 ký tự' },
            ]}
          >
            <Input
              maxLength={200}
              showCount
              placeholder="Ví dụ: Cần mua iPhone 15 Pro 256GB"
              data-testid="reverse-demand-title"
            />
          </Form.Item>

          <Form.Item
            label="Mô tả và yêu cầu"
            name="description"
            rules={[
              { required: true, message: 'Nhập mô tả nhu cầu' },
              { min: 20, message: 'Mô tả cần ít nhất 20 ký tự' },
              { max: 2000, message: 'Mô tả tối đa 2.000 ký tự' },
            ]}
          >
            <Input.TextArea
              rows={6}
              maxLength={2000}
              showCount
              placeholder="Nêu rõ cấu hình, tình trạng và các điều kiện bạn có thể chấp nhận"
              data-testid="reverse-demand-description"
            />
          </Form.Item>

          <Form.Item
            label="Danh mục"
            name="category_id"
            rules={[{ required: true, message: 'Chọn danh mục sản phẩm' }]}
          >
            <Select
              loading={loadingCategories}
              disabled={loadingCategories || categories.length === 0}
              placeholder="Chọn danh mục"
              notFoundContent={loadingCategories ? <Spin size="small" /> : 'Không có danh mục khả dụng'}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              data-testid="reverse-demand-category"
            />
          </Form.Item>
        </div>

        <div className="auction-form__section">
          <p className="auction-form__section-title">Ngân sách và bước giá</p>
          <Form.Item
            label="Ngân sách tối đa (VND)"
            name="budget_cap"
            rules={[
              { required: true, message: 'Nhập ngân sách tối đa' },
              {
                validator(_, value: number | undefined) {
                  return value && value > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error('Ngân sách phải lớn hơn 0'))
                },
              },
            ]}
          >
            <InputNumber
              min={1}
              formatter={VND_FORMATTER}
              parser={VND_PARSER}
              style={{ width: '100%' }}
              data-testid="reverse-demand-budget"
            />
          </Form.Item>

          <Form.Item
            label="Bước giảm tối thiểu (VND)"
            name="min_decrement"
            dependencies={['budget_cap']}
            rules={[
              { required: true, message: 'Nhập bước giảm tối thiểu' },
              ({ getFieldValue }) => ({
                validator(_, value: number | undefined) {
                  const budget = getFieldValue('budget_cap') as number | undefined
                  if (value && value > 0 && (!budget || value < budget)) return Promise.resolve()
                  return Promise.reject(new Error('Bước giảm phải lớn hơn 0 và nhỏ hơn ngân sách'))
                },
              }),
            ]}
          >
            <InputNumber
              min={1}
              formatter={VND_FORMATTER}
              parser={VND_PARSER}
              style={{ width: '100%' }}
              data-testid="reverse-demand-decrement"
            />
          </Form.Item>
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
                  return !value || value.isAfter(dayjs())
                    ? Promise.resolve()
                    : Promise.reject(new Error('Thời gian bắt đầu phải sau hiện tại'))
                },
              },
            ]}
          >
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
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
                  return !value || !start || value.isAfter(start)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Thời gian kết thúc phải sau thời gian bắt đầu'))
                },
              }),
            ]}
          >
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div className="auction-form__section">
          <p className="auction-form__section-title">Chống đặt giá phút cuối</p>
          <Form.Item label="Số lần gia hạn tối đa" name="max_extensions">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Ngưỡng kích hoạt (giây cuối)" name="anti_snipe_threshold_seconds">
            <InputNumber min={1} max={3600} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Thời gian gia hạn (giây)" name="anti_snipe_extension_seconds">
            <InputNumber min={1} max={3600} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div className="auction-form__footer">
          <Button onClick={() => navigate('/my-auctions')}>Hủy</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            disabled={loadingCategories || categories.length === 0}
            data-testid="reverse-demand-submit"
          >
            Đăng nhu cầu
          </Button>
        </div>
      </Form>
    </div>
  )
}
