import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Form, Input, message } from 'antd'
import { publicPost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import './auth.css'

function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length === 0) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-zA-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  return Math.min(score, 3) as 0 | 1 | 2 | 3
}

const STRENGTH_LABELS = ['', 'Yếu', 'Trung bình', 'Mạnh']
const STRENGTH_CLASS = ['', 'weak', 'medium', 'strong']

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password)
  if (!password) return null
  return (
    <>
      <div className="auth-strength-bar">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`auth-strength-segment ${i <= strength ? STRENGTH_CLASS[strength] : ''}`}
          />
        ))}
      </div>
      <div className="auth-strength-label">{STRENGTH_LABELS[strength]}</div>
    </>
  )
}

export function Component() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')

  const handleSubmit = async (values: {
    password: string
    password_confirmation: string
  }) => {
    setLoading(true)
    try {
      await publicPost('/auth/reset-password', {
        token,
        new_password: values.password,
        confirm_password: values.password_confirmation,
      })
      message.success('Đặt lại mật khẩu thành công.')
      navigate('/login')
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e.error ?? 'Có lỗi xảy ra, thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-centered-page">
        <div className="auth-centered-card" style={{ textAlign: 'center' }}>
          <div className="auth-centered-logo">
            Buy<span>The</span>Best
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
          </p>
          <Button className="auth-submit-btn" onClick={() => navigate('/login')}>
            Về trang đăng nhập
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-centered-page">
      <div className="auth-centered-card">
        <div className="auth-centered-logo">
          Buy<span>The</span>Best
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Đặt lại mật khẩu
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>
          Nhập mật khẩu mới cho tài khoản của bạn.
        </p>

        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="password"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 8, message: 'Tối thiểu 8 ký tự' },
              {
                validator: (_, val: string) => {
                  if (!val) return Promise.resolve()
                  if (/[a-zA-Z]/.test(val) && /[0-9]/.test(val)) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Phải có cả chữ và số'))
                },
              },
            ]}
          >
            <Input.Password
              placeholder="Tối thiểu 8 ký tự, có chữ và số"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form.Item>
          <PasswordStrengthBar password={password} />

          <Form.Item
            name="password_confirmation"
            label="Xác nhận mật khẩu"
            style={{ marginTop: 8 }}
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, val: string) {
                  if (!val || getFieldValue('password') === val) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Mật khẩu không khớp'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Nhập lại mật khẩu" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button
              htmlType="submit"
              loading={loading}
              className="auth-submit-btn"
            >
              Đặt lại mật khẩu →
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}
