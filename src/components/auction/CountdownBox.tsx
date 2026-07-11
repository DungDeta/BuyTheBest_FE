import { useCountdown } from '@/hooks/useCountdown'
import dayjs from 'dayjs'

interface CountdownBoxProps {
  endsAt: string
  startsAt?: string
  serverNow?: string | null
  antiSnipeSeconds: number
  extensionCount: number
  maxExtensions: number
  ended?: boolean
  scheduled?: boolean
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function CountdownBox({
  endsAt,
  startsAt,
  serverNow,
  antiSnipeSeconds,
  extensionCount,
  maxExtensions,
  ended = false,
  scheduled = false,
}: CountdownBoxProps) {
  const waitingForStart = scheduled && !ended
  const targetAt = waitingForStart && startsAt ? startsAt : endsAt
  const {
    hours,
    minutes,
    seconds,
    tenths,
    isExpired,
    isUrgent,
    isWarning,
    isServerSynced,
  } = useCountdown(targetAt, serverNow)
  const hasEnded = ended || (!waitingForStart && isExpired)

  let boxClass = 'countdown-box'
  if (hasEnded) boxClass += ' countdown-box--ended'
  else if (isUrgent) boxClass += ' countdown-box--urgent'
  else if (isWarning) boxClass += ' countdown-box--warning'

  const targetLabel = dayjs(targetAt).format('DD/MM/YYYY HH:mm:ss')
  const timerDisplay = hasEnded
    ? 'Đã kết thúc'
    : waitingForStart && isExpired
      ? 'Đang bắt đầu…'
    : isUrgent
      ? `${pad(minutes)}:${pad(seconds)}.${tenths}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`

  return (
    <div
      className={boxClass}
      role="timer"
      aria-live="polite"
      aria-label={hasEnded ? 'Phiên đã kết thúc' : waitingForStart ? 'Đếm ngược đến khi bắt đầu' : 'Đồng hồ đếm ngược'}
    >
      <div className="countdown-box__label">
        {hasEnded
          ? `Phiên kết thúc lúc ${targetLabel}`
          : waitingForStart
            ? `Bắt đầu lúc ${targetLabel}`
            : `Còn lại · kết thúc lúc ${targetLabel}`}
      </div>
      <div className="countdown-box__timer">{timerDisplay}</div>
      {!hasEnded && !waitingForStart && (
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
