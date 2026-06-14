import '@/pages/Public/error-pages.css'

interface NetworkErrorProps {
  onRetry?: () => void
  message?: string
}

export function NetworkError({ onRetry, message }: NetworkErrorProps) {
  return (
    <div className="network-error">
      <div className="network-error__icon">!</div>
      <p className="network-error__title">Không thể kết nối máy chủ</p>
      <p className="network-error__desc">
        {message ?? 'Kiểm tra kết nối mạng và thử lại'}
      </p>
      {onRetry && (
        <button
          type="button"
          className="error-page__btn-primary"
          onClick={onRetry}
        >
          Thử lại
        </button>
      )}
    </div>
  )
}
