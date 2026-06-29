import { useState } from 'react'
import { App, Button, InputNumber } from 'antd'
import { privatePost } from '@/api/api'
import type { OrderDispute, OrderPayment } from '@/types/order'

interface DisputeActionsProps {
  dispute: OrderDispute
  disputeId: string
  isBuyer: boolean
  isSeller: boolean
  payment?: OrderPayment | null
  onUpdate: () => void
}

interface RespondBody {
  action: 'reject' | 'accept_refund' | 'propose_partial'
  message: string
  refund_amount?: number
}

type ResponseOption = RespondBody['action']

const RESOLUTION_LABELS: Record<string, string> = {
  refund_buyer: 'Hoàn tiền cho Buyer',
  release_seller: 'Giải ngân cho Seller',
  partial_refund: 'Hoàn tiền một phần',
  pending: 'Đang xử lý',
}

const RESPONSE_OPTIONS: { value: ResponseOption; label: string }[] = [
  { value: 'accept_refund', label: 'Chấp nhận hoàn tiền 100%' },
  { value: 'propose_partial', label: 'Đề xuất hoàn tiền một phần' },
  { value: 'reject', label: 'Từ chối khiếu nại' },
]

function formatMoney(value: number): string {
  return value.toLocaleString('vi-VN') + ' ₫'
}

export function DisputeActions({ dispute, disputeId, isBuyer, isSeller, payment, onUpdate }: DisputeActionsProps) {
  const { message, modal } = App.useApp()
  const [respondText, setRespondText] = useState('')
  const [responseOption, setResponseOption] = useState<ResponseOption>('accept_refund')
  const [partialAmount, setPartialAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const { status, resolution } = dispute
  const partialProposalAmount = payment?.refund_amount ?? 0
  const partialSellerAmount = payment?.seller_amount ?? 0
  const hasPartialProposal = partialProposalAmount > 0 && partialSellerAmount > 0

  function buildMessage(): string {
    const note = respondText.trim()
    if (responseOption === 'accept_refund') {
      return note || 'Tôi chấp nhận hoàn tiền 100% cho buyer.'
    }
    if (responseOption === 'propose_partial') {
      return note || 'Tôi đề xuất hoàn tiền một phần.'
    }
    return note
  }

  async function handleSellerRespond() {
    const composed = buildMessage()
    if (!composed || composed.length < 1) {
      message.warning('Vui lòng nhập nội dung phản hồi.')
      return
    }
    if (composed.length > 2000) {
      message.warning('Phản hồi không được vượt quá 2000 ký tự.')
      return
    }
    if (responseOption === 'reject' && respondText.trim().length === 0) {
      message.warning('Vui lòng nhập lý do từ chối.')
      return
    }
    if (responseOption === 'propose_partial' && (!partialAmount || partialAmount <= 0)) {
      message.warning('Vui lòng nhập số tiền hoàn hợp lệ.')
      return
    }
    if (
      responseOption === 'propose_partial' &&
      payment?.amount &&
      partialAmount != null &&
      partialAmount >= payment.amount
    ) {
      message.warning('Số tiền hoàn một phần phải nhỏ hơn tổng giá trị đơn hàng.')
      return
    }
    setLoading(true)
    try {
      const body: RespondBody = {
        action: responseOption,
        message: composed,
        ...(responseOption === 'propose_partial' && partialAmount ? { refund_amount: partialAmount } : {}),
      }
      await privatePost(`/disputes/${disputeId}/respond`, body)
      message.success('Đã gửi phản hồi')
      setRespondText('')
      setPartialAmount(null)
      setResponseOption('accept_refund')
      onUpdate()
    } catch {
      message.error('Không thể gửi phản hồi. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function handleBuyerAccept() {
    const content = hasPartialProposal
      ? `Bạn đồng ý nhận ${formatMoney(partialProposalAmount)} và giải ngân ${formatMoney(partialSellerAmount)} cho Seller? Hành động này không thể hoàn tác.`
      : 'Bạn đồng ý với giải pháp mà Seller đề xuất? Hành động này không thể hoàn tác.'
    modal.confirm({
      title: 'Chấp nhận giải pháp của Seller',
      content,
      okText: 'Chấp nhận',
      cancelText: 'Chưa',
      onOk: async () => {
        setLoading(true)
        try {
          await privatePost(`/disputes/${disputeId}/accept`, {})
          message.success('Đã chấp nhận giải pháp')
          onUpdate()
        } catch {
          message.error('Không thể thực hiện. Vui lòng thử lại.')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  function handleBuyerEscalate() {
    modal.confirm({
      title: 'Leo thang lên Admin',
      content: 'Bạn muốn chuyển khiếu nại này lên Admin để xem xét? Hành động này không thể hoàn tác.',
      okText: 'Leo thang',
      okType: 'danger',
      cancelText: 'Chưa',
      onOk: async () => {
        setLoading(true)
        try {
          await privatePost(`/disputes/${disputeId}/escalate`, {})
          message.success('Đã chuyển lên Admin')
          onUpdate()
        } catch {
          message.error('Không thể thực hiện. Vui lòng thử lại.')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  if ((status === 'open' || status === 'awaiting_seller') && isSeller) {
    return (
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Gửi phản hồi cho Buyer
        </div>

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}
          role="radiogroup"
          aria-label="Loại phản hồi"
        >
          {RESPONSE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <input
                type="radio"
                name="dispute-response-option"
                value={opt.value}
                checked={responseOption === opt.value}
                disabled={loading}
                onChange={() => setResponseOption(opt.value)}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              {opt.label}
            </label>
          ))}
        </div>

        {responseOption === 'propose_partial' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
              Số tiền hoàn (₫)
              <InputNumber
                min={1}
                value={partialAmount}
                onChange={(val) => setPartialAmount(val)}
                disabled={loading}
                style={{ display: 'block', marginTop: 6, width: '100%', fontFamily: 'var(--font-mono)' }}
                formatter={(val) => val != null ? `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                parser={(val) => {
                  const parsed = Number((val ?? '').replace(/,/g, ''))
                  return isNaN(parsed) ? 0 : parsed
                }}
                placeholder="Nhập số tiền đề xuất hoàn"
              />
            </label>
            {partialAmount && payment?.amount && partialAmount > 0 && partialAmount < payment.amount && (
              <div
                style={{
                  marginTop: 8,
                  padding: '9px 12px',
                  border: '1px solid #d9ead3',
                  background: '#f6fbf4',
                  borderRadius: 3,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: '#245b2d',
                  lineHeight: 1.6,
                }}
              >
                Buyer nhận {formatMoney(partialAmount)} · Seller nhận {formatMoney(payment.amount - partialAmount)}
              </div>
            )}
          </div>
        )}

        {responseOption !== 'accept_refund' && (
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {responseOption === 'reject' ? 'Lý do từ chối *' : 'Ghi chú thêm (không bắt buộc)'}
            </div>
            <textarea
              rows={4}
              value={respondText}
              onChange={(e) => setRespondText(e.target.value)}
              placeholder={
                responseOption === 'reject'
                  ? 'Nhập lý do từ chối khiếu nại…'
                  : 'Nhập ghi chú thêm về đề xuất hoàn tiền…'
              }
              maxLength={2000}
              aria-label="Nội dung phản hồi"
              disabled={loading}
              style={{
                width: '100%',
                resize: 'vertical',
                padding: '10px 12px',
                border: '1.5px solid var(--color-border-strong)',
                borderRadius: 2,
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
              {respondText.trim().length} / 2000
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button
            type="primary"
            onClick={handleSellerRespond}
            loading={loading}
          >
            Gửi phản hồi
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'awaiting_buyer' && isBuyer) {
    return (
      <div style={{ marginTop: 16 }}>
        {hasPartialProposal && (
          <div
            style={{
              marginBottom: 12,
              padding: '12px 14px',
              background: '#f6fbf4',
              border: '1.5px solid #118c4f',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: '#245b2d',
              lineHeight: 1.6,
            }}
            role="status"
          >
            Seller đề xuất hoàn {formatMoney(partialProposalAmount)} cho Buyer và giải ngân {formatMoney(partialSellerAmount)} cho Seller.
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button
            type="primary"
            style={{ background: '#118c4f', borderColor: '#118c4f' }}
            onClick={handleBuyerAccept}
            loading={loading}
          >
            Chấp nhận giải pháp của Seller
          </Button>
          <Button
            danger
            onClick={handleBuyerEscalate}
            loading={loading}
          >
            Leo thang lên Admin
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'admin_review') {
    return (
      <div
        style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#e3f2fd',
          border: '1.5px solid var(--color-primary)',
          borderRadius: 3,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--color-primary)',
        }}
        role="status"
      >
        Đang chờ Admin xử lý. Chúng tôi sẽ thông báo khi có kết quả.
      </div>
    )
  }

  if (status === 'resolved' || status === 'closed') {
    const resolutionLabel = RESOLUTION_LABELS[resolution] ?? resolution
    const isClosed = status === 'closed'

    return (
      <div
        style={{
          marginTop: 16,
          padding: '14px 16px',
          background: '#e8f5e9',
          border: '1.5px solid #118c4f',
          borderRadius: 3,
        }}
        role="status"
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            color: '#118c4f',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 4,
          }}
        >
          {isClosed ? 'Khiếu nại đã đóng' : 'Khiếu nại đã giải quyết'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>
          {resolutionLabel}
        </div>
        {dispute.admin_notes && (
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 6 }}>
            {dispute.admin_notes}
          </div>
        )}
      </div>
    )
  }

  if ((status === 'open' || status === 'awaiting_seller') && isBuyer) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#fff8e1',
          border: '1.5px solid #cc6d00',
          borderRadius: 3,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: '#cc6d00',
        }}
        role="status"
      >
        Đang chờ Seller phản hồi. Chúng tôi sẽ thông báo khi có cập nhật.
      </div>
    )
  }

  return null
}
