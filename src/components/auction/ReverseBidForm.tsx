import { useEffect, useState } from 'react'
import { App } from 'antd'
import { privateGet } from '@/api/api'
import { useBid } from '@/hooks/useBid'
import type { Auction, BidActionResponse } from '@/types/auction'
import { getReadableProductTitle } from '@/utils/auctionDisplay'
import { getProductConditionLabel } from '@/utils/productDisplay'

interface ReverseBidFormProps {
  auction: Auction
  onBidPlaced?: (amount: number, data?: BidActionResponse) => void
}

interface SellerProduct {
  id: string
  title: string
  slug?: string
  condition?: string
  status: string
}

interface ProductsResponse {
  items: SellerProduct[]
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function productOptionLabel(product: SellerProduct): string {
  const title = getReadableProductTitle(product)
  const condition = getProductConditionLabel(product.condition, '')
  return condition ? `${title} (${condition})` : title
}

export function ReverseBidForm({ auction, onBidPlaced }: ReverseBidFormProps) {
  const { message } = App.useApp()
  const { placeBid, loading, error } = useBid(auction.id)

  const [bidInput, setBidInput] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const budget = auction.budget_cap ?? auction.starting_price
  const minDecrement = auction.min_decrement ?? 0
  const hasExistingBid = auction.bid_count > 0
  const currentBestPrice = hasExistingBid ? auction.current_price : null
  const maxAllowed = hasExistingBid
    ? Math.max(auction.current_price - minDecrement, 1)
    : budget
  const priceHint = hasExistingBid
    ? `Giá báo tối đa ${formatVnd(maxAllowed)}`
    : `Lượt đầu có thể báo tối đa ${formatVnd(maxAllowed)}`

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
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
        if (!cancelled) {
          message.error('Không thể tải danh sách sản phẩm của bạn')
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    }

    loadProducts()
    return () => {
      cancelled = true
    }
  }, [message])

  async function handleSubmit() {
    const parsed = parseInt(bidInput.replace(/\D/g, ''), 10)

    if (selectedProductId === '') {
      message.error('Vui lòng chọn sản phẩm để báo giá')
      return
    }
    if (isNaN(parsed) || parsed <= 0 || parsed > maxAllowed) {
      message.error(`Giá báo không được vượt quá ${formatVnd(maxAllowed)}`)
      return
    }

    const result = await placeBid(parsed, selectedProductId)
    if (result.ok && onBidPlaced) onBidPlaced(parsed, result.data)
  }

  return (
    <div className="bid-form">
      <div className="bid-current">
        <div className="bid-current__left">
          <span className="bid-current__label">Ngân sách người mua</span>
          <span className="bid-current__price">{formatVnd(budget)}</span>
          <span className="bid-current__delta">Người bán cạnh tranh bằng mức giá thấp</span>
        </div>
        <span className="mode-badge R" aria-label="Phương thức đấu giá ngược">Đấu giá ngược</span>
      </div>

      <div className="reverse-info" role="note">
        Người mua đặt yêu cầu và ngân sách. Người bán cạnh tranh bằng mức giá phù hợp nhất.
      </div>

      <div className="reverse-lowest" aria-label="Giá tốt nhất hiện tại">
        <span className="reverse-lowest__label">
          {currentBestPrice === null ? 'Chưa có báo giá' : 'Giá tốt nhất hiện tại'}
        </span>
        <span className="reverse-lowest__price">
          {currentBestPrice === null ? formatVnd(budget) : formatVnd(currentBestPrice)}
        </span>
      </div>

      <div>
        <div className="bid-input-row">
          <select
            className="reverse-product-select"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            disabled={loadingProducts}
            aria-label="Chọn sản phẩm để báo giá"
          >
            <option value="">
              {loadingProducts ? 'Đang tải sản phẩm…' : 'Chọn sản phẩm của bạn'}
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {productOptionLabel(product)}
              </option>
            ))}
          </select>
        </div>
        <p className="bid-input-hint">
          {products.length === 0 && !loadingProducts
            ? 'Bạn cần có sản phẩm đã duyệt để tham gia đấu giá ngược.'
            : 'Chọn sản phẩm bạn muốn dùng để gửi báo giá.'}
        </p>
      </div>

      <div>
        <div className="bid-input-row">
          <input
            type="text"
            inputMode="numeric"
            value={bidInput}
            onChange={(e) => setBidInput(e.target.value.replace(/\D/g, ''))}
            placeholder="Giá của bạn…"
            aria-label={`Nhập giá báo, tối đa ${formatVnd(maxAllowed)}`}
          />
          <button
            type="button"
            className="bid-btn bid-btn--reverse"
            onClick={handleSubmit}
            disabled={loading || loadingProducts || bidInput === '' || selectedProductId === ''}
            aria-label="Gửi báo giá"
          >
            {loading ? '…' : 'Gửi báo giá'}
          </button>
        </div>
        <p className="bid-input-hint">
          {priceHint}
          {hasExistingBid && minDecrement > 0
            ? ` · thấp hơn giá tốt nhất ít nhất ${formatVnd(minDecrement)}`
            : ''}
        </p>
      </div>

      {auction.bid_count > 0 && (
        <p className="bid-input-hint">{auction.bid_count} người bán đang cạnh tranh</p>
      )}

      {error !== null && (
        <div className="bid-error" role="alert">{error}</div>
      )}
    </div>
  )
}
