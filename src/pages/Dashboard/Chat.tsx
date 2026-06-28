import { useEffect, useRef, useState, useCallback } from 'react'
import { App, Spin } from 'antd'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { privateGet, privatePost, privatePut } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatWebSocket } from '@/hooks/useChatWebSocket'
import type { ErrorResponse } from '@/types/api'
import type { Conversation, PrivateMessage, ChatWsEvent } from '@/types/chat'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './chat.css'

const PAGE_LIMIT = 30
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024
const CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function mergeMessagesChronologically(...groups: PrivateMessage[][]): PrivateMessage[] {
  const byId = new Map<number, PrivateMessage>()
  groups.flat().forEach((item) => byId.set(item.id, item))
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

function sortConversationsByLatest(items: Conversation[]): Conversation[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.last_message_at ?? a.created_at)
    const bTime = Date.parse(b.last_message_at ?? b.created_at)
    return bTime - aTime
  })
}

interface ChatImagePresignResponse {
  object_key: string
  upload_url: string
  fields?: Record<string, string>
  form_fields?: Record<string, string>
  http_method?: string
  image_url?: string
  max_size?: number
}

function getChatImageContentType(file: File): string | null {
  if (file.type === 'image/jpg') return 'image/jpeg'
  if (file.type && CHAT_IMAGE_TYPES.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function uploadChatImageBinary(
  presign: ChatImagePresignResponse,
  file: File,
  contentType: string,
) {
  const fields = presign.form_fields ?? presign.fields ?? {}
  const method = (presign.http_method ?? (Object.keys(fields).length > 0 ? 'POST' : 'PUT')).toUpperCase()

  if (method === 'POST') {
    const form = new FormData()
    Object.entries(fields).forEach(([key, value]) => {
      form.append(key, value)
    })
    if (!Object.keys(fields).some((key) => key.toLowerCase() === 'key')) {
      form.append('key', presign.object_key)
    }
    if (!Object.keys(fields).some((key) => key.toLowerCase() === 'content-type')) {
      form.append('Content-Type', contentType)
    }
    form.append('file', file)

    const res = await fetch(presign.upload_url, { method: 'POST', body: form })
    if (!res.ok) throw new Error('upload_failed')
    return
  }

  const res = await fetch(presign.upload_url, {
    method,
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!res.ok) throw new Error('upload_failed')
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Hôm nay'
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getDateKey(iso: string): string {
  return new Date(iso).toDateString()
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: number
  online?: boolean
}

function Avatar({ name, avatarUrl, size = 36, online }: AvatarProps) {
  return (
    <div
      className="chat-item__avatar"
      style={{ width: size, height: size, minWidth: size }}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} />
      ) : (
        getInitials(name)
      )}
      {online !== undefined && (
        <span
          className={`chat-item__presence${online ? ' chat-item__presence--online' : ''}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export function Component() {
  useDocumentTitle('Tin nhắn')
  const { message } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedConversationId = Number(searchParams.get('conversation')) || null
  const currentUser = useAuthStore((s) => s.user)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convLoading, setConvLoading] = useState(false)

  const [activeConvId, setActiveConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<PrivateMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgCursor, setMsgCursor] = useState<number | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [messageSearchOpen, setMessageSearchOpen] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [messageSearchResults, setMessageSearchResults] = useState<PrivateMessage[]>([])
  const [messageSearchLoading, setMessageSearchLoading] = useState(false)
  const [messageSearchError, setMessageSearchError] = useState<string | null>(null)
  const [messageSearchSubmitted, setMessageSearchSubmitted] = useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null)
  const [otherReadThroughId, setOtherReadThroughId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Map<number, Set<number>>>(new Map())

  const [showMain, setShowMain] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeConvIdRef = useRef<number | null>(null)
  const activeOwnUserIdRef = useRef<number | null>(null)
  const messagesRef = useRef<PrivateMessage[]>([])
  const messageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const searchRequestIdRef = useRef(0)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoScrollUntilRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { isConnected, sendTypingStart, sendTypingStop, sendReadReceipt, subscribe, unsubscribe } =
    useChatWebSocket(activeConvId)

  useEffect(() => {
    activeConvIdRef.current = activeConvId
  }, [activeConvId])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const scrollMessagesToEnd = useCallback((behavior: ScrollBehavior) => {
    autoScrollUntilRef.current = Date.now() + 2000
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current
        container?.scrollTo({ top: container.scrollHeight, behavior })
      })
    })
  }, [])

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null

  const getCurrentInternalUserId = useCallback(
    (conv: Conversation): number | null => {
      if (typeof conv.current_user_id === 'number') return conv.current_user_id
      if (!currentUser) return null
      // Fallback: match by checking which participant matches our user ID from store
      const storeId = Number(currentUser.id) || 0
      if (storeId === conv.participant1_id) return conv.participant1_id
      if (storeId === conv.participant2_id) return conv.participant2_id
      return null
    },
    [currentUser],
  )

  const getOtherUserId = useCallback(
    (conv: Conversation): number => {
      const ownId = getCurrentInternalUserId(conv)
      return ownId === conv.participant2_id ? conv.participant1_id : conv.participant2_id
    },
    [getCurrentInternalUserId],
  )

  const activeOwnUserId =
    activeConversation !== null ? getCurrentInternalUserId(activeConversation) : null

  useEffect(() => {
    activeOwnUserIdRef.current = activeOwnUserId
  }, [activeOwnUserId])

  const isOwnMessage = useCallback(
    (msg: PrivateMessage): boolean => {
      return activeOwnUserId !== null && msg.sender_id === activeOwnUserId
    },
    [activeOwnUserId],
  )

  useEffect(() => {
    let cancelled = false
    setConvLoading(true)

    async function fetchConversations() {
      try {
        const res = await privateGet<Conversation[]>('/conversations', { limit: 50 })
        if (!cancelled) {
          setConversations(sortConversationsByLatest(res.data ?? []))
        }
      } catch {
        if (!cancelled) {
          message.error('Không thể tải danh sách cuộc trò chuyện')
        }
      } finally {
        if (!cancelled) setConvLoading(false)
      }
    }

    fetchConversations()
    return () => {
      cancelled = true
    }
  }, [message])

  const fetchMessages = useCallback(
    async (convId: number, cursor?: number) => {
      setMsgLoading(true)
      try {
        const params: Record<string, unknown> = { limit: PAGE_LIMIT }
        if (cursor !== undefined) params.cursor = cursor

        const res = await privateGet<PrivateMessage[]>(
          `/conversations/${convId}/messages`,
          params,
        )
        const fetched = res.data ?? []
        const chronological = [...fetched].reverse()

        if (cursor !== undefined) {
          setMessages((prev) => mergeMessagesChronologically(chronological, prev))
        } else {
          setMessages(chronological)
          scrollMessagesToEnd('auto')
        }

        setHasMoreMessages(fetched.length === PAGE_LIMIT)
        const oldestMessage = fetched[fetched.length - 1]
        if (oldestMessage) {
          setMsgCursor(oldestMessage.id)
        }
      } catch {
        message.error('Không thể tải tin nhắn')
      } finally {
        setMsgLoading(false)
      }
    },
    [message, scrollMessagesToEnd],
  )

  const closeMessageSearch = useCallback(() => {
    searchRequestIdRef.current += 1
    setMessageSearchOpen(false)
    setMessageSearchQuery('')
    setMessageSearchResults([])
    setMessageSearchError(null)
    setMessageSearchSubmitted(false)
    setMessageSearchLoading(false)
  }, [])

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      if (conv.id === activeConvId) {
        setShowMain(true)
        return
      }
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current)
        readTimerRef.current = null
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
      if (isTypingRef.current && activeConvId !== null) {
        sendTypingStop(activeConvId)
        isTypingRef.current = false
      }
      const ownId = getCurrentInternalUserId(conv)
      const otherReadId =
        ownId === conv.participant1_id
          ? conv.participant2_last_read_message_id
          : conv.participant1_last_read_message_id

      closeMessageSearch()
      setActiveConvId(conv.id)
      setMessages([])
      setMsgCursor(null)
      setHasMoreMessages(false)
      setOtherReadThroughId(otherReadId ?? null)
      setInputValue('')
      setSelectedImage(null)
      setShowMain(true)
      fetchMessages(conv.id)
    },
    [
      activeConvId,
      closeMessageSearch,
      fetchMessages,
      getCurrentInternalUserId,
      sendTypingStop,
    ],
  )

  useEffect(() => {
    if (!requestedConversationId || convLoading || conversations.length === 0) return
    const target = conversations.find((conv) => conv.id === requestedConversationId)
    if (!target) return
    handleSelectConversation(target)
    setSearchParams({}, { replace: true })
  }, [
    requestedConversationId,
    convLoading,
    conversations,
    handleSelectConversation,
    setSearchParams,
  ])

  function handleLoadMore() {
    if (!activeConvId || !msgCursor || msgLoading) return
    const scrollEl = messagesContainerRef.current
    const prevScrollHeight = scrollEl?.scrollHeight ?? 0

    fetchMessages(activeConvId, msgCursor).then(() => {
      if (scrollEl) {
        requestAnimationFrame(() => {
          scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight
        })
      }
    })
  }

  const scheduleMarkRead = useCallback(
    (convId: number, lastMsgId: number) => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current)
      readTimerRef.current = setTimeout(async () => {
        try {
          await privatePut(`/conversations/${convId}/read`, { message_id: lastMsgId })
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === convId ? { ...conv, unread_count: 0 } : conv,
            ),
          )
          sendReadReceipt(convId)
        } catch {
          message.error('Không thể đánh dấu cuộc trò chuyện đã đọc')
        }
      }, 800)
    },
    [message, sendReadReceipt],
  )

  useEffect(() => {
    if (!activeConvId || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && !isOwnMessage(lastMsg)) {
      scheduleMarkRead(activeConvId, lastMsg.id)
    }
  }, [activeConvId, messages, isOwnMessage, scheduleMarkRead])

  const handleWsEvent = useCallback(
    (event: ChatWsEvent) => {
      switch (event.type) {
        case 'chat.message':
        case 'message.new': {
          if (!event.data) break
          const newMsg = event.data
          const convId = newMsg.conversation_id

          if (convId === activeConvIdRef.current) {
            setMessages((prev) => mergeMessagesChronologically(prev, [newMsg]))
            scrollMessagesToEnd('smooth')
            if (!isOwnMessage(newMsg)) {
              scheduleMarkRead(convId, newMsg.id)
            }
          }

          setConversations((prev) =>
            sortConversationsByLatest(prev.map((c) => {
              if (c.id !== convId) return c
              return {
                ...c,
                last_message: {
                  id: newMsg.id,
                  content: newMsg.content,
                  sender_id: newMsg.sender_id,
                  created_at: newMsg.created_at,
                },
                last_message_at: newMsg.created_at,
                unread_count:
                  convId === activeConvIdRef.current ? 0 : (c.unread_count ?? 0) + 1,
              }
            })),
          )
          break
        }

        case 'typing.start': {
          if (event.conversation_id === undefined || event.user_id === undefined) break
          const startCid = event.conversation_id
          const startUid = event.user_id
          setTypingUsers((prev) => {
            const next = new Map(prev)
            const set = new Set(next.get(startCid) ?? [])
            set.add(startUid)
            next.set(startCid, set)
            return next
          })
          break
        }

        case 'typing.stop': {
          if (event.conversation_id === undefined || event.user_id === undefined) break
          const stopCid = event.conversation_id
          const stopUid = event.user_id
          setTypingUsers((prev) => {
            const next = new Map(prev)
            const set = new Set(next.get(stopCid) ?? [])
            set.delete(stopUid)
            next.set(stopCid, set)
            return next
          })
          break
        }

        case 'presence.online': {
          if (event.user_id === undefined) break
          const onUid = event.user_id
          setOnlineUsers((prev) => new Set([...prev, onUid]))
          break
        }

        case 'presence.offline': {
          if (event.user_id === undefined) break
          const offUid = event.user_id
          setOnlineUsers((prev) => {
            const next = new Set(prev)
            next.delete(offUid)
            return next
          })
          break
        }

        case 'read.receipt': {
          if (
            event.conversation_id !== activeConvIdRef.current ||
            event.user_id === undefined ||
            event.user_id === activeOwnUserIdRef.current
          ) {
            break
          }
          const latestOwnMessage = [...messagesRef.current]
            .reverse()
            .find((item) => item.sender_id === activeOwnUserIdRef.current)
          if (latestOwnMessage) {
            setOtherReadThroughId(latestOwnMessage.id)
          }
          break
        }
      }
    },
    [isOwnMessage, scheduleMarkRead, scrollMessagesToEnd],
  )

  useEffect(() => {
    const types: Array<ChatWsEvent['type']> = [
      'chat.message',
      'message.new',
      'typing.start',
      'typing.stop',
      'presence.online',
      'presence.offline',
      'read.receipt',
    ]
    types.forEach((t) => subscribe(t, handleWsEvent))
    return () => {
      types.forEach((t) => unsubscribe(t, handleWsEvent))
    }
  }, [subscribe, unsubscribe, handleWsEvent])

  useEffect(
    () => () => {
      searchRequestIdRef.current += 1
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (readTimerRef.current) clearTimeout(readTimerRef.current)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      if (isTypingRef.current && activeConvIdRef.current !== null) {
        sendTypingStop(activeConvIdRef.current)
      }
    },
    [sendTypingStop],
  )

  async function handleSend() {
    if (!activeConvId || sending || uploadingImage) return
    if (!inputValue.trim() && !selectedImage) return

    const content = inputValue.trim() || 'Ảnh đính kèm'
    const imageFile = selectedImage
    setInputValue('')
    setSending(true)

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }
    if (isTypingRef.current) {
      sendTypingStop(activeConvId)
      isTypingRef.current = false
    }

    try {
      let imageObjectKey: string | undefined

      if (imageFile) {
        const contentType = getChatImageContentType(imageFile)
        if (!contentType) {
          message.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP')
          setInputValue(content === 'Ảnh đính kèm' ? '' : content)
          return
        }
        if (imageFile.size > MAX_CHAT_IMAGE_BYTES) {
          message.error(`Ảnh tối đa ${formatFileSize(MAX_CHAT_IMAGE_BYTES)}`)
          setInputValue(content === 'Ảnh đính kèm' ? '' : content)
          return
        }

        setUploadingImage(true)
        const presignRes = await privatePost<ChatImagePresignResponse>(
          `/conversations/${activeConvId}/messages/upload-url`,
          { content_type: contentType },
        )
        const presign = presignRes.data
        if (!presign?.object_key || !presign.upload_url) {
          throw new Error('presign_failed')
        }
        const maxSize = presign.max_size ?? MAX_CHAT_IMAGE_BYTES
        if (imageFile.size > maxSize) {
          message.error(`Ảnh tối đa ${formatFileSize(maxSize)}`)
          setInputValue(content === 'Ảnh đính kèm' ? '' : content)
          return
        }
        await uploadChatImageBinary(presign, imageFile, contentType)
        imageObjectKey = presign.object_key
      }

      const res = await privatePost<PrivateMessage>(`/conversations/${activeConvId}/messages`, {
        content,
        ...(imageObjectKey ? { image_object_key: imageObjectKey } : {}),
      })
      if (res.data) {
        setMessages((prev) => mergeMessagesChronologically(prev, [res.data!]))
        setConversations((prev) =>
          sortConversationsByLatest(prev.map((conv) =>
            conv.id === activeConvId
              ? {
                  ...conv,
                  last_message: {
                    id: res.data!.id,
                    content: res.data!.content,
                    sender_id: res.data!.sender_id,
                    created_at: res.data!.created_at,
                  },
                  last_message_at: res.data!.created_at,
                  unread_count: 0,
                }
              : conv,
          )),
        )
        setSelectedImage(null)
        scrollMessagesToEnd('smooth')
      }
    } catch (error) {
      const apiError = error as ErrorResponse
      message.error(apiError.error || 'Không thể gửi tin nhắn')
      setInputValue(content)
    } finally {
      setSending(false)
      setUploadingImage(false)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const contentType = getChatImageContentType(file)
    if (!contentType) {
      message.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP')
      return
    }
    if (file.size > MAX_CHAT_IMAGE_BYTES) {
      message.error(`Ảnh tối đa ${formatFileSize(MAX_CHAT_IMAGE_BYTES)}`)
      return
    }
    setSelectedImage(file)
  }

  function clearSelectedImage() {
    setSelectedImage(null)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value)

    if (!activeConvId) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      sendTypingStart(activeConvId)
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      if (isTypingRef.current && activeConvIdRef.current !== null) {
        sendTypingStop(activeConvIdRef.current)
        isTypingRef.current = false
      }
    }, 2000)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleBackToList() {
    setShowMain(false)
  }

  async function handleMessageSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeConvId) return

    const query = messageSearchQuery.trim()
    setMessageSearchSubmitted(true)
    if (query.length < 2) {
      setMessageSearchResults([])
      setMessageSearchError('Nhập ít nhất 2 ký tự để tìm kiếm')
      return
    }

    const requestId = ++searchRequestIdRef.current
    setMessageSearchLoading(true)
    setMessageSearchError(null)
    try {
      const res = await privateGet<PrivateMessage[]>(
        `/conversations/${activeConvId}/messages/search`,
        { q: query, limit: 50 },
      )
      if (requestId === searchRequestIdRef.current) {
        setMessageSearchResults(res.data ?? [])
      }
    } catch {
      if (requestId === searchRequestIdRef.current) {
        setMessageSearchResults([])
        setMessageSearchError('Không thể tìm kiếm tin nhắn. Vui lòng thử lại.')
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setMessageSearchLoading(false)
      }
    }
  }

  function handleSearchResultClick(result: PrivateMessage) {
    setMessages((prev) => mergeMessagesChronologically(prev, [result]))
    closeMessageSearch()
    setHighlightedMessageId(result.id)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)

    setTimeout(() => {
      messageElementsRef.current
        .get(result.id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null)
    }, 2400)
  }

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const name = c.other_user?.display_name ?? ''
        return name.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : conversations

  const isOtherTyping =
    activeConvId !== null &&
    activeConversation !== null &&
    (() => {
      const set = typingUsers.get(activeConvId)
      if (!set || set.size === 0) return false
      const otherUid = getOtherUserId(activeConversation)
      return set.has(otherUid)
    })()

  const isOtherOnline =
    activeConversation !== null ? onlineUsers.has(getOtherUserId(activeConversation)) : false
  const latestOwnMessageId =
    [...messages].reverse().find((item) => isOwnMessage(item))?.id ?? null

  let prevDateKey = ''

  return (
    <div
      className={`chat-shell${showMain ? ' chat-shell--show-main' : ''}`}
      aria-label="Tin nhắn"
    >
      <aside className="chat-sidebar" aria-label="Danh sách cuộc trò chuyện">
        <div className="chat-sidebar__header">
          <h1 className="chat-sidebar__title">
            Tin nhắn
            <span className="chat-sidebar__count">
              {conversations.length > 0 ? `(${conversations.length})` : ''}
            </span>
            {isConnected && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#118c4f',
                  marginLeft: 'auto',
                  flexShrink: 0,
                }}
                title="Đã kết nối"
                aria-label="Đã kết nối"
              />
            )}
          </h1>
          <input
            className="chat-sidebar__search"
            type="search"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Tìm kiếm cuộc trò chuyện"
          />
        </div>

        <div className="chat-sidebar__list" role="list" aria-label="Danh sách tin nhắn">
          {convLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Spin size="small" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="chat-sidebar__empty">
              {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có cuộc trò chuyện nào'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const otherUser = conv.other_user
              const otherUid = getOtherUserId(conv)
              const isOnline = onlineUsers.has(otherUid)
              const isActive = conv.id === activeConvId
              const name = otherUser?.display_name ?? `Người dùng #${otherUid}`
              const preview = conv.last_message?.content ?? ''
              const unread = conv.unread_count ?? 0

              return (
                <div
                  key={conv.id}
                  className={`chat-item${isActive ? ' chat-item--active' : ''}`}
                  onClick={() => handleSelectConversation(conv)}
                  role="listitem"
                  aria-current={isActive ? 'true' : undefined}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectConversation(conv)}
                >
                  <Avatar name={name} avatarUrl={otherUser?.avatar_url} online={isOnline} />
                  <div className="chat-item__body">
                    <div className="chat-item__name">
                      <span>{name}</span>
                      {conv.last_message_at && (
                        <span className="chat-item__time">
                          {formatTime(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="chat-item__preview">
                      <span
                        style={unread > 0 ? { fontWeight: 700, color: 'var(--fg)' } : undefined}
                      >
                        {preview !== ''
                          ? preview
                          : <span style={{ fontStyle: 'italic' }}>Chưa có tin nhắn</span>}
                      </span>
                      {unread > 0 && (
                        <span className="chat-item__unread" aria-label={`${unread} tin chưa đọc`}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </aside>

      <main className="chat-main" aria-label="Nội dung cuộc trò chuyện">
        {activeConversation === null ? (
          <div className="chat-main__empty" role="status">
            <span>Chọn cuộc trò chuyện để bắt đầu</span>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <button
                className="chat-header__back"
                onClick={handleBackToList}
                type="button"
                aria-label="Quay lại danh sách"
              >
                ←
              </button>
              <div className="chat-header__avatar" aria-hidden="true">
                {activeConversation.other_user?.avatar_url ? (
                  <img
                    src={activeConversation.other_user.avatar_url}
                    alt={activeConversation.other_user.display_name}
                  />
                ) : (
                  getInitials(
                    activeConversation.other_user?.display_name ??
                      `U${getOtherUserId(activeConversation)}`,
                  )
                )}
                <span
                  className={`chat-header__presence${isOtherOnline ? ' chat-header__presence--online' : ''}`}
                  aria-hidden="true"
                />
              </div>
              <div className="chat-header__info">
                <div className="chat-header__name">
                  {activeConversation.other_user?.display_name ??
                    `Người dùng #${getOtherUserId(activeConversation)}`}
                </div>
                <div
                  className={`chat-header__status${
                    isOtherTyping
                      ? ' chat-header__status--typing'
                      : isOtherOnline
                        ? ' chat-header__status--online'
                        : ''
                  }`}
                  aria-live="polite"
                >
                  {isOtherTyping
                    ? 'đang nhập...'
                    : isOtherOnline
                      ? 'Đang hoạt động'
                      : 'Không hoạt động'}
                </div>
              </div>
              <button
                className={`chat-header__search-btn${
                  messageSearchOpen ? ' chat-header__search-btn--active' : ''
                }`}
                type="button"
                onClick={() => {
                  if (messageSearchOpen) {
                    closeMessageSearch()
                  } else {
                    setMessageSearchOpen(true)
                  }
                }}
                aria-label={
                  messageSearchOpen ? 'Đóng tìm kiếm tin nhắn' : 'Tìm kiếm tin nhắn'
                }
                title={messageSearchOpen ? 'Đóng tìm kiếm' : 'Tìm kiếm tin nhắn'}
              >
                {messageSearchOpen ? <CloseOutlined /> : <SearchOutlined />}
              </button>
            </header>

            {messageSearchOpen && (
              <section className="chat-message-search" aria-label="Tìm kiếm trong cuộc trò chuyện">
                <form className="chat-message-search__form" onSubmit={handleMessageSearch}>
                  <SearchOutlined aria-hidden="true" />
                  <input
                    autoFocus
                    type="search"
                    value={messageSearchQuery}
                    onChange={(event) => {
                      setMessageSearchQuery(event.target.value)
                      setMessageSearchError(null)
                      setMessageSearchSubmitted(false)
                    }}
                    placeholder="Nhập nội dung cần tìm..."
                    aria-label="Từ khóa tìm kiếm tin nhắn"
                  />
                  <button type="submit" disabled={messageSearchLoading}>
                    Tìm
                  </button>
                </form>
                {messageSearchError && (
                  <div className="chat-message-search__status" role="alert">
                    {messageSearchError}
                  </div>
                )}
                {messageSearchLoading ? (
                  <div className="chat-message-search__status" role="status">
                    <Spin size="small" /> Đang tìm kiếm...
                  </div>
                ) : messageSearchSubmitted && !messageSearchError ? (
                  messageSearchResults.length === 0 ? (
                    <div className="chat-message-search__status" role="status">
                      Không tìm thấy tin nhắn nào
                    </div>
                  ) : (
                    <div
                      className="chat-message-search__results"
                      role="list"
                      aria-label={`${messageSearchResults.length} kết quả tìm kiếm`}
                    >
                      {messageSearchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          role="listitem"
                          onClick={() => handleSearchResultClick(result)}
                        >
                          <span>{result.content}</span>
                          <time dateTime={result.created_at}>
                            {formatDate(result.created_at)} · {formatTime(result.created_at)}
                          </time>
                        </button>
                      ))}
                    </div>
                  )
                ) : null}
              </section>
            )}

            <div
              className="chat-messages"
              ref={messagesContainerRef}
              aria-label="Tin nhắn"
              aria-live="polite"
            >
              {hasMoreMessages && (
                <div className="chat-messages__load-more">
                  <button
                    className="chat-messages__load-btn"
                    onClick={handleLoadMore}
                    disabled={msgLoading}
                    type="button"
                  >
                    {msgLoading ? 'Đang tải...' : 'Tải thêm tin nhắn cũ'}
                  </button>
                </div>
              )}

              {msgLoading && messages.length === 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <Spin size="small" />
                </div>
              )}

              {messages.map((msg) => {
                const dateKey = getDateKey(msg.created_at)
                const showSep = dateKey !== prevDateKey
                prevDateKey = dateKey
                const own = isOwnMessage(msg)

                return (
                  <div
                    key={msg.id}
                    ref={(element) => {
                      if (element) {
                        messageElementsRef.current.set(msg.id, element)
                      } else {
                        messageElementsRef.current.delete(msg.id)
                      }
                    }}
                    className={highlightedMessageId === msg.id ? 'msg-block--highlighted' : undefined}
                    data-message-id={msg.id}
                  >
                    {showSep && (
                      <div className="chat-date-sep" aria-hidden="true">
                        <div className="chat-date-sep__line" />
                        <span className="chat-date-sep__label">
                          {formatDate(msg.created_at)}
                        </span>
                        <div className="chat-date-sep__line" />
                      </div>
                    )}
                    <div
                      className={`msg-row${own ? ' msg-row--sent' : ' msg-row--received'}`}
                      aria-label={own ? 'Tin nhắn của bạn' : 'Tin nhắn nhận được'}
                    >
                      <div className="msg">
                        {msg.image_url && !msg.has_violation && (
                          <img
                            src={msg.image_url}
                            alt="Ảnh đính kèm"
                            className="msg__image"
                            loading="lazy"
                            onLoad={() => {
                              if (Date.now() > autoScrollUntilRef.current) return
                              const container = messagesContainerRef.current
                              if (container) container.scrollTop = container.scrollHeight
                            }}
                          />
                        )}
                        <div
                          className={`msg__bubble${msg.has_violation ? ' msg__bubble--violation' : ''}`}
                        >
                          {msg.has_violation ? '[Tin nhắn vi phạm chính sách]' : msg.content}
                        </div>
                        <span className="msg__time">{formatTime(msg.created_at)}</span>
                        {own &&
                          msg.id === latestOwnMessageId &&
                          otherReadThroughId !== null &&
                          otherReadThroughId >= msg.id && (
                            <span className="msg__read-receipt">Đã xem</span>
                          )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {isOtherTyping && (
                <div className="msg-row msg-row--received" aria-label="Đang nhập">
                  <div className="msg">
                    <div className="typing-indicator" aria-hidden="true">
                      <span className="typing-indicator__dot" />
                      <span className="typing-indicator__dot" />
                      <span className="typing-indicator__dot" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-bar">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="chat-input-bar__file"
                onChange={handleImageSelect}
                aria-label="Chọn ảnh đính kèm"
              />
              <button
                className="chat-input-bar__attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploadingImage}
                type="button"
                aria-label="Đính kèm ảnh"
                title="Đính kèm ảnh"
              >
                IMG
              </button>
              {selectedImage && (
                <div className="chat-input-bar__attachment" role="status">
                  <span className="chat-input-bar__attachment-name">
                    {selectedImage.name}
                  </span>
                  <span className="chat-input-bar__attachment-size">
                    {formatFileSize(selectedImage.size)}
                  </span>
                  <button
                    type="button"
                    className="chat-input-bar__attachment-remove"
                    onClick={clearSelectedImage}
                    aria-label="Bỏ ảnh đính kèm"
                    disabled={sending || uploadingImage}
                  >
                    Xóa
                  </button>
                </div>
              )}
              <textarea
                className="chat-input-bar__textarea"
                placeholder="Nhập tin nhắn..."
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                disabled={sending}
                rows={1}
                aria-label="Nhập tin nhắn"
              />
              <button
                className="chat-input-bar__send"
                onClick={handleSend}
                disabled={sending || uploadingImage || (!inputValue.trim() && !selectedImage)}
                type="button"
                aria-label="Gửi tin nhắn"
              >
                {uploadingImage ? 'Tải...' : 'Gửi'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
