import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor-react'
          }
          if (
            id.includes('node_modules/dayjs') ||
            id.includes('node_modules/axios') ||
            id.includes('node_modules/zustand')
          ) {
            return 'vendor-utils'
          }
          // Keep antd + icons + rc-* together to avoid circular dependency warnings.
          // antd v5 is a monolith; meaningful splitting requires dynamic imports at
          // the feature level rather than manualChunks.
          if (
            id.includes('node_modules/antd') ||
            id.includes('node_modules/@ant-design') ||
            id.includes('node_modules/rc-')
          ) {
            return 'vendor-antd'
          }
        },
      },
    },
  },
})
