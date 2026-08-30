// Vite is the tool that builds and serves our app during
// development. This file configures which "plugins" (extra
// capabilities) Vite uses.
import { defineConfig } from 'vite'

// Lets our React components use JSX syntax (the HTML-like code
// inside .tsx files) and gives us fast hot-reload while coding.
import react from '@vitejs/plugin-react'

// Lets us write Tailwind's utility classes (like `bg-blue-600`,
// `p-4`) directly in our components, and Vite compiles them into
// real CSS automatically — no separate build step needed.
import tailwindcss from '@tailwindcss/vite'

// This is what actually turns the app into a PWA. It does two
// things: (1) generates manifest.json (the file that tells a phone
// "this can be installed, here's the icon/name/colors") and (2)
// builds a service worker using Workbox — Google's own well-tested
// library for this, rather than us hand-writing low-level caching
// logic ourselves, which is where most home-rolled service workers
// quietly break.
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "autoUpdate" means: when you ship a new version, the
      // service worker quietly fetches it in the background and
      // swaps it in on the next page load — no stale, stuck-on-an-
      // old-version bug where someone has to manually clear their
      // cache to see updates.
      registerType: 'autoUpdate',

      // By default, the service worker ONLY activates in a real
      // production build (npm run build), not in npm run dev — this
      // turns it on during development too, specifically so you can
      // actually test offline behavior (DevTools → Network → Offline)
      // without needing a separate build-and-preview step every time.
      devOptions: { enabled: true, type: 'module' },

      // The manifest — this is the actual JSON file a phone reads
      // to decide how to show the "Install" prompt and what the
      // installed icon/name/colors look like.
      manifest: {
        name: 'Nirvaan — Disaster Response Network',
        short_name: 'Nirvaan',
        description: 'Connects people in need with nearby volunteers, NGOs, and rescue teams during disasters.',
        // background_color matches the new teal-tinted --color-ink;
        // theme_color uses the logo's navy for browser chrome (the
        // Android status bar, etc.).
        background_color: '#eef7f6',
        theme_color: '#1c4e7c',
        display: 'standalone', // opens without browser address bar/tabs, like a real app
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // "maskable" lets Android crop the icon into a circle/
          // rounded-square/etc depending on the phone's icon shape —
          // this is a SEPARATE file with extra inset margin, since a
          // regular icon's edges would get clipped off by that crop.
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      // Controls what gets cached and how — this is the actual
      // "works offline" behavior, not just the install prompt.
      workbox: {
        // Precaches the app shell itself (JS, CSS, HTML) at install
        // time, so the app OPENS at all with no connection — without
        // this, "offline" would just show a blank white error page.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],

        runtimeCaching: [
          {
            // Map tiles — caching these means areas you've already
            // panned/zoomed to once stay visible offline afterward,
            // instead of the map going blank the moment signal drops.
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst', // once cached, reuse it instead of re-fetching every time
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
            },
          },
          {
            // Supabase API calls (database reads) — NetworkFirst
            // means "always try the real network first for fresh
            // data, but if that fails, fall back to whatever we last
            // saw" — appropriate for data that changes constantly
            // (new SOS requests), unlike map tiles which barely
            // change and are fine served straight from cache.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
            },
          },
        ],
      },
    }),
  ],
})
