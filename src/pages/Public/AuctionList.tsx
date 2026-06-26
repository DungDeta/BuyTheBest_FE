import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
import { publicGet } from '@/api/api'
import type { PageResponse } from '@/types/api'
import './home.css'
import './auction-list.css'

interface AuctionItem {
  id: string
  category_id: number
  mode: 'english' | 'dutch' | 'sealed_bid' | 'reverse'
  status: string
  starting_price: number
  current_price: number
  bid_count: number
  starts_at: string
  ends_at: string
  title?: string
  product?: {
    title: string
    slug: string
    images?: ProductImage[]
  }
}

interface ProductImage {
  url?: string
  thumbnail_url?: string
  is_primary?: boolean
  sort_order?: number
}

interface CategoryOption {
  id: number
  name: string
  slug: string
}

interface HomeData {
  categories: CategoryOption[]
}

type SortValue    = 'ending_soon' | 'newest'
type ViewMode     = 'grid' | 'list'
type AuctionMode  = 'E' | 'D' | 'S' | 'R'
type StatusFilter = 'live' | 'ending' | 'scheduled'

const FALLBACK_CATEGORIES: CategoryOption[] = [
  { id: 1, name: 'Điện tử',  slug: 'dien-tu' },
  { id: 2, name: 'Đồng hồ',  slug: 'dong-ho' },
  { id: 3, name: 'Xe cộ',    slug: 'xe-co' },
  { id: 4, name: 'Sneakers', slug: 'sneakers' },
  { id: 5, name: 'Sưu tầm',  slug: 'suu-tam' },
  { id: 6, name: 'Gaming',   slug: 'gaming' },
]

const MODE_LABELS: Record<AuctionMode, string> = {
  E: 'English',
  D: 'Dutch',
  S: 'Sealed',
  R: 'Reverse',
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  live:      'Đang chạy',
  ending:    'Sắp kết thúc',
  scheduled: 'Sắp diễn ra',
}

const EMPTY_MODE_COUNTS: Record<AuctionMode, number> = { E: 0, D: 0, S: 0, R: 0 }
const EMPTY_STATUS_COUNTS: Record<StatusFilter, number> = { live: 0, ending: 0, scheduled: 0 }
const CATEGORY_LABELS: Record<string, string> = {
  'dien-tu': 'Công nghệ',
  'dong-ho': 'Đồng hồ',
  'xe-co': 'Xe cộ',
  sneakers: 'Sneakers',
  'suu-tam': 'Sưu tầm',
  gaming: 'Gaming',
}

const MODE_PARAM_MAP: Record<string, AuctionMode> = {
  e: 'E',
  english: 'E',
  d: 'D',
  dutch: 'D',
  s: 'S',
  sealed: 'S',
  sealed_bid: 'S',
  r: 'R',
  reverse: 'R',
}

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'ending_soon', label: 'Sắp kết thúc' },
  { value: 'newest',      label: 'Mới nhất' },
]

const PAGE_SIZE = 12
const FACET_LIMIT = 100
const PRICE_MIN = 0
const PRICE_MAX = 500_000_000
const PRICE_STEP = 500_000
const ENDING_SOON_WINDOW_MS = 24 * 60 * 60 * 1000

function formatPrice(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function parsePrice(value: string): number | null {
  const normalized = value.replace(/\D/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function priceValue(item: AuctionItem): number {
  return item.current_price ?? item.starting_price ?? 0
}

function isAuctionLive(item: AuctionItem): boolean {
  return item.status === 'active' && new Date(item.ends_at).getTime() > Date.now()
}

function isEndingSoon(item: AuctionItem): boolean {
  const endsAt = new Date(item.ends_at).getTime()
  const diff = endsAt - Date.now()
  return isAuctionLive(item) && diff <= ENDING_SOON_WINDOW_MS
}

function statusMatches(item: AuctionItem, statuses: StatusFilter[]): boolean {
  if (statuses.length === 0) return true
  return statuses.some((status) => {
    if (status === 'live') return isAuctionLive(item)
    if (status === 'scheduled') return item.status === 'scheduled'
    return isEndingSoon(item)
  })
}

function categoryLabel(category: CategoryOption): string {
  return CATEGORY_LABELS[category.slug] ?? category.name
}

function resolveCategory(value: string, categories: CategoryOption[]): CategoryOption | undefined {
  if (!value) return undefined
  const numericId = Number(value)
  if (Number.isInteger(numericId) && numericId > 0) {
    return categories.find((category) => category.id === numericId)
  }
  return categories.find((category) => category.slug === value)
}

function normalizePricePair(minText: string, maxText: string): { minText: string; maxText: string } {
  let min = parsePrice(minText) ?? PRICE_MIN
  let max = parsePrice(maxText) ?? PRICE_MAX

  min = Math.max(PRICE_MIN, Math.min(min, PRICE_MAX))
  max = Math.max(PRICE_MIN, Math.min(max, PRICE_MAX))
  if (min > max) [min, max] = [max, min]

  return {
    minText: min > PRICE_MIN ? String(min) : '',
    maxText: max < PRICE_MAX ? String(max) : '',
  }
}

function calcCountdown(endsAt: string): string {
  const diff = Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000)
  if (diff <= 0) return 'Đã kết thúc'
  if (diff >= 86400) {
    const d = Math.floor(diff / 86400)
    const h = Math.floor((diff % 86400) / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function countdownClass(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0)                 return 'countdown ended'
  if (diff < 30 * 60 * 1000)     return 'countdown urgent'
  if (diff < 2 * 60 * 60 * 1000) return 'countdown warning'
  return 'countdown'
}

function modeBadgeClass(mode: AuctionItem['mode']): string {
  switch (mode) {
    case 'english':    return 'mode-badge E'
    case 'dutch':      return 'mode-badge D'
    case 'sealed_bid': return 'mode-badge S'
    case 'reverse':    return 'mode-badge R'
  }
}

function modeBadgeShort(mode: AuctionItem['mode']): AuctionMode {
  switch (mode) {
    case 'english':    return 'E'
    case 'dutch':      return 'D'
    case 'sealed_bid': return 'S'
    case 'reverse':    return 'R'
  }
}

function auctionTitle(item: AuctionItem): string {
  return item.product?.title ?? item.title ?? `Auction #${item.id}`
}

function auctionImageUrl(item: AuctionItem): string | null {
  const images = item.product?.images ?? []
  const primary = images.find((img) => img.is_primary) ?? images[0]
  return primary?.thumbnail_url || primary?.url || null
}

function normalizeModeParam(value: string): AuctionMode | null {
  return MODE_PARAM_MAP[value.toLowerCase()] ?? null
}

function readModeParams(sp: URLSearchParams): AuctionMode[] {
  const seen = new Set<AuctionMode>()
  sp.getAll('mode').forEach((value) => {
    const mode = normalizeModeParam(value)
    if (mode) seen.add(mode)
  })
  return [...seen]
}

function buildPaginationPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

interface CountdownCellProps {
  endsAt: string
}

function CountdownCell({ endsAt }: CountdownCellProps) {
  const [display, setDisplay] = useState(() => calcCountdown(endsAt))
  const [cls, setCls]         = useState(() => countdownClass(endsAt))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setDisplay(calcCountdown(endsAt))
      setCls(countdownClass(endsAt))
    }, 1000)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [endsAt])

  return <span className={cls}>{display}</span>
}

interface AuctionCardProps {
  auction: AuctionItem
}

function AuctionCard({ auction }: AuctionCardProps) {
  const isSealed  = auction.mode === 'sealed_bid'
  const isDutch   = auction.mode === 'dutch'
  const isReverse = auction.mode === 'reverse'
  const title     = auctionTitle(auction)
  const short     = modeBadgeShort(auction.mode)
  const imageUrl  = auctionImageUrl(auction)

  return (
    <Link to={`/auctions/${auction.id}`} className="listing">
      <div className="listing-badges">
        <span className={modeBadgeClass(auction.mode)}>
          {short} · {MODE_LABELS[short]}
        </span>
      </div>
      <div className="listing-img">
        {imageUrl ? <img src={imageUrl} alt={title} /> : <span>{title}</span>}
      </div>
      <div className="listing-title">{title}</div>

      {isSealed ? (
        <div className="listing-price sealed">— ẩn — Sealed</div>
      ) : isReverse ? (
        <div className="listing-price">≤ {formatPrice(auction.current_price)}</div>
      ) : isDutch ? (
        <div className="listing-price">
          {formatPrice(auction.current_price)}{' '}
          <span className="price-arrow-down">↓</span>
        </div>
      ) : (
        <div className="listing-price">{formatPrice(auction.current_price)}</div>
      )}

      <div className="listing-details">
        {isSealed ? (
          <span>—</span>
        ) : isReverse ? (
          <span>{auction.bid_count} sellers</span>
        ) : (
          <span>{auction.bid_count} bids</span>
        )}
        <CountdownCell endsAt={auction.ends_at} />
      </div>
    </Link>
  )
}

interface AuctionListRowProps {
  auction: AuctionItem
}

function AuctionListRow({ auction }: AuctionListRowProps) {
  const isSealed = auction.mode === 'sealed_bid'
  const title    = auctionTitle(auction)
  const short    = modeBadgeShort(auction.mode)
  const imageUrl = auctionImageUrl(auction)

  return (
    <Link to={`/auctions/${auction.id}`} className="listing-list-row">
      <div className="thumb">
        {imageUrl ? <img src={imageUrl} alt={title} /> : title.split(' ').slice(0, 2).join(' ')}
      </div>
      <div>
        <div className="name">{title}</div>
        <div className="meta">
          <span className={modeBadgeClass(auction.mode)}>{short}</span>
          #{auction.id.slice(-4)}
        </div>
      </div>
      <div className="num">
        {isSealed ? '— ẩn —' : formatPrice(auction.current_price)}
      </div>
      <div className="num">{auction.bid_count} bid</div>
      <div className="num">
        <CountdownCell endsAt={auction.ends_at} />
      </div>
      <span className="list-enter-btn">Vào phòng</span>
    </Link>
  )
}

export default function AuctionList() {
  useDocumentTitle('Khám phá phiên đấu giá')
  const location = useLocation()
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentPage    = parseInt(searchParams.get('page') ?? '1', 10)
  const currentSort    = (searchParams.get('sort') ?? 'ending_soon') as SortValue
  const isEndingSoonRoute = location.pathname === '/auctions/ending-soon'
  const isHotRoute = location.pathname === '/auctions/hot'
  const routeCategorySlug = location.pathname.startsWith('/categories/') ? (slug ?? '') : ''
  const currentCat     = routeCategorySlug || searchParams.get('cat') || ''
  const activeModes = useMemo(() => readModeParams(searchParams), [searchParams])
  const activeStatuses = useMemo(
    () => searchParams.getAll('status') as StatusFilter[],
    [searchParams],
  )
  const priceMin       = searchParams.get('price_min') ?? ''
  const priceMax       = searchParams.get('price_max') ?? ''

  const [viewMode,       setViewMode]       = useState<ViewMode>('grid')
  const [allItems,       setAllItems]       = useState<AuctionItem[]>([])
  const [categories,     setCategories]     = useState<CategoryOption[]>([])
  const [loading,        setLoading]        = useState(true)
  const [localPriceMin,  setLocalPriceMin]  = useState(priceMin)
  const [localPriceMax,  setLocalPriceMax]  = useState(priceMax)

  const fetchAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const auctionPath = isHotRoute
        ? '/auctions/hot'
        : isEndingSoonRoute
          ? '/auctions/ending-soon'
          : routeCategorySlug
            ? `/categories/${routeCategorySlug}/auctions`
            : '/auctions'

      const [auctionResult, homeResult] = await Promise.allSettled([
        publicGet<PageResponse<AuctionItem>>(auctionPath, {
          limit: FACET_LIMIT,
          offset: 0,
          sort: 'ending_soon',
        }),
        publicGet<HomeData>('/home'),
      ])

      if (auctionResult.status === 'fulfilled' && auctionResult.value.data?.items) {
        setAllItems(auctionResult.value.data.items)
      } else {
        setAllItems([])
      }

      if (homeResult.status === 'fulfilled' && homeResult.value.data?.categories) {
        setCategories(homeResult.value.data.categories)
      } else {
        setCategories([])
      }
    } catch {
      setAllItems([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [isEndingSoonRoute, isHotRoute, routeCategorySlug])

  useEffect(() => {
    fetchAuctions()
  }, [fetchAuctions])

  useEffect(() => {
    setLocalPriceMin(priceMin)
    setLocalPriceMax(priceMax)
  }, [priceMin, priceMax])

  const categoryOptions = useMemo(
    () => categories.length > 0 ? categories : FALLBACK_CATEGORIES,
    [categories],
  )

  const selectedCategory = useMemo(
    () => resolveCategory(currentCat, categoryOptions),
    [currentCat, categoryOptions],
  )

  const categoryNav = useMemo(
    () => [{ id: 0, name: 'Tất cả', slug: '' }, ...categoryOptions],
    [categoryOptions],
  )

  const modeCounts = useMemo(() => {
    const counts = { ...EMPTY_MODE_COUNTS }
    allItems.forEach((item) => {
      counts[modeBadgeShort(item.mode)] += 1
    })
    return counts
  }, [allItems])

  const statusCounts = useMemo(() => {
    const counts = { ...EMPTY_STATUS_COUNTS }
    allItems.forEach((item) => {
      if (isAuctionLive(item)) counts.live += 1
      if (item.status === 'scheduled') counts.scheduled += 1
      if (isEndingSoon(item)) counts.ending += 1
    })
    return counts
  }, [allItems])

  const filteredItems = useMemo(() => {
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()
    const minPrice = parsePrice(priceMin)
    const maxPrice = parsePrice(priceMax)

    return [...allItems]
      .filter((item) => {
        const title = auctionTitle(item).toLowerCase()
        if (q && !title.includes(q)) return false
        if (currentCat && (!selectedCategory || item.category_id !== selectedCategory.id)) return false
        if (activeModes.length > 0 && !activeModes.includes(modeBadgeShort(item.mode))) return false
        if (!statusMatches(item, activeStatuses)) return false
        if (minPrice !== null && priceValue(item) < minPrice) return false
        if (maxPrice !== null && priceValue(item) > maxPrice) return false
        return true
      })
      .sort((a, b) => {
        if (currentSort === 'newest') {
          return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
        }
        return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime()
      })
  }, [
    allItems,
    searchParams,
    currentCat,
    selectedCategory,
    activeModes,
    activeStatuses,
    priceMin,
    priceMax,
    currentSort,
  ])

  const total = filteredItems.length
  const hasLiveResults = filteredItems.some(isAuctionLive)
  const pageItems = useMemo(() => {
    const offset = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(offset, offset + PAGE_SIZE)
  }, [filteredItems, currentPage])

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) { next.set(key, value) } else { next.delete(key) }
      next.set('page', '1')
      return next
    })
  }

  function searchWithout(keys: string[]): string {
    const next = new URLSearchParams(searchParams)
    keys.forEach((key) => next.delete(key))
    next.delete('page')
    const query = next.toString()
    return query ? `?${query}` : ''
  }

  function categoryHref(value: string): string {
    const query = searchWithout(['cat'])
    return value ? `/categories/${value}${query}` : `/auctions${query}`
  }

  function clearCategoryFilter() {
    navigate(categoryHref(''))
  }

  const setPage = useCallback((page: number | string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(page))
      return next
    })
  }, [setSearchParams])

  function toggleMultiParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next     = new URLSearchParams(prev)
      const existing = key === 'mode' ? readModeParams(next) : next.getAll(key)
      const nextValue = key === 'mode' ? normalizeModeParam(value) : value
      if (!nextValue) return next
      next.delete(key)
      if (existing.includes(nextValue)) {
        existing.filter((v) => v !== nextValue).forEach((v) => next.append(key, v))
      } else {
        [...existing, nextValue].forEach((v) => next.append(key, v))
      }
      next.set('page', '1')
      return next
    })
  }

  function deleteParam(key: string, value?: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value !== undefined) {
        const existing = key === 'mode' ? readModeParams(next) : next.getAll(key)
        const valueToRemove = key === 'mode' ? normalizeModeParam(value) : value
        const remaining = existing.filter((v) => v !== valueToRemove)
        next.delete(key)
        remaining.forEach((v) => next.append(key, v))
      } else {
        next.delete(key)
      }
      next.set('page', '1')
      return next
    })
  }

  function deleteParams(keys: string[]) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      keys.forEach((key) => next.delete(key))
      next.set('page', '1')
      return next
    })
  }

  function clearAllFilters() {
    setSearchParams((prev) => {
      const next = new URLSearchParams()
      const q = prev.get('q')
      if (q) next.set('q', q)
      return next
    })
    setLocalPriceMin('')
    setLocalPriceMax('')
  }

  function resetPriceFilter() {
    deleteParams(['price_min', 'price_max'])
    setLocalPriceMin('')
    setLocalPriceMax('')
  }

  function applyPriceFilter() {
    applyPriceValues(localPriceMin, localPriceMax)
  }

  function applyPriceValues(minText: string, maxText: string) {
    const normalized = normalizePricePair(minText, maxText)
    setLocalPriceMin(normalized.minText)
    setLocalPriceMax(normalized.maxText)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (normalized.minText) { next.set('price_min', normalized.minText) } else { next.delete('price_min') }
      if (normalized.maxText) { next.set('price_max', normalized.maxText) } else { next.delete('price_max') }
      next.set('page', '1')
      return next
    })
  }

  const localPriceMinValue = parsePrice(localPriceMin) ?? PRICE_MIN
  const localPriceMaxValue = parsePrice(localPriceMax) ?? PRICE_MAX
  const sliderMinValue = Math.min(localPriceMinValue, localPriceMaxValue)
  const sliderMaxValue = Math.max(localPriceMinValue, localPriceMaxValue)
  const rangeStart = ((sliderMinValue - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100
  const rangeEnd = ((sliderMaxValue - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100

  function handleMinSlider(value: string) {
    const nextMin = Math.min(Number(value), sliderMaxValue)
    applyPriceValues(String(nextMin), localPriceMax)
  }

  function handleMaxSlider(value: string) {
    const nextMax = Math.max(Number(value), sliderMinValue)
    applyPriceValues(localPriceMin, String(nextMax))
  }

  const chips: { label: string; onRemove: () => void }[] = []

  activeModes.forEach((m) => {
    chips.push({
      label:    `Mode: ${MODE_LABELS[m]}`,
      onRemove: () => toggleMultiParam('mode', m),
    })
  })

  activeStatuses.forEach((s) => {
    chips.push({
      label:    STATUS_LABELS[s],
      onRemove: () => toggleMultiParam('status', s),
    })
  })

  if (priceMin || priceMax) {
    const minLabel = priceMin ? formatPrice(parseInt(priceMin, 10)) : '0 ₫'
    const maxLabel = priceMax ? formatPrice(parseInt(priceMax, 10)) : '∞'
    chips.push({
      label: `${minLabel} – ${maxLabel}`,
      onRemove: resetPriceFilter,
    })
  }

  if (currentCat) {
    const catLabel = selectedCategory ? categoryLabel(selectedCategory) : currentCat
    chips.push({ label: catLabel, onRemove: clearCategoryFilter })
  }

  const totalPages       = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paginationPages  = buildPaginationPages(currentPage, totalPages)

  useEffect(() => {
    if (!loading && currentPage > totalPages) {
      setPage(totalPages)
    }
  }, [currentPage, loading, setPage, totalPages])

  return (
    <>
      {/* Category bar */}
      <div className="cat-bar">
        {categoryNav.map((cat) => (
          <Link
            key={cat.slug}
            to={categoryHref(cat.slug)}
            className={(cat.slug === '' && currentCat === '') || selectedCategory?.id === cat.id ? 'active' : undefined}
          >
            {categoryLabel(cat)}
          </Link>
        ))}
      </div>

      {/* Browse shell */}
      <div className="browse-shell">

        {/* Filter sidebar */}
        <aside className="filter-panel">

          {/* Mode */}
          <div className="filter-section">
            <h6>
              Mode đấu giá
              <button className="reset" onClick={() => deleteParam('mode')}>reset</button>
            </h6>
            <div className="checkbox-list">
              {(Object.keys(MODE_LABELS) as AuctionMode[]).map((m) => (
                <label key={m}>
                  <input
                    type="checkbox"
                    checked={activeModes.includes(m)}
                    onChange={() => toggleMultiParam('mode', m)}
                  />
                  <span className={`mode-badge ${m}`}>{m}</span>
                  {MODE_LABELS[m]}
                  <span className="count">{modeCounts[m]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="filter-section">
            <h6>
              Trạng thái
              <button className="reset" onClick={() => deleteParam('status')}>reset</button>
            </h6>
            <div className="checkbox-list">
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    checked={activeStatuses.includes(s)}
                    onChange={() => toggleMultiParam('status', s)}
                  />
                  {STATUS_LABELS[s]}
                  <span className="count">{statusCounts[s]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="filter-section">
            <h6>
              Khoảng giá (VND)
              <button
                className="reset"
                onClick={resetPriceFilter}
              >
                reset
              </button>
            </h6>
            <div className="price-range">
              <input
                type="text"
                placeholder="Từ"
                value={localPriceMin}
                inputMode="numeric"
                onChange={(e) => setLocalPriceMin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyPriceFilter() }}
              />
              <input
                type="text"
                placeholder="Đến"
                value={localPriceMax}
                inputMode="numeric"
                onChange={(e) => setLocalPriceMax(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyPriceFilter() }}
              />
            </div>
            <div
              className="dual-range"
              style={{
                '--range-start': `${rangeStart}%`,
                '--range-end': `${rangeEnd}%`,
              } as CSSProperties}
            >
              <input
                type="range"
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={sliderMinValue}
                aria-label="Giá thấp nhất"
                onInput={(e) => handleMinSlider(e.currentTarget.value)}
                onChange={(e) => handleMinSlider(e.target.value)}
              />
              <input
                type="range"
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={sliderMaxValue}
                aria-label="Giá cao nhất"
                onInput={(e) => handleMaxSlider(e.currentTarget.value)}
                onChange={(e) => handleMaxSlider(e.target.value)}
              />
            </div>
            <div className="price-track-labels">
              <span>{formatPrice(sliderMinValue)}</span>
              <span>{sliderMaxValue >= PRICE_MAX ? '500M+' : formatPrice(sliderMaxValue)}</span>
            </div>
          </div>

          {/* Apply / Clear */}
          <div className="filter-clear-all">
            <button onClick={applyPriceFilter}>Áp dụng</button>
            <button onClick={clearAllFilters}>Xoá</button>
          </div>
        </aside>

        {/* Results */}
        <section>

          {/* Toolbar */}
          <div className="browse-toolbar">
            <div className="left">
              <h1>Khám phá <em>phiên đấu giá</em></h1>
              <span className="count">{total} kết quả</span>
              {hasLiveResults && (
                <span className="live-pill">
                  <span className="live-dot" />
                  LIVE
                </span>
              )}
            </div>

            <select
              value={currentSort}
              onChange={(e) => setParam('sort', e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <div className="view-toggle">
              <button
                className={viewMode === 'grid' ? 'active' : undefined}
                onClick={() => setViewMode('grid')}
              >
                Lưới
              </button>
              <button
                className={viewMode === 'list' ? 'active' : undefined}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map((chip, i) => (
                <span key={i} className="chip">
                  {chip.label}
                  <button
                    className="x"
                    onClick={chip.onRemove}
                    aria-label={`Bỏ lọc ${chip.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Listings */}
          {loading ? (
            <div className="browse-loading"><Spin size="large" /></div>
          ) : pageItems.length === 0 ? (
            <div className="browse-empty">
              <h3>Không tìm thấy phiên nào</h3>
              <p>Thử bỏ bớt bộ lọc hoặc tìm với từ khoá khác.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="listings-grid">
              {pageItems.map((item) => <AuctionCard key={item.id} auction={item} />)}
            </div>
          ) : (
            <div>
              {pageItems.map((item) => <AuctionListRow key={item.id} auction={item} />)}
            </div>
          )}

          {/* Pagination */}
          {!loading && pageItems.length > 0 && (
            <div className="pagination">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Trang trước"
              >
                ‹
              </button>

              {paginationPages.map((p, i) =>
                p === '…' ? (
                  <button key={`ell-${i}`} disabled>…</button>
                ) : (
                  <button
                    key={p}
                    className={p === currentPage ? 'active' : undefined}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Trang sau"
              >
                ›
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export { AuctionList as Component }
