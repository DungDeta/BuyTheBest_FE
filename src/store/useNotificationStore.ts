import { create } from 'zustand'
import type { Notification } from '@/types/notification'

interface NotificationState {
  unreadCount: number
  isConnected: boolean
  latestNotification: Notification | null
  setUnreadCount: (count: number) => void
  setConnected: (connected: boolean) => void
  setLatestNotification: (notification: Notification | null) => void
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  isConnected: false,
  latestNotification: null,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setConnected: (isConnected) => set({ isConnected }),
  setLatestNotification: (latestNotification) => set({ latestNotification }),
  reset: () =>
    set({
      unreadCount: 0,
      isConnected: false,
      latestNotification: null,
    }),
}))
