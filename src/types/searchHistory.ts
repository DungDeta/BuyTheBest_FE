export interface SearchHistoryItem {
  keyword: string
  searched_at: string
}

export interface SearchHistoryResponse {
  items: SearchHistoryItem[]
}
