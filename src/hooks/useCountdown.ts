import { useEffect, useMemo, useState } from 'react'

export interface CountdownResult {
  hours: number
  minutes: number
  seconds: number
  tenths: number
  totalSeconds: number
  totalMilliseconds: number
  isExpired: boolean
  isUrgent: boolean
  isWarning: boolean
  isServerSynced: boolean
}

function computeCountdown(endTime: string, serverOffsetMs: number): CountdownResult {
  const nowMs = Date.now() + serverOffsetMs
  const diffMs = Math.max(0, new Date(endTime).getTime() - nowMs)
  const wholeSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const seconds = wholeSeconds % 60
  const tenths = Math.floor((diffMs % 1000) / 100)

  return {
    hours,
    minutes,
    seconds,
    tenths,
    totalSeconds: wholeSeconds,
    totalMilliseconds: diffMs,
    isExpired: diffMs === 0,
    isUrgent: diffMs > 0 && diffMs < 60_000,
    isWarning: diffMs > 0 && diffMs < 300_000,
    isServerSynced: serverOffsetMs !== 0,
  }
}

function parseServerOffset(serverNow?: string | null): number {
  if (!serverNow) return 0
  const serverMs = new Date(serverNow).getTime()
  if (Number.isNaN(serverMs)) return 0
  return serverMs - Date.now()
}

export function useCountdown(endTime: string, serverNow?: string | null): CountdownResult {
  const serverOffsetMs = useMemo(() => parseServerOffset(serverNow), [serverNow])
  const [result, setResult] = useState<CountdownResult>(() =>
    computeCountdown(endTime, serverOffsetMs),
  )

  useEffect(() => {
    setResult(computeCountdown(endTime, serverOffsetMs))

    const id = setInterval(() => {
      const next = computeCountdown(endTime, serverOffsetMs)
      setResult(next)
      if (next.isExpired) {
        clearInterval(id)
      }
    }, 100)

    return () => clearInterval(id)
  }, [endTime, serverOffsetMs])

  return result
}
