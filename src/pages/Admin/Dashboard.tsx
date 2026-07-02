import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, DatePicker, Skeleton } from 'antd'
import {
  AppstoreOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { privateGet } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './admin.css'

interface DashboardKPI {
  active_auctions: number
  today_gmv: number
  weekly_gmv: number
  active_users: number
  active_buyers: number
  active_sellers: number
  pending_disputes: number
}

const { RangePicker } = DatePicker

const REFRESH_INTERVAL_MS = 60_000

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatCount(n: number): string {
  return n.toLocaleString('vi-VN')
}

export function Component() {
  useDocumentTitle('Quản trị · Tổng quan')
  const { message } = App.useApp()
  const navigate = useNavigate()

  const [kpi, setKpi] = useState<DashboardKPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('day'),
    dayjs(),
  ])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchKPI = useCallback(
    async (range: [Dayjs, Dayjs]) => {
      setLoading(true)
      try {
        const res = await privateGet<DashboardKPI>('/admin/dashboard', {
          from: range[0].toISOString(),
          to: range[1].toISOString(),
        })
        setKpi(res.data)
      } catch (err) {
        const e = err as ErrorResponse
        message.error(e?.error ?? 'Không tải được dữ liệu dashboard')
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    fetchKPI(dateRange)
  }, [dateRange, fetchKPI])

  // Auto-refresh every 60 s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      fetchKPI(dateRange)
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [dateRange, fetchKPI])

  function handleRangeChange(
    values: [Dayjs | null, Dayjs | null] | null,
  ) {
    if (values && values[0] && values[1]) {
      setDateRange([values[0], values[1]])
    }
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Dashboard</h1>

      <div className="date-range">
        <span className="date-range__label">Khoảng thời gian:</span>
        <RangePicker
          value={dateRange}
          onChange={handleRangeChange}
          showTime
          format="DD/MM/YYYY HH:mm"
          allowClear={false}
        />
      </div>

      {loading && !kpi ? (
        <div className="kpi-grid">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="kpi-card">
              <Skeleton.Input active size="large" style={{ width: '100%' }} />
              <Skeleton.Input active size="small" style={{ width: 80 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="kpi-grid">
          <KpiCard
            label="Phiên đang diễn ra"
            value={formatCount(kpi?.active_auctions ?? 0)}
          />
          <KpiCard
            label="Tổng giá trị giao dịch hôm nay"
            value={formatVND(kpi?.today_gmv ?? 0)}
          />
          <KpiCard
            label="Tổng giá trị giao dịch tuần này"
            value={formatVND(kpi?.weekly_gmv ?? 0)}
          />
          <KpiCard
            label="Người dùng hoạt động"
            value={formatCount(kpi?.active_users ?? 0)}
          />
          <KpiCard
            label="Người mua hoạt động"
            value={formatCount(kpi?.active_buyers ?? 0)}
          />
          <KpiCard
            label="Người bán hoạt động"
            value={formatCount(kpi?.active_sellers ?? 0)}
          />
          <KpiCard
            label="Tranh chấp chờ xử lý"
            value={formatCount(kpi?.pending_disputes ?? 0)}
            alert={(kpi?.pending_disputes ?? 0) > 0}
          />
        </div>
      )}

      <div>
        <p className="quick-links__title">Truy cập nhanh</p>
        <div className="quick-links">
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/admin/products')}
          >
            Duyệt sản phẩm
          </Button>
          <Button
            icon={<WarningOutlined />}
            onClick={() => navigate('/admin/disputes')}
            danger={(kpi?.pending_disputes ?? 0) > 0}
          >
            Tranh chấp
            {(kpi?.pending_disputes ?? 0) > 0
              ? ` (${kpi!.pending_disputes})`
              : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string
  alert?: boolean
}

function KpiCard({ label, value, alert = false }: KpiCardProps) {
  return (
    <div className={`kpi-card${alert ? ' kpi-card--alert' : ''}`}>
      <span className="kpi-card__value">{value}</span>
      <span className="kpi-card__label">{label}</span>
    </div>
  )
}
