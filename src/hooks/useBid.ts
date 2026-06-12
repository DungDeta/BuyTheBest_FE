import { useState, useCallback, useRef } from 'react'
import { privatePost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import type { BidActionResponse } from '@/types/auction'

export interface BidActionResult {
  ok: boolean
  data?: BidActionResponse
}

export interface UseBidResult {
  placeBid: (amount: number, productId?: number) => Promise<BidActionResult>
  buyNow: () => Promise<BidActionResult>
  loading: boolean
  error: string | null
}

function extractErrorMessage(err: unknown): string {
  if (
    err !== null &&
    typeof err === 'object' &&
    'error' in err &&
    typeof (err as ErrorResponse).error === 'string'
  ) {
    return (err as ErrorResponse).error
  }
  return 'Đã xảy ra lỗi không xác định'
}

export function useBid(auctionId: string): UseBidResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleErrorClear() {
    if (clearTimerRef.current !== null) {
      clearTimeout(clearTimerRef.current)
    }
    clearTimerRef.current = setTimeout(() => {
      setError(null)
      clearTimerRef.current = null
    }, 5000)
  }

  const placeBid = useCallback(
    async (amount: number, productId?: number) => {
      setLoading(true)
      setError(null)
      try {
        const body: { amount: number; product_id?: number } = { amount }
        if (productId !== undefined) {
          body.product_id = productId
        }
        const res = await privatePost<BidActionResponse>(`/auctions/${auctionId}/bids`, body)
        return { ok: true, data: res.data }
      } catch (err: unknown) {
        const msg = extractErrorMessage(err)
        setError(msg)
        scheduleErrorClear()
        return { ok: false }
      } finally {
        setLoading(false)
      }
    },
    [auctionId],
  )

  const buyNow = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await privatePost<BidActionResponse>(`/auctions/${auctionId}/buy-now`)
      return { ok: true, data: res.data }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      setError(msg)
      scheduleErrorClear()
      return { ok: false }
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  return { placeBid, buyNow, loading, error }
}
