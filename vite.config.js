import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Smart-comptable/',
  test: {
    exclude: ['elfatoora-middleware/**', 'backend/**', 'node_modules/**', '**/node_modules/**'],
  },
  plugins: [
    react(),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-core';
          }
          // Recharts
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
            return 'charts';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          // PDF libraries (heavy)
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) {
            return 'pdf-libs';
          }
          // PDF.js (very heavy)
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'pdfjs';
          }
          // html2canvas
          if (id.includes('node_modules/html2canvas')) {
            return 'html2canvas';
          }
          // DOMPurify
          if (id.includes('node_modules/dompurify')) {
            return 'security';
          }
          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      }
    }
  }
})
