import { useState } from 'react'
import { App } from 'antd'
import { useAutoBid } from '@/hooks/useAutoBid'

interface AutoBidSectionProps {
  auctionId: string
  minPrice: number
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

export function AutoBidSection({ auctionId, minPrice }: AutoBidSectionProps) {
  const { message } = App.useApp()
  const { autoBid, loading, error, configure, cancel, refresh } = useAutoBid(auctionId)

  const [expanded, setExpanded] = useState(false)
  const [maxPriceInput, setMaxPriceInput] = useState('')

  const isActive = autoBid !== null && autoBid.status === 'active'

  async function handleConfigure() {
    const parsed = parseInt(maxPriceInput.replace(/\D/g, ''), 10)
    if (isNaN(parsed) || parsed <= minPrice) {
      message.error(`Giá trần phải lớn hơn ${formatVnd(minPrice)}`)
      return
    }
    const ok = await configure(parsed)
    if (ok) {
      message.success('Auto-bid đã được kích hoạt')
      setMaxPriceInput('')
    }
  }

  async function handleCancel() {
    const confirmed = window.confirm('Hủy auto-bid hiện tại?')
    if (!confirmed) return

    const ok = await cancel()
    if (ok) {
      message.success('Auto-bid đã được huỷ')
      setExpanded(false)
    }
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
          aria-label="Bật auto-bid"
        />
        Auto-bid — hệ thống tự tăng đủ để dẫn đầu
      </label>

      {(expanded || isActive) && (
        <div className="auto-bid-section__body">
          {isActive && autoBid !== null ? (
            <>
              <div className="auto-bid-status" aria-label="Trạng thái auto-bid">
                <div className="auto-bid-status__row">
                  <span>Giá trần</span>
                  <strong>{formatVnd(autoBid.max_price)}</strong>
                </div>
                <div className="auto-bid-status__row">
                  <span>Bid hiện tại</span>
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
                aria-label="Huỷ auto-bid"
              >
                {loading ? 'Đang xử lý…' : 'Huỷ auto-bid'}
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
                  aria-label="Giá trần auto-bid"
                />
                <button
                  type="button"
                  className="bid-btn"
                  onClick={handleConfigure}
                  disabled={loading || maxPriceInput === ''}
                  aria-label="Kích hoạt auto-bid"
                >
                  {loading ? '…' : 'Kích hoạt'}
                </button>
              </div>
              <p className="auto-bid-hint">
                Hệ thống chỉ tăng đủ để vượt người khác, tối đa đến giá trần.
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
