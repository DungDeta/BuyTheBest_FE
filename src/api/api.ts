import { AxiosError } from 'axios'
import apiPublic from './apiPublic'
import apiPrivate from './apiPrivate'
import type { ApiResponse, ErrorResponse } from '@/types/api'

function handleError(err: unknown): never {
  if (err instanceof AxiosError && err.response?.data) {
    throw err.response.data as ErrorResponse
  }
  throw { errorCode: 'NETWORK', error: 'Không thể kết nối đến máy chủ', code: 0 } as ErrorResponse
}

export async function publicGet<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  try {
    const res = await apiPublic.get<ApiResponse<T>>(url, { params })
    return res.data
  } catch (err) {
    return handleError(err)
  }
}

export async function publicPost<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await apiPublic.post<ApiResponse<T>>(url, data)
    return res.data
  } catch (err) {
    return handleError(err)
  }
}

export async function privateGet<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  try {
    const res = await apiPrivate.get<ApiResponse<T>>(url, { params })
    return res.data
  } catch (err) {
    return handleError(err)
  }
}

export async function privatePost<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await apiPrivate.post<ApiResponse<T>>(url, data)
    return res.data
  } catch (err) {
    return handleError(err)
  }
}

export async function privatePut<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await apiPrivate.put<ApiResponse<T>>(url, data)
    return res.data
  } catch (err) {
    return handleError(err)
  }
}

export async function privateDelete<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const res = await apiPrivate.delete<ApiResponse<T>>(url)
    return res.data
  } catch (err) {
    return handleError(err)
  }
}
