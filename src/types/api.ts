export interface ApiResponse<T> {
  status: number
  message: string
  data: T
  timestamp: string
}

export interface ErrorResponse {
  errorCode: string
  error: string
  code: number
  path?: string
  timestamp?: string
  details?: Record<string, string>
}

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
