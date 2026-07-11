import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  Spin,
  Tag,
} from 'antd'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { privateGet, privatePost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import type { Auction } from '@/types/auction'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getDemoProductImage } from '@/utils/demoProductImages'
import { getProductConditionLabel } from '@/utils/productDisplay'
import { getAuctionDisplayTitle } from '@/utils/auctionDisplay'
import { getReverseDemand, reverseOfferCount } from '@/utils/reverseAuction'
import './seller.css'

const STATUS_INFO: Record<
  Auction['status'],
  { label: string; color: string }
> = {
  scheduled: { label: 'Đã lên lịch', color: 'blue' },
  active: { label: 'Đang diễn ra', color: 'green' },
  ended: { label: 'Đã kết thúc', color: 'default' },
  closed_bin: { label: 'Đã mua ngay', color: 'purple' },
  cancelled: { label: 'Đã hủy', color: 'red' },
}

const MODE_LABELS: Record<Auction['mode'], string> = {
  english: 'Giá tăng dần',
  dutch: 'Giá giảm dần',
  sealed_bid: 'Đấu giá kín',
  reverse: 'Đấu giá ngược',
}

function formatVnd(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toLocaleString('vi-VN')} ₫`
}

function primaryImageUrl(auction: Auction): string | null {
  const images = auction.product?.images ?? []
  const primary = images.find((image) => image.is_primary) ?? images[0]
  return primary?.url || primary?.thumbnail_url || null
}

export function Component() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [auction, setAuction] = useState<Auction | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const title = auction ? getAuctionDisplayTitle(auction) : ''
  useDocumentTitle(title || 'Chi tiết phiên đấu giá')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setNotFound(false)
      try {
        const response = await privateGet<Auction>(`/me/auctions/${id}`)
        if (!cancelled) setAuction(response.data)
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  function confirmCancel() {
    if (!auction) return
    modal.confirm({
      title: 'Hủy phiên đấu giá?',
      content:
        'Phiên sẽ chuyển sang trạng thái Đã hủy và không thể khôi phục. Những người đang theo dõi sẽ nhận được thông báo.',
      okText: 'Xác nhận hủy',
      cancelText: 'Giữ phiên',
      okButtonProps: { danger: true },
      onOk: async () => {
        setCancelling(true)
        try {
          const response = await privatePost<Auction>(`/auctions/${auction.id}/cancel`)
          setAuction(response.data)
          message.success('Đã hủy phiên đấu giá')
        } catch (error) {
          const apiError = error as ErrorResponse
          message.error(apiError.error || 'Không thể hủy phiên đấu giá')
          throw error
        } finally {
          setCancelling(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="seller-auction-detail__loading" aria-label="Đang tải">
        <Spin size="large" />
      </div>
    )
  }

  if (notFound || !auction) {
    return (
      <div className="seller-page">
        <Alert
          type="error"
          showIcon
          message="Không tìm thấy phiên đấu giá"
          description="Phiên không tồn tại hoặc không thuộc tài khoản của bạn."
          action={<Button onClick={() => navigate('/my-auctions')}>Về Phiên của tôi</Button>}
        />
      </div>
    )
  }

  const status = STATUS_INFO[auction.status]
  const isReverse = auction.mode === 'reverse'
  const demand = getReverseDemand(auction)
  const imageUrl = primaryImageUrl(auction) || (isReverse ? null : getDemoProductImage(title))
  const canCancel =
    auction.viewer_can_cancel ??
    ((auction.status === 'scheduled' || auction.status === 'active') &&
      auction.bid_count === 0)
  const scheduleFacts = [
    { label: 'Hình thức', value: MODE_LABELS[auction.mode] },
    {
      label: isReverse ? 'Ngân sách tối đa' : 'Giá khởi điểm',
      value: formatVnd(isReverse ? (auction.budget_cap ?? auction.starting_price) : auction.starting_price),
    },
    { label: 'Bắt đầu', value: dayjs(auction.starts_at).format('DD/MM/YYYY HH:mm') },
    { label: 'Kết thúc', value: dayjs(auction.ends_at).format('DD/MM/YYYY HH:mm') },
    auction.min_increment != null
      ? { label: 'Bước giá tối thiểu', value: formatVnd(auction.min_increment) }
      : null,
    auction.buy_now_price != null
      ? { label: 'Giá mua ngay', value: formatVnd(auction.buy_now_price) }
      : null,
    auction.end_price != null
      ? { label: 'Giá kết thúc', value: formatVnd(auction.end_price) }
      : null,
    auction.min_decrement != null
      ? { label: 'Bước giảm', value: formatVnd(auction.min_decrement) }
      : null,
    auction.decrement_interval_seconds != null
      ? { label: 'Chu kỳ giảm', value: `${auction.decrement_interval_seconds} giây` }
      : null,
    !isReverse && auction.budget_cap != null
      ? { label: 'Ngân sách tối đa', value: formatVnd(auction.budget_cap) }
      : null,
    auction.reveal_at
      ? { label: 'Công bố kết quả', value: dayjs(auction.reveal_at).format('DD/MM/YYYY HH:mm') }
      : null,
    {
      label: 'Chống đặt giá phút cuối',
      value: `${auction.anti_snipe_threshold_seconds} giây cuối, gia hạn ${auction.anti_snipe_extension_seconds} giây`,
    },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact))

  return (
    <div
      className="seller-page seller-auction-detail"
      data-testid={isReverse ? 'reverse-owner-detail' : 'seller-auction-detail'}
    >
      <div className="seller-auction-detail__topbar">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/my-auctions')}
        >
          Phiên của tôi
        </Button>
        <Link to={`/auctions/${auction.id}`}>
          <Button icon={<EyeOutlined />}>Xem trang công khai</Button>
        </Link>
      </div>

      <header className="seller-auction-detail__header">
        <div>
          <div className="seller-auction-detail__eyebrow">
            <Tag color={status.color}>{status.label}</Tag>
            <span>{MODE_LABELS[auction.mode]}</span>
          </div>
          <h1 className="seller-page__title">{title}</h1>
          <p className="seller-auction-detail__id">Mã phiên: {auction.id}</p>
        </div>
        {canCancel && (
          <Button
            danger
            icon={<StopOutlined />}
            loading={cancelling}
            onClick={confirmCancel}
          >
            Hủy phiên
          </Button>
        )}
      </header>

      {auction.status === 'active' && auction.bid_count > 0 && (
        <Alert
          type="info"
          showIcon
          message="Phiên đã có lượt đặt giá nên không thể hủy"
          style={{ marginBottom: 20 }}
        />
      )}

      <div className="seller-auction-detail__layout">
        <section
          className="seller-auction-detail__product"
          aria-label={isReverse ? 'Nhu cầu mua' : 'Sản phẩm đấu giá'}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={title} />
          ) : (
            <div className="seller-auction-detail__image-placeholder">
              {isReverse ? 'NHU CẦU' : 'Không có ảnh'}
            </div>
          )}
          <div className="seller-auction-detail__product-copy">
            <span className="seller-auction-detail__section-label">
              {isReverse ? 'Nhu cầu' : 'Sản phẩm'}
            </span>
            <h2>{isReverse ? demand.title : title}</h2>
            {isReverse && demand.description && <p>{demand.description}</p>}
            {auction.product?.condition && (
              <div className="seller-auction-detail__product-fact">
                <span>Tình trạng</span>
                <strong>{getProductConditionLabel(auction.product.condition)}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="seller-auction-detail__stats" aria-label="Tổng quan phiên">
          <div>
            <span>
              {isReverse
                ? auction.bid_count > 0 ? 'Giá tốt nhất' : 'Ngân sách tối đa'
                : 'Giá hiện tại'}
            </span>
            <strong>{formatVnd(auction.current_price)}</strong>
          </div>
          <div>
            <span>{isReverse ? 'Báo giá' : 'Lượt đặt giá'}</span>
            <strong>{isReverse ? reverseOfferCount(auction) : auction.bid_count}</strong>
          </div>
          {isReverse && typeof auction.seller_count === 'number' && (
            <div>
              <span>Người bán</span>
              <strong>{auction.seller_count}</strong>
            </div>
          )}
          <div>
            <span>Gia hạn</span>
            <strong>{auction.extension_count}/{auction.max_extensions}</strong>
          </div>
        </section>
      </div>

      <section className="seller-auction-detail__section">
        <h2>Lịch trình và cấu hình</h2>
        <div className="seller-auction-detail__schedule-grid">
          {scheduleFacts.map((fact) => (
            <div key={fact.label} className="seller-auction-detail__schedule-item">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
