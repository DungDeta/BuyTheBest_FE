import { useState, useCallback, useRef } from 'react'
import { privateGet, privatePost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import type { Auction, BidActionResponse } from '@/types/auction'

export interface BidActionResult {
  ok: boolean
  data?: BidActionResponse
}

export interface UseBidResult {
  placeBid: (
    amount: number,
    productRef?: number | string,
    clientRequestId?: string,
  ) => Promise<BidActionResult>
  buyNow: () => Promise<BidActionResult>
  loading: boolean
  error: string | null
}

interface BuyNowApiResponse extends BidActionResponse {
  bid?: BidActionResponse | null
  auction?: Partial<Pick<Auction, 'order_id' | 'checkout_url' | 'payment_deadline'>> | null
  order?: {
    id?: number | string | null
    public_id?: number | string | null
    checkout_url?: string | null
    payment_url?: string | null
    payment_deadline?: string | null
  } | null
}

function normalizeBuyNowResponse(data: BuyNowApiResponse | undefined): BidActionResponse {
  const source = data ?? {}
  const { bid, auction, order, ...topLevel } = source
  return {
    ...(bid ?? {}),
    ...topLevel,
    order_id:
      source.order_id ??
      order?.public_id ??
      order?.id ??
      auction?.order_id,
    checkout_url:
      source.checkout_url ??
      order?.checkout_url ??
      auction?.checkout_url,
    payment_url: source.payment_url ?? order?.payment_url,
    payment_deadline:
      source.payment_deadline ??
      order?.payment_deadline ??
      auction?.payment_deadline,
    server_time: source.server_time ?? bid?.server_time,
  }
}

function hasCheckoutTarget(data: BidActionResponse): boolean {
  return Boolean(data.checkout_url || data.payment_url || data.order_id != null)
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
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
    async (amount: number, productRef?: number | string, clientRequestId?: string) => {
      setLoading(true)
      setError(null)
      try {
        const body: {
          amount: number
          product_id?: number
          product_public_id?: string
          client_request_id?: string
        } = { amount }
        if (typeof productRef === 'number') {
          body.product_id = productRef
        }
        if (typeof productRef === 'string' && productRef.trim() !== '') {
          body.product_public_id = productRef
        }
        if (clientRequestId) {
          body.client_request_id = clientRequestId
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
      const res = await privatePost<BuyNowApiResponse>(`/auctions/${auctionId}/buy-now`)
      let data = normalizeBuyNowResponse(res.data)

      // Older API responses only contain { bid, auction } and the auction object
      // returned by the write path may not yet be hydrated with its order public ID.
      // Read the authoritative viewer snapshot so Buy Now can still go straight to checkout.
      for (let attempt = 0; attempt < 3 && !hasCheckoutTarget(data); attempt += 1) {
        if (attempt > 0) await wait(250 * attempt)
        try {
          const snapshot = await privateGet<Auction>(`/auctions/${auctionId}`)
          data = {
            ...data,
            order_id: snapshot.data?.order_id ?? data.order_id,
            checkout_url: snapshot.data?.checkout_url ?? data.checkout_url,
            payment_deadline: snapshot.data?.payment_deadline ?? data.payment_deadline,
          }
        } catch {
          // The Buy Now operation already succeeded. Keep its response and use
          // the filtered order-list fallback instead of reporting a false failure.
        }
      }

      return { ok: true, data }
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
