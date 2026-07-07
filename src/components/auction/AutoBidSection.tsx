import { useState } from 'react'
import { App } from 'antd'
import { useAutoBid } from '@/hooks/useAutoBid'

interface AutoBidSectionProps {
  auctionId: string
  minPrice: number
  minIncrement: number
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

export function AutoBidSection({ auctionId, minPrice, minIncrement }: AutoBidSectionProps) {
  const { message, modal } = App.useApp()
  const { autoBid, loading, error, configure, cancel, refresh } = useAutoBid(auctionId)

  const [expanded, setExpanded] = useState(false)
  const [maxPriceInput, setMaxPriceInput] = useState('')

  const isActive = autoBid !== null && autoBid.status === 'active'

  async function handleConfigure() {
    const parsed = parseInt(maxPriceInput.replace(/\D/g, ''), 10)
    if (isNaN(parsed) || parsed < minPrice) {
      message.error(`Giá trần phải từ ${formatVnd(minPrice)}`)
      return
    }
    const ok = await configure(parsed)
    if (ok) {
      message.success('Đặt giá tự động đã được kích hoạt')
      setMaxPriceInput('')
    }
  }

  function handleCancel() {
    modal.confirm({
      title: 'Hủy đặt giá tự động?',
      content: 'Hệ thống sẽ dừng đặt giá thay bạn trong phiên đấu giá này.',
      okText: 'Hủy đặt giá tự động',
      cancelText: 'Giữ lại',
      okButtonProps: { danger: true },
      onOk: async () => {
        const ok = await cancel()
        if (!ok) {
          throw new Error('AUTO_BID_CANCEL_FAILED')
        }
        message.success('Đặt giá tự động đã được hủy')
        setExpanded(false)
      },
    })
  }

  function handleToggle() {
    if (!expanded) {
      refresh()
    }
    setExpanded((prev) => !prev)
  }

  return (
    <div className="auto-bid-section">
      <label className="auto-bid-section__toggle">
        <input
          type="checkbox"
          checked={expanded || isActive}
          onChange={handleToggle}
          aria-label="Bật đặt giá tự động"
        />
        Đặt giá tự động, hệ thống tăng vừa đủ để dẫn đầu
      </label>

      {(expanded || isActive) && (
        <div className="auto-bid-section__body">
          {isActive && autoBid !== null ? (
            <>
              <div className="auto-bid-status" aria-label="Trạng thái đặt giá tự động">
                <div className="auto-bid-status__row">
                  <span>Giá trần</span>
                  <strong>{formatVnd(autoBid.max_price)}</strong>
                </div>
                <div className="auto-bid-status__row">
                  <span>Giá đang đặt</span>
                  <strong>{formatVnd(autoBid.current_bid_amount)}</strong>
                </div>
                {autoBid.trigger_count !== null && (
                  <div className="auto-bid-status__row">
                    <span>Số lần kích hoạt</span>
                    <strong>{autoBid.trigger_count}</strong>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="bid-btn bid-btn--cancel"
                onClick={handleCancel}
                disabled={loading}
                aria-label="Hủy đặt giá tự động"
              >
                {loading ? 'Đang xử lý…' : 'Hủy đặt giá tự động'}
              </button>
            </>
          ) : (
            <>
              <div className="bid-input-row">
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  placeholder="Giá trần tối đa…"
                  aria-label="Giá trần đặt giá tự động"
                />
                <button
                  type="button"
                  className="bid-btn"
                  onClick={handleConfigure}
                  disabled={loading || maxPriceInput === ''}
                  aria-label="Kích hoạt đặt giá tự động"
                >
                  {loading ? '…' : 'Kích hoạt'}
                </button>
              </div>
              <p className="auto-bid-hint">
                Bước giá của phiên là {formatVnd(minIncrement)}. Hệ thống chỉ tăng vừa đủ
                để vượt người khác, tối đa đến giá trần.
              </p>
            </>
          )}

          {error !== null && (
            <div className="bid-error" role="alert">{error}</div>
          )}
        </div>
      )}
    </div>
  )
}
