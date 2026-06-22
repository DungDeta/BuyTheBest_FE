import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/store/useAuthStore'
import { privateGet } from '@/api/api'
import type { User } from '@/types'

type PageState = 'loading' | 'error'

export function OAuthCallbackContent() {
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expiresIn = params.get('expires_in')

    if (!accessToken || !refreshToken) {
      setState('error')
      setErrorMsg('Thiếu thông tin xác thực từ Google. Vui lòng thử lại.')
      return
    }

    const store = useAuthStore.getState()
    store.setTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      access_expires_in: expiresIn ? parseInt(expiresIn, 10) : 900,
      refresh_expires_in: 604800,
    })

    privateGet<User>('/auth/me')
      .then((res) => {
        const store2 = useAuthStore.getState()
        store2.updateUser(res.data as Partial<User>)
        if (!store2.user) {
          // updateUser skips when user is null, set directly
          useAuthStore.setState({ user: res.data as User })
        }
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        setState('error')
        setErrorMsg('Không thể lấy thông tin tài khoản. Vui lòng đăng nhập lại.')
      })
  }, [navigate])

  if (state === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <p style={{ color: '#ff4d4f', fontSize: 16 }}>{errorMsg}</p>
        <a href="/login">Quay về đăng nhập</a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <Spin size="large" />
      <p>Đang xác thực tài khoản Google...</p>
    </div>
  )
}

export function Component() {
  return <OAuthCallbackContent />
}
