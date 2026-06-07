export interface User {
  id: number
  email: string
  display_name: string
  avatar_url: string | null
  phone: string | null
  address: string | null
  is_seller: boolean
  is_admin: boolean
  status: 'active' | 'pending' | 'banned'
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  display_name: string
}

export interface LoginResponse {
  user: User
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}
