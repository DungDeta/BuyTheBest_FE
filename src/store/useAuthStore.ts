import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LoginResponse, TokenResponse, User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null

  isAuthenticated: () => boolean
  isSeller: () => boolean
  isAdmin: () => boolean
  login: (payload: LoginResponse) => void
  setTokens: (payload: TokenResponse) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,

      isAuthenticated: () => {
        const { accessToken, expiresAt } = get()
        if (!accessToken || !expiresAt) return false
        return Date.now() < expiresAt
      },

      isSeller: () => get().user?.is_seller ?? false,
      isAdmin: () => get().user?.is_admin ?? false,

      login: ({ user, token }) => {
        set({
          user,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: Date.now() + token.access_expires_in * 1000,
        })
      },

      setTokens: ({ access_token, refresh_token, access_expires_in }) => {
        set({
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + access_expires_in * 1000,
        })
      },

      updateUser: (partial) => {
        const current = get().user
        if (current) {
          set({ user: { ...current, ...partial } })
        }
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, expiresAt: null })
      },
    }),
    { name: 'auth-storage' },
  ),
)
