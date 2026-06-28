import { useState } from 'react'
import { App, Button, Form, Input, Modal, Select } from 'antd'
import { privatePost } from '@/api/api'
import type { ShipRequest } from '@/types/order'

interface ShipModalProps {
  orderId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CARRIERS = [
  'GHN',
  'GHTK',
  'J&T Express',
  'VNPost',
  'Viettel Post',
  'Khác',
]

interface ShipForm {
  tracking_number: string
  carrier: string
}

export function ShipModal({ orderId, open, onClose, onSuccess }: ShipModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<ShipForm>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(values: ShipForm) {
    setSubmitting(true)
    try {
      const body: ShipRequest = {
        tracking_number: values.tracking_number.trim(),
        carrier: values.carrier.trim(),
      }
      await privatePost(`/orders/${orderId}/ship`, body)
      message.success('Đã cập nhật đơn hàng sang trạng thái đang vận chuyển')
      form.resetFields()
      onSuccess()
    } catch {
      message.error('Không thể cập nhật trạng thái. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="Đánh dấu đã gửi hàng"
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label="Đơn vị vận chuyển"
          name="carrier"
          rules={[{ required: true, message: 'Vui lòng chọn đơn vị vận chuyển' }]}
        >
          <Select placeholder="Chọn đơn vị vận chuyển" style={{ fontFamily: 'var(--font-mono)' }}>
            {CARRIERS.map((c) => (
              <Select.Option key={c} value={c}>
                {c}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Mã vận đơn"
          name="tracking_number"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Vui lòng nhập mã vận đơn',
            },
            { min: 4, message: 'Mã vận đơn tối thiểu 4 ký tự' },
            { max: 100, message: 'Mã vận đơn không được vượt quá 100 ký tự' },
          ]}
        >
          <Input
            placeholder="VD: GHN123456789"
            style={{ fontFamily: 'var(--font-mono)' }}
            autoComplete="off"
            maxLength={100}
            showCount
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button onClick={handleCancel} disabled={submitting}>
            Huỷ
          </Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Xác nhận đã gửi
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
