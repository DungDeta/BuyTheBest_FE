import { useState } from 'react'
import { App, Button, Select } from 'antd'
import { privatePost } from '@/api/api'
import type { DisputeReason, OpenDisputeRequest } from '@/types/order'

interface OpenDisputeFormProps {
  orderId: string
  onSuccess: () => void
}

interface ReasonOption {
  value: DisputeReason
  label: string
}

const REASON_OPTIONS: ReasonOption[] = [
  { value: 'item_not_received', label: 'Chưa nhận được hàng' },
  { value: 'item_damaged', label: 'Hàng bị hư hỏng' },
  { value: 'item_not_as_described', label: 'Hàng không đúng mô tả' },
  { value: 'fake_item', label: 'Hàng giả / nhái' },
  { value: 'other', label: 'Lý do khác' },
]

const MIN_DESC = 50
const MAX_DESC = 2000

export function OpenDisputeForm({ orderId, onSuccess }: OpenDisputeFormProps) {
  const { message, modal } = App.useApp()
  const [reason, setReason] = useState<DisputeReason | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const descLen = description.length
  const descValid = descLen >= MIN_DESC && descLen <= MAX_DESC
  const canSubmit = reason !== null && descValid

  function handleSubmit() {
    if (!canSubmit || !reason) return

    modal.confirm({
      title: 'Xác nhận mở khiếu nại',
      content: 'Sau khi mở khiếu nại, đơn hàng sẽ bị tạm dừng cho đến khi được giải quyết. Bạn chắc chắn muốn tiếp tục?',
      okText: 'Mở khiếu nại',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        setSubmitting(true)
        try {
          const body: OpenDisputeRequest = { reason, description: description.trim() }
          await privatePost(`/orders/${orderId}/dispute`, body)
          message.success('Đã mở khiếu nại thành công')
          onSuccess()
        } catch {
          message.error('Không thể mở khiếu nại. Vui lòng thử lại.')
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  return (
    <div
      id="open-dispute-form"
      className="detail-section"
      style={{ border: '2px dashed #cc6d00', background: '#fff8e1' }}
    >
      <div
        className="detail-section__title"
        style={{ fontFamily: 'var(--font-mono)', color: '#cc6d00' }}
      >
        Mở khiếu nại
      </div>

      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="dispute-reason"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Lý do khiếu nại
        </label>
        <Select<DisputeReason>
          id="dispute-reason"
          placeholder="Chọn lý do"
          style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
          value={reason ?? undefined}
          onChange={(v) => setReason(v)}
          disabled={submitting}
          options={REASON_OPTIONS}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="dispute-desc"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Mô tả chi tiết
        </label>
        <textarea
          id="dispute-desc"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`Mô tả vấn đề của bạn (tối thiểu ${MIN_DESC} ký tự)…`}
          maxLength={MAX_DESC}
          disabled={submitting}
          aria-describedby="dispute-desc-hint"
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '10px 12px',
            border: `1.5px solid ${descLen > 0 && !descValid ? '#c7302b' : 'var(--color-border-strong)'}`,
            borderRadius: 2,
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        <div
          id="dispute-desc-hint"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            marginTop: 4,
          }}
        >
          <span style={{ color: descLen > 0 && !descValid ? '#c7302b' : 'var(--color-muted)' }}>
            {descLen < MIN_DESC
              ? `Cần thêm ${MIN_DESC - descLen} ký tự nữa`
              : descLen > MAX_DESC
                ? `Vượt quá ${descLen - MAX_DESC} ký tự`
                : 'Độ dài hợp lệ'}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>{descLen} / {MAX_DESC}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          danger
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        >
          Mở khiếu nại
        </Button>
      </div>
    </div>
  )
}
