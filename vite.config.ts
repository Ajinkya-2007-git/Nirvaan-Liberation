import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Makes the site installable and lets the app shell open with no connection.
    VitePWA({
      registerType: 'autoUpdate', // a new version replaces the old one automatically

      devOptions: { enabled: true, type: 'module' }, // lets the service worker be tried in dev too

      manifest: {
        name: 'Nirvaan — Disaster Response Network',
        short_name: 'Nirvaan',
        description: 'Connects people in need with nearby volunteers, NGOs, and rescue teams during disasters.',
        background_color: '#f5f7f4',
        theme_color: '#102f40',
        display: 'standalone', // opens like a real app, without the browser address bar
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // The app's own files are stored for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],

        runtimeCaching: [
          // Map tiles already viewed stay available offline.
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
            },
          },
          // Deliberately NO caching of database responses: they contain people's phone numbers
          // and locations, and a saved copy could be shown to the next person on a shared device.
        ],
      },
    }),
  ],
})
