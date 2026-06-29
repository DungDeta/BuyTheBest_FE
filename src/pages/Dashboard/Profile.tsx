import { useEffect, useState } from 'react'
import { App, Button, Input, Spin } from 'antd'
import { privateGet, privatePut, privatePost } from '@/api/api'
import { useAuthStore } from '@/store/useAuthStore'
import type { User, TokenResponse } from '@/types/user'
import type { ErrorResponse } from '@/types/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import './profile.css'

interface UserResponse {
  user: User
}

interface PasswordChangeResponse {
  token: TokenResponse
}

interface SellerProfile {
  user_id?: number
  shop_name: string
  description: string
  shipping_policy: string
  return_policy: string
  avatar_url?: string | null
  banner_url?: string | null
  bank_account?: string | null
  bank_name?: string | null
  updated_at?: string
}

interface SellerUpgradeResponse {
  user: User
  profile: SellerProfile
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

interface PersonalInfoProps {
  user: User
}

function PersonalInfoSection({ user }: PersonalInfoProps) {
  const { message } = App.useApp()
  const updateUser = useAuthStore((s) => s.updateUser)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState(user.display_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [address, setAddress] = useState(user.address ?? '')

  function handleEdit() {
    setDisplayName(user.display_name)
    setPhone(user.phone ?? '')
    setAddress(user.address ?? '')
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
  }

  async function handleSave() {
    if (!displayName.trim()) {
      message.error('Tên hiển thị không được để trống')
      return
    }
    setSaving(true)
    try {
      const res = await privatePut<UserResponse>('/me/profile', {
        display_name: displayName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      if (res.data?.user) {
        updateUser(res.data.user)
      }
      message.success('Cập nhật thông tin thành công')
      setEditing(false)
    } catch {
      message.error('Không thể cập nhật thông tin')
    } finally {
      setSaving(false)
    }
  }

  const initials = getInitials(user.display_name)

  return (
    <section className="profile-section" aria-labelledby="personal-info-title">
      <div className="profile-section__header">
        <h2 className="profile-section__header-title" id="personal-info-title">
          Thông tin cá nhân
        </h2>
        {!editing && (
          <Button size="small" onClick={handleEdit} type="default">
            Chỉnh sửa
          </Button>
        )}
      </div>

      <div className="profile-avatar-row">
        <div
          className="profile-avatar"
          aria-label={`Ảnh đại diện của ${user.display_name}`}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name} />
          ) : (
            initials
          )}
        </div>
        <div className="profile-avatar-meta">
          <span className="profile-avatar-name">{user.display_name}</span>
          <span className="profile-avatar-email">{user.email}</span>
          {user.is_seller && (
            <span className="profile-seller-badge">Người bán</span>
          )}
        </div>
      </div>

      {editing ? (
        <div className="profile-form" role="form" aria-label="Chỉnh sửa thông tin cá nhân">
          <div className="profile-form-row">
            <div className="profile-form-group">
              <label className="profile-form-label" htmlFor="display-name">
                Tên hiển thị
              </label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                placeholder="Nhập tên hiển thị"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="profile-form-group">
              <label className="profile-form-label" htmlFor="phone">
                Số điện thoại
              </label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={15}
                placeholder="+84 hoặc 0xxx"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
          <div className="profile-form-group profile-form-group--full">
            <label className="profile-form-label" htmlFor="address">
              Địa chỉ
            </label>
            <Input.TextArea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Nhập địa chỉ"
              style={{ fontFamily: 'var(--font-mono)', resize: 'none' }}
            />
          </div>
          <div className="profile-form-actions">
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              disabled={saving}
            >
              Lưu
            </Button>
            <Button onClick={handleCancel} disabled={saving}>
              Huỷ
            </Button>
          </div>
        </div>
      ) : (
        <div className="profile-info-grid">
          <div className="profile-field">
            <span className="profile-field__label">Email</span>
            <span className="profile-field__value">{user.email}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field__label">Số điện thoại</span>
            <span
              className={`profile-field__value${!user.phone ? ' profile-field__value--empty' : ''}`}
            >
              {user.phone ?? 'Chưa cập nhật'}
            </span>
          </div>
          <div className="profile-field profile-field--full">
            <span className="profile-field__label">Địa chỉ</span>
            <span
              className={`profile-field__value${!user.address ? ' profile-field__value--empty' : ''}`}
            >
              {user.address ?? 'Chưa cập nhật'}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

function PasswordSection() {
  const { message } = App.useApp()
  const setTokens = useAuthStore((s) => s.setTokens)

  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function clearForm() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleSave() {
    if (!currentPassword) {
      message.error('Vui lòng nhập mật khẩu hiện tại')
      return
    }
    if (newPassword.length < 8) {
      message.error('Mật khẩu mới phải có ít nhất 8 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      message.error('Mật khẩu xác nhận không khớp')
      return
    }
    setSaving(true)
    try {
      const res = await privatePut<PasswordChangeResponse>('/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      if (res.data?.token) {
        setTokens(res.data.token)
      }
      message.success('Đổi mật khẩu thành công')
      clearForm()
    } catch {
      message.error('Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="profile-section" aria-labelledby="password-title">
      <div className="profile-section__title" id="password-title">
        Đổi mật khẩu
      </div>
      <div className="profile-pw-form" role="form" aria-label="Đổi mật khẩu">
        <div className="profile-form-group">
          <label className="profile-form-label" htmlFor="current-password">
            Mật khẩu hiện tại
          </label>
          <Input.Password
            id="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Nhập mật khẩu hiện tại"
            style={{ fontFamily: 'var(--font-mono)' }}
            autoComplete="current-password"
          />
        </div>
        <div className="profile-form-group">
          <label className="profile-form-label" htmlFor="new-password">
            Mật khẩu mới
          </label>
          <Input.Password
            id="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Tối thiểu 8 ký tự"
            style={{ fontFamily: 'var(--font-mono)' }}
            autoComplete="new-password"
          />
        </div>
        <div className="profile-form-group">
          <label className="profile-form-label" htmlFor="confirm-password">
            Xác nhận mật khẩu mới
          </label>
          <Input.Password
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            style={{ fontFamily: 'var(--font-mono)' }}
            autoComplete="new-password"
          />
        </div>
        <div className="profile-form-actions">
          <Button
            type="primary"
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            Đổi mật khẩu
          </Button>
        </div>
      </div>
    </section>
  )
}

function SellerUpgradeSection() {
  const { message } = App.useApp()
  const updateUser = useAuthStore((s) => s.updateUser)

  const [saving, setSaving] = useState(false)
  const [shopName, setShopName] = useState('')
  const [description, setDescription] = useState('')
  const [shippingPolicy, setShippingPolicy] = useState('')
  const [returnPolicy, setReturnPolicy] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')

  async function handleSubmit() {
    if (!shopName.trim()) {
      message.error('Vui lòng nhập tên cửa hàng')
      return
    }
    if (!description.trim()) {
      message.error('Vui lòng nhập mô tả cửa hàng')
      return
    }
    if (!shippingPolicy.trim()) {
      message.error('Vui lòng nhập chính sách vận chuyển')
      return
    }
    if (!returnPolicy.trim()) {
      message.error('Vui lòng nhập chính sách đổi trả')
      return
    }
    setSaving(true)
    try {
      const res = await privatePost<SellerUpgradeResponse>('/me/seller-upgrade', {
        shop_name: shopName.trim(),
        description: description.trim(),
        shipping_policy: shippingPolicy.trim(),
        return_policy: returnPolicy.trim(),
        bank_account: bankAccount.trim() || undefined,
        bank_name: bankName.trim() || undefined,
      })
      if (res.data?.user) {
        updateUser(res.data.user)
      } else {
        updateUser({ is_seller: true })
      }
      message.success('Đăng ký bán hàng thành công!')
    } catch {
      message.error('Không thể đăng ký bán hàng. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="profile-section" aria-labelledby="seller-upgrade-title">
      <div className="profile-section__title" id="seller-upgrade-title">
        Đăng ký bán hàng
      </div>
      <div className="profile-seller-form" role="form" aria-label="Đăng ký bán hàng">
        <div className="profile-seller-form-row">
          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="shop-name">
              Tên cửa hàng <span aria-hidden="true">*</span>
            </label>
            <Input
              id="shop-name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              maxLength={80}
              placeholder="Tên cửa hàng của bạn"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="bank-name">
              Ngân hàng
            </label>
            <Input
              id="bank-name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              maxLength={100}
              placeholder="VD: Vietcombank"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>
        <div className="profile-form-group">
          <label className="profile-form-label" htmlFor="bank-account">
            Số tài khoản ngân hàng
          </label>
          <Input
            id="bank-account"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            maxLength={30}
            placeholder="Số tài khoản"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div className="profile-form-group">
          <label className="profile-form-label" htmlFor="seller-description">
            Mô tả cửa hàng <span aria-hidden="true">*</span>
          </label>
          <Input.TextArea
            id="seller-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Giới thiệu về cửa hàng của bạn"
            style={{ fontFamily: 'var(--font-mono)', resize: 'none' }}
          />
        </div>
        <div className="profile-form-group">
          <label className="profile-form-label" htmlFor="seller-shipping-policy">
            Chính sách vận chuyển <span aria-hidden="true">*</span>
          </label>
          <Input.TextArea
            id="seller-shipping-policy"
            value={shippingPolicy}
            onChange={(e) => setShippingPolicy(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Mô tả chính sách vận chuyển"
            style={{ fontFamily: 'var(--font-mono)', resize: 'none' }}
          />
        </div>
        <div className="profile-form-group">
          <label className="profile-form-label" htmlFor="seller-return-policy">
            Chính sách đổi trả <span aria-hidden="true">*</span>
          </label>
          <Input.TextArea
            id="seller-return-policy"
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Mô tả chính sách đổi trả"
            style={{ fontFamily: 'var(--font-mono)', resize: 'none' }}
          />
        </div>
        <div className="profile-form-actions">
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={saving}
            disabled={saving}
          >
            Đăng ký bán hàng
          </Button>
        </div>
      </div>
    </section>
  )
}

interface SellerProfileSectionProps {
  profile: SellerProfile
  onUpdated: (profile: SellerProfile) => void
}

function SellerProfileSection({ profile, onUpdated }: SellerProfileSectionProps) {
  const { message } = App.useApp()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shopName, setShopName] = useState(profile.shop_name)
  const [description, setDescription] = useState(profile.description)
  const [shippingPolicy, setShippingPolicy] = useState(profile.shipping_policy)
  const [returnPolicy, setReturnPolicy] = useState(profile.return_policy)

  function resetForm() {
    setShopName(profile.shop_name)
    setDescription(profile.description)
    setShippingPolicy(profile.shipping_policy)
    setReturnPolicy(profile.return_policy)
  }

  function handleEdit() {
    resetForm()
    setEditing(true)
  }

  function handleCancel() {
    resetForm()
    setEditing(false)
  }

  async function handleSave() {
    const normalizedShopName = shopName.trim()
    if (normalizedShopName.length < 2) {
      message.error('Tên cửa hàng phải có ít nhất 2 ký tự')
      return
    }
    setSaving(true)
    try {
      const res = await privatePut<SellerProfile>('/me/seller-profile', {
        shop_name: normalizedShopName,
        description: description.trim(),
        shipping_policy: shippingPolicy.trim(),
        return_policy: returnPolicy.trim(),
      })
      onUpdated(res.data)
      message.success('Cập nhật hồ sơ cửa hàng thành công')
      setEditing(false)
    } catch (err) {
      const apiError = err as ErrorResponse
      message.error(apiError.error || 'Không thể cập nhật hồ sơ cửa hàng')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="profile-section" aria-labelledby="seller-profile-title">
      <div className="profile-section__header">
        <h2 className="profile-section__header-title" id="seller-profile-title">
          Hồ sơ cửa hàng
        </h2>
        {!editing && (
          <Button size="small" onClick={handleEdit}>
            Chỉnh sửa
          </Button>
        )}
      </div>

      {editing ? (
        <div className="profile-seller-form" role="form" aria-label="Chỉnh sửa hồ sơ cửa hàng">
          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="edit-shop-name">
              Tên cửa hàng
            </label>
            <Input
              id="edit-shop-name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              maxLength={80}
              showCount
              placeholder="Tên cửa hàng"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="edit-description">
              Mô tả cửa hàng
            </label>
            <Input.TextArea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              showCount
              placeholder="Giới thiệu ngắn gọn về cửa hàng"
              style={{ fontFamily: 'var(--font-mono)', resize: 'vertical' }}
            />
          </div>
          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="edit-shipping-policy">
              Chính sách vận chuyển
            </label>
            <Input.TextArea
              id="edit-shipping-policy"
              value={shippingPolicy}
              onChange={(e) => setShippingPolicy(e.target.value)}
              maxLength={1000}
              rows={3}
              showCount
              placeholder="Phạm vi, thời gian và chi phí vận chuyển"
              style={{ fontFamily: 'var(--font-mono)', resize: 'vertical' }}
            />
          </div>
          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="edit-return-policy">
              Chính sách đổi trả
            </label>
            <Input.TextArea
              id="edit-return-policy"
              value={returnPolicy}
              onChange={(e) => setReturnPolicy(e.target.value)}
              maxLength={1000}
              rows={3}
              showCount
              placeholder="Điều kiện và thời hạn đổi trả"
              style={{ fontFamily: 'var(--font-mono)', resize: 'vertical' }}
            />
          </div>
          <div className="profile-form-actions">
            <Button
              type="primary"
              onClick={() => void handleSave()}
              loading={saving}
              disabled={saving}
            >
              Lưu thay đổi
            </Button>
            <Button onClick={handleCancel} disabled={saving}>
              Huỷ
            </Button>
          </div>
        </div>
      ) : (
        <div className="profile-info-grid">
          <div className="profile-field profile-field--full">
            <span className="profile-field__label">Tên cửa hàng</span>
            <span className="profile-field__value">{profile.shop_name}</span>
          </div>
          <div className="profile-field profile-field--full">
            <span className="profile-field__label">Mô tả</span>
            <span className={profile.description ? 'profile-field__value' : 'profile-field__value profile-field__value--empty'}>
              {profile.description || 'Chưa cập nhật'}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-field__label">Chính sách vận chuyển</span>
            <span className={profile.shipping_policy ? 'profile-field__value' : 'profile-field__value profile-field__value--empty'}>
              {profile.shipping_policy || 'Chưa cập nhật'}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-field__label">Chính sách đổi trả</span>
            <span className={profile.return_policy ? 'profile-field__value' : 'profile-field__value profile-field__value--empty'}>
              {profile.return_policy || 'Chưa cập nhật'}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

export function Component() {
  useDocumentTitle('Hồ sơ cá nhân')
  const user = useAuthStore((s) => s.user)
  const seller = useAuthStore((s) => s.user?.is_seller ?? false)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
  const [loadingSellerProfile, setLoadingSellerProfile] = useState(false)
  const [sellerProfileError, setSellerProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (!seller) {
      setSellerProfile(null)
      setSellerProfileError(null)
      return
    }

    let cancelled = false
    async function loadSellerProfile() {
      setLoadingSellerProfile(true)
      setSellerProfileError(null)
      try {
        const res = await privateGet<SellerProfile>('/me/seller-profile')
        if (!cancelled) setSellerProfile(res.data)
      } catch (err) {
        if (!cancelled) {
          const apiError = err as ErrorResponse
          setSellerProfileError(apiError.error || 'Không thể tải hồ sơ cửa hàng')
        }
      } finally {
        if (!cancelled) setLoadingSellerProfile(false)
      }
    }

    void loadSellerProfile()
    return () => {
      cancelled = true
    }
  }, [seller])

  if (!user) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', padding: 80 }}
        aria-label="Đang tải"
      >
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <h1 className="profile-page__title">Hồ sơ của tôi</h1>

      <PersonalInfoSection user={user} />

      <PasswordSection />

      {seller ? (
        loadingSellerProfile ? (
          <section className="profile-section" aria-label="Đang tải hồ sơ cửa hàng">
            <div className="profile-section-loading">
              <Spin />
            </div>
          </section>
        ) : sellerProfileError || !sellerProfile ? (
          <section className="profile-section" aria-labelledby="seller-profile-error-title">
            <div className="profile-section__title" id="seller-profile-error-title">
              Hồ sơ cửa hàng
            </div>
            <p className="profile-section-error">
              {sellerProfileError || 'Không tìm thấy hồ sơ cửa hàng'}
            </p>
          </section>
        ) : (
          <SellerProfileSection
            profile={sellerProfile}
            onUpdated={setSellerProfile}
          />
        )
      ) : (
        <SellerUpgradeSection />
      )}
    </div>
  )
}
