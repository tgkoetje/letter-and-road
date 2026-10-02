import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getConsentChoice, initAnalytics, initConsentDefaults } from './lib/analytics'
import { initCfPageviews } from './lib/cf-pageviews'

initConsentDefaults()
initCfPageviews()
if (getConsentChoice() === 'accepted') {
  initAnalytics()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
