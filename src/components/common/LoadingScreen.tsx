import { Spin } from 'antd'

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Spin size="large" />
    </div>
  )
}
