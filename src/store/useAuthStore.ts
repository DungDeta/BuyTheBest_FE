import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null

  isAuthenticated: () => boolean
  isSeller: () => boolean
  isAdmin: () => boolean
  login: (payload: { user: User; access_token: string; refresh_token: string; expires_in: number }) => void
  setTokens: (payload: { access_token: string; refresh_token: string; expires_in: number }) => void
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

      login: ({ user, access_token, refresh_token, expires_in }) => {
        set({
          user,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + expires_in * 1000,
        })
      },

      setTokens: ({ access_token, refresh_token, expires_in }) => {
        set({
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + expires_in * 1000,
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
