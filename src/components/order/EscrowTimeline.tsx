import type { OrderStatus } from '@/types/order'

interface EscrowTimelineProps {
  status: OrderStatus
}

type StepState = 'done' | 'active' | 'default'

interface Step {
  label: string
  getState: (status: OrderStatus) => StepState
}

const STEPS: Step[] = [
  {
    label: 'Thắng phiên',
    getState: () => 'done',
  },
  {
    label: 'Thanh toán',
    getState: (s) => {
      if (s === 'pending_payment') return 'active'
      if (s === 'cancelled') return 'default'
      return 'done'
    },
  },
  {
    label: 'Seller giao',
    getState: (s) => {
      if (s === 'paid') return 'active'
      if (s === 'shipped' || s === 'delivered' || s === 'completed') return 'done'
      return 'default'
    },
  },
  {
    label: 'Xác nhận',
    getState: (s) => {
      if (s === 'shipped') return 'active'
      if (s === 'delivered' || s === 'completed') return 'done'
      return 'default'
    },
  },
  {
    label: 'Hoàn tất',
    getState: (s) => {
      if (s === 'delivered') return 'active'
      if (s === 'completed') return 'done'
      return 'default'
    },
  },
]

export function EscrowTimeline({ status }: EscrowTimelineProps) {
  return (
    <div className="escrow-timeline" role="list" aria-label="Trạng thái đơn hàng">
      {STEPS.map((step, idx) => {
        const state = step.getState(status)
        const className = [
          'escrow-step',
          state === 'done' ? 'escrow-step--done' : '',
          state === 'active' ? 'escrow-step--active' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }} role="listitem">
            <span className={className}>
              {state === 'done' && <span aria-hidden="true">✓ </span>}
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <span className="escrow-step__arrow" aria-hidden="true">→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
