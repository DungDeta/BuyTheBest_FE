import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Empty, Spin } from 'antd'
import { ClockCircleOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { privateDelete, privateGet } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import type { SearchHistoryItem, SearchHistoryResponse } from '@/types/searchHistory'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './dashboard.css'

function formatSearchTime(value: string) {
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : 'Không rõ thời điểm'
}

export function Component() {
  useDocumentTitle('Lịch sử tìm kiếm')
  const { message, modal } = App.useApp()
  const navigate = useNavigate()

  const [items, setItems] = useState<SearchHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await privateGet<SearchHistoryResponse>('/me/search-history')
      setItems(res.data?.items ?? [])
    } catch (err) {
      setItems([])
      const e = err as ErrorResponse
      setLoadError(e?.error ?? 'Không thể tải lịch sử tìm kiếm')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  function handleSearch(keyword: string) {
    navigate(`/auctions?q=${encodeURIComponent(keyword)}`)
  }

  async function handleDeleteKeyword(keyword: string) {
    try {
      await privateDelete(`/me/search-history/${encodeURIComponent(keyword)}`)
      setItems((prev) => prev.filter((item) => item.keyword !== keyword))
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không thể xóa từ khóa')
    }
  }

  function handleClearAll() {
    modal.confirm({
      title: 'Xóa toàn bộ lịch sử tìm kiếm',
      content: 'Bạn chắc chắn muốn xóa tất cả lịch sử tìm kiếm?',
      okText: 'Xóa tất cả',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await privateDelete('/me/search-history')
          setItems([])
          message.success('Đã xóa lịch sử tìm kiếm')
        } catch (err) {
          const e = err as ErrorResponse
          message.error(e?.error ?? 'Không thể xóa lịch sử')
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="search-history-loading">
        <Spin />
      </div>
    )
  }

  return (
    <div className="dashboard-page search-history-page">
      <div className="search-history-hero">
        <div>
          <h1>Lịch sử tìm kiếm</h1>
          <p>Danh sách 20 từ khóa gần nhất. Bấm vào một từ khóa để tìm lại phiên đấu giá.</p>
        </div>
        {items.length > 0 && (
          <Button danger size="small" icon={<DeleteOutlined />} onClick={handleClearAll}>
            Xóa tất cả
          </Button>
        )}
      </div>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải lịch sử tìm kiếm"
          description={loadError}
          action={
            <Button size="small" onClick={fetchHistory}>
              Thử lại
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <Empty description="Chưa có lịch sử tìm kiếm" />
      ) : (
        <div className="search-history-list" role="list">
          {items.map((item) => (
            <article className="search-history-row" key={item.keyword} role="listitem">
              <button
                type="button"
                className="search-history-row__main"
                onClick={() => handleSearch(item.keyword)}
              >
                <span className="search-history-row__icon" aria-hidden="true">
                  <SearchOutlined />
                </span>
                <span className="search-history-row__content">
                  <span className="search-history-row__keyword">{item.keyword}</span>
                  <span className="search-history-row__time">
                    <ClockCircleOutlined />
                    {formatSearchTime(item.searched_at)}
                  </span>
                </span>
              </button>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={`Xóa từ khóa ${item.keyword}`}
                onClick={() => handleDeleteKeyword(item.keyword)}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default Component
