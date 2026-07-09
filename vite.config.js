import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Smart-comptable/',
  test: {
    exclude: ['elfatoora-middleware/**', 'backend/**', 'node_modules/**', '**/node_modules/**'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons.svg', 'favicon.svg'],
      manifest: {
        name: 'Smart Comptable — Comptabilité Tunisienne',
        short_name: 'Smart Compta',
        description: 'Comptabilité tunisienne automatisée : facturation TEIF, TVA, IRPP, IS, paie, OCR',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        lang: 'fr',
        start_url: '/Smart-comptable/app.html',
        scope: '/Smart-comptable/',
        icons: [
          { src: '/Smart-comptable/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/Smart-comptable/logo.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        globIgnores: ['**/tesseract/**', 'landing.html', 'mentions-legales.html', 'app.html'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/Smart-comptable/app.html',
        navigateFallbackDenylist: [/^\/Smart-comptable\/(?!app)/],
      },
    }),
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
          // Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
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
