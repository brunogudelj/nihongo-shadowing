import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Na GitHub Pages stranica živi na /nihongo-shadowing/, u Codespaceu na /.
  base: command === 'build' ? '/nihongo-shadowing/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    // Manifest (ime, ikona) i service worker koji sprema sve za rad bez interneta.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Nihongo Shadowing',
        short_name: 'Shadowing',
        description: 'Učenje japanskog govora kroz shadowing',
        lang: 'hr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#fafaf9',
        background_color: '#fafaf9',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mp3}'],
        // Izgovor riječi i oblika (tisuće malih mp3) ne sprema se odmah, nego svaki kad se prvi put pusti.
        globIgnores: ['**/izgovor/**'],
        runtimeCaching: [
          {
            urlPattern: /\/izgovor\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: { cacheName: 'izgovor', cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
}))
