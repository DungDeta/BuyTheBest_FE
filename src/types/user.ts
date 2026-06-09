export interface User {
  id: string
  email: string
  display_name: string
  avatar_url?: string | null
  phone?: string | null
  address?: string | null
  is_seller: boolean
  is_admin: boolean
  email_verified: boolean
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
  token: TokenResponse
  user: User
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  access_expires_in: number
  refresh_expires_in: number
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  new_password: string
  confirm_password: string
}
