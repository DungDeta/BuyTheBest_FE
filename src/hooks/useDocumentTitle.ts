import { useEffect } from 'react'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} · BuyTheBest` : 'BuyTheBest | Đấu giá trực tuyến'
    return () => { document.title = prev }
  }, [title])
}
