import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@ant-design/v5-patch-for-react-19'
import { ConfigProvider, App } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { router } from '@/routes/Routes'
import '@/assets/styles/global.css'

const antdTheme = {
  token: {
    colorPrimary: '#0654ba',
    borderRadius: 3,
    fontFamily: "'JetBrains Mono', ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, monospace",
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={antdTheme}>
      <App>
        <RouterProvider router={router} />
      </App>
    </ConfigProvider>
  </React.StrictMode>,
)
