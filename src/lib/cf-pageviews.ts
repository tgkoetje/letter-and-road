/**
 * Cookieless Cloudflare page-view pings (Letter & Road).
 * Independent of GA4 consent — no cookies, no localStorage.
 *
 * Enable at build time: VITE_CF_PAGEVIEWS=true
 * Hits same-origin POST /api/pv (Worker route, not yet deployed).
 */

const ENABLED = import.meta.env.VITE_CF_PAGEVIEWS === 'true'
const ENDPOINT = '/api/pv'

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function send(kind: string) {
  if (!ENABLED || typeof window === 'undefined') return
  const payload = JSON.stringify({ path: currentPath(), kind })
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
      if (ok) return
    }
  } catch {
    /* fall through */
  }
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'omit',
    mode: 'cors',
  }).catch(() => {
    /* swallow — analytics must never break the atlas */
  })
}

let started = false

/** Call once from main.tsx. Safe no-op unless VITE_CF_PAGEVIEWS=true. */
export function initCfPageviews(): void {
  if (!ENABLED || started || typeof window === 'undefined') return
  started = true
  send('load')
  window.addEventListener('hashchange', () => send('hash'))
}

export function cfPageviewsEnabled(): boolean {
  return ENABLED
}
