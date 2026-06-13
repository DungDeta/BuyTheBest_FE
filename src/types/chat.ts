export interface ChatUser {
  id: number
  display_name: string
  avatar_url?: string | null
}

export interface Conversation {
  id: number
  participant1_id: number
  participant2_id: number
  current_user_id?: number
  current_user_role?: 'buyer' | 'seller'
  participant1_last_read_message_id?: number | null
  participant2_last_read_message_id?: number | null
  last_message_at?: string | null
  created_at: string
  other_user?: ChatUser | null
  last_message?: { content: string; sender_id: number } | null
  unread_count?: number
}

export interface PrivateMessage {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  image_url?: string | null
  image_object_key?: string | null
  has_violation: boolean
  violation_type?: string | null
  created_at: string
}

export type ChatWsEventType =
  | 'message.new'
  | 'typing.start'
  | 'typing.stop'
  | 'presence.online'
  | 'presence.offline'
  | 'read.receipt'

export interface ChatWsEvent {
  type: ChatWsEventType
  conversation_id?: number
  user_id?: number
  data?: PrivateMessage
}
