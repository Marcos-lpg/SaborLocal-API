import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'SaborLocal - Restaurantes Locales',
        short_name: 'SaborLocal',
        description: 'Plataforma web multi-tenant offline-first para restaurantes locales',
        theme_color: '#121826',
        background_color: '#0b0f19',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^http:\/\/localhost:5037\/api\/(productos|comercios)/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'saborlocal-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})