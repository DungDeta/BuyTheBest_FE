import { Empty } from 'antd'

interface PageEmptyProps {
  description?: string
}

export default function PageEmpty({ description = 'Không có dữ liệu' }: PageEmptyProps) {
  return (
    <div className="page-empty">
      <Empty description={description} />
    </div>
  )
}
