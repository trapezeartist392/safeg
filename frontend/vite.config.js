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
    cssCodeSplit: true,
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'vendor-react';
          if (id.includes('node_modules/axios')) return 'vendor-axios';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('node_modules/lucide')) return 'vendor-icons';
          if (id.includes('AdminDashboard')) return 'admin';
          if (id.includes('BillingDashboard')) return 'billing';
          if (id.includes('factory-compliance')) return 'compliance';
          if (id.includes('AIMonitorPanel')) return 'ai-monitor';
          if (id.includes('safety-monitor')) return 'safety-monitor';
          if (id.includes('SignupPage')) return 'signup';
          if (id.includes('CameraHealthMonitor') || id.includes('ViolationHeatmap') || id.includes('ShiftCompliance') || id.includes('WorkerViolation') || id.includes('MultiPlant')) return 'widgets';
        }
      }
    }
  }
})
