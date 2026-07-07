import { useCountdown } from '@/hooks/useCountdown'
import dayjs from 'dayjs'

interface CountdownBoxProps {
  endsAt: string
  serverNow?: string | null
  antiSnipeSeconds: number
  extensionCount: number
  maxExtensions: number
  ended?: boolean
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function CountdownBox({
  endsAt,
  serverNow,
  antiSnipeSeconds,
  extensionCount,
  maxExtensions,
  ended = false,
}: CountdownBoxProps) {
  const {
    hours,
    minutes,
    seconds,
    tenths,
    isExpired,
    isUrgent,
    isWarning,
    isServerSynced,
  } = useCountdown(endsAt, serverNow)
  const hasEnded = ended || isExpired

  let boxClass = 'countdown-box'
  if (hasEnded) boxClass += ' countdown-box--ended'
  else if (isUrgent) boxClass += ' countdown-box--urgent'
  else if (isWarning) boxClass += ' countdown-box--warning'

  const endLabel = dayjs(endsAt).format('DD/MM/YYYY HH:mm:ss')
  const timerDisplay = hasEnded
    ? 'Đã kết thúc'
    : isUrgent
      ? `${pad(minutes)}:${pad(seconds)}.${tenths}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`

  return (
    <div
      className={boxClass}
      role="timer"
      aria-live="polite"
      aria-label={hasEnded ? 'Phiên đã kết thúc' : 'Đồng hồ đếm ngược'}
    >
      <div className="countdown-box__label">
        {hasEnded ? `Phiên kết thúc lúc ${endLabel}` : `Còn lại · kết thúc lúc ${endLabel}`}
      </div>
      <div className="countdown-box__timer">{timerDisplay}</div>
      {!hasEnded && (
        <div className="countdown-box__snipe">
          Đặt giá trong {antiSnipeSeconds}s cuối sẽ gia hạn tự động
        </div>
      )}
      {isServerSynced && (
        <div className="countdown-box__sync">Đồng bộ theo giờ server</div>
      )}
      {extensionCount > 0 && (
        <div className="countdown-box__ext">
          Đã gia hạn {extensionCount}/{maxExtensions} lần
        </div>
      )}
    </div>
  )
}
