import { useState, useCallback } from 'react'
import { privateGet, privatePost, privateDelete } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import type { AutoBid } from '@/types/auction'

export interface UseAutoBidResult {
  autoBid: AutoBid | null
  loading: boolean
  error: string | null
  configure: (maxPrice: number) => Promise<boolean>
  cancel: () => Promise<boolean>
  refresh: () => Promise<void>
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

function isNotFound(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as ErrorResponse).code === 404
  )
}

export function useAutoBid(auctionId: string): UseAutoBidResult {
  const [autoBid, setAutoBid] = useState<AutoBid | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await privateGet<AutoBid>(`/auctions/${auctionId}/auto-bid`)
      setAutoBid(res.data)
    } catch (err: unknown) {
      if (isNotFound(err)) {
        setAutoBid(null)
        return
      }
      setError(extractErrorMessage(err))
      setAutoBid(null)
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  const configure = useCallback(
    async (maxPrice: number) => {
      setLoading(true)
      setError(null)
      try {
        const res = await privatePost<AutoBid>(`/auctions/${auctionId}/auto-bid`, {
          max_price: maxPrice,
        })
        setAutoBid(res.data)
        return true
      } catch (err: unknown) {
        setError(extractErrorMessage(err))
        return false
      } finally {
        setLoading(false)
      }
    },
    [auctionId],
  )

  const cancel = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await privateDelete(`/auctions/${auctionId}/auto-bid`)
      setAutoBid(null)
      return true
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
      return false
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  return { autoBid, loading, error, configure, cancel, refresh }
}
