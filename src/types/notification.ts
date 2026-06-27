export interface Notification {
  id: number
  event_type: string
  title: string
  content: string
  link?: string | null
  is_read: boolean
  read_at?: string | null
  created_at: string
}

export interface NotificationPreference {
  event_type: string
  channel_email: boolean
  channel_in_app: boolean
}

export type NotificationFilter = 'all' | 'auction' | 'order' | 'payment' | 'dispute' | 'unread'
