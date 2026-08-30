import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Importing this file runs i18n.init() once, before the app renders
// — every component can then call useTranslation() without any
// further setup.
import './i18n'
// "virtual:pwa-register" is a special import that only exists
// because of the VitePWA plugin we configured in vite.config.ts —
// it doesn't point to a real file, Vite generates it. Calling
// registerSW() is what actually activates the service worker in the
// browser; without this line, the service worker file would exist
// but never actually run.
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
