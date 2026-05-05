import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-axios':  ['axios'],
          'vendor-charts': ['recharts'],
          'admin':         ['./src/pages/admin/AdminDashboard.jsx'],
          'billing':       ['./src/pages/payment/BillingDashboard.jsx'],
          'compliance':    ['./src/components/factory-compliance.jsx'],
          'ai-monitor':    ['./src/components/AIMonitorPanel.jsx'],
        }
      }
    }
  }
})