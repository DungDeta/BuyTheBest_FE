import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Form, Input, message } from 'antd'
import { publicPost } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './auth.css'

export function Component() {
  useDocumentTitle('Quên mật khẩu')
  const [loading, setLoading] = useState(false)
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true)
    try {
      await publicPost('/auth/forgot-password', { email: values.email })
      setSentEmail(values.email)
      message.success('Đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra email.')
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e.error ?? 'Không thể gửi link đặt lại mật khẩu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-centered-page">
      <div className="auth-centered-card">
        <div className="auth-centered-logo">
          Buy<em>The</em>Best
        </div>

        {sentEmail ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              Kiểm tra email
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>
              Nếu {sentEmail} tồn tại trong hệ thống, chúng tôi đã gửi đường dẫn đặt lại mật khẩu.
            </p>
            <Link to="/login">
              <Button className="auth-submit-btn">Về trang đăng nhập</Button>
            </Link>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              Quên mật khẩu
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>
              Nhập email đã đăng ký. Hệ thống sẽ gửi link để bạn đặt lại mật khẩu.
            </p>

            <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' },
                ]}
              >
                <Input placeholder="ban@example.com" autoComplete="email" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <Button htmlType="submit" loading={loading} className="auth-submit-btn">
                  Gửi link đặt lại →
                </Button>
              </Form.Item>
            </Form>

            <div style={{ marginTop: 18, fontSize: 13, textAlign: 'center' }}>
              <Link to="/login">Quay lại đăng nhập</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
