import { useCallback, useEffect, useState } from 'react'
import { App, Button, Empty, Spin, Tag } from 'antd'
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { privateDelete, privateGet } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface SearchHistoryItem {
  keyword: string
  searched_at: string
}

export function Component() {
  useDocumentTitle('Lịch sử tìm kiếm')
  const { message, modal } = App.useApp()
  const navigate = useNavigate()

  const [items, setItems] = useState<SearchHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await privateGet<SearchHistoryItem[]>('/me/search-history')
      setItems(Array.isArray(res.data) ? res.data : [])
    } catch {
      setItems([])
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
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, margin: 0 }}>
          Lịch sử tìm kiếm
        </h1>
        {items.length > 0 && (
          <Button danger size="small" icon={<DeleteOutlined />} onClick={handleClearAll}>
            Xóa tất cả
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Empty description="Chưa có lịch sử tìm kiếm" />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((item) => (
            <Tag
              key={item.keyword}
              closable
              onClose={(e) => {
                e.preventDefault()
                handleDeleteKeyword(item.keyword)
              }}
              style={{
                cursor: 'pointer',
                padding: '4px 10px',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
              }}
              icon={<SearchOutlined />}
              onClick={() => handleSearch(item.keyword)}
            >
              {item.keyword}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}

export default Component
