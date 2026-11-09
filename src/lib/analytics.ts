/**
 * Google Analytics 4 (gtag) with Consent Mode v2.
 * Measurement IDs are public by design — not secrets.
 * Prefer VITE_GA_MEASUREMENT_ID at build time; empty disables.
 *
 * Consent:
 * - Stored accepted → grant + load gtag; hide banner
 * - Stored declined → deny; do not load (or update denied); hide banner
 * - No choice + US → grant + load immediately; show opt-out banner
 * - No choice + non-US → deny until Accept (do not load until Accept)
 *
 * Region comes from same-origin /cdn-cgi/trace (loc= only). Fail → non-US.
 */

declare global {
  interface Window {
    dataLayer: IArguments[] | unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const CONSENT_KEY = 'letter-and-road:ga-consent'
const TRACE_PATH = '/cdn-cgi/trace'
const TRACE_TIMEOUT_MS = 1500

const ENV_RAW = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
const FALLBACK_ID = 'G-LTV8ZLM4X4'

/**
 * - Env set to a G- id → use it
 * - Env set to empty / non-G → disabled (preview / opt-out builds)
 * - Env unset → production fallback id; disabled in non-prod
 */
function resolveMeasurementId(): string {
  if (ENV_RAW !== undefined) {
    const trimmed = String(ENV_RAW).trim()
    return trimmed.startsWith('G-') ? trimmed : ''
  }
  return import.meta.env.PROD ? FALLBACK_ID : ''
}

const MEASUREMENT_ID = resolveMeasurementId()

let initialized = false
let consentDefaultsSet = false

/** Module-memory region cache only — never localStorage / never log IP. */
let detectedRegion: 'US' | 'OTHER' | null = null
let regionReady = false
let regionPromise: Promise<'US' | 'OTHER'> | null = null
const regionListeners = new Set<() => void>()

export type ConsentChoice = 'accepted' | 'declined' | null

export function getConsentChoice(): ConsentChoice {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    if (v === 'accepted' || v === 'declined') return v
  } catch {
    /* ignore */
  }
  return null
}

export function isUsRegion(): boolean {
  return detectedRegion === 'US'
}

export function isRegionReady(): boolean {
  return regionReady
}

/** Subscribe once region is known (or fire immediately if already ready). */
export function subscribeRegionReady(cb: () => void): () => void {
  if (regionReady) {
    cb()
    return () => {}
  }
  regionListeners.add(cb)
  return () => {
    regionListeners.delete(cb)
  }
}

function notifyRegionReady() {
  regionReady = true
  for (const cb of [...regionListeners]) {
    try {
      cb()
    } catch {
      /* ignore */
    }
  }
  regionListeners.clear()
}

async function fetchRegion(): Promise<'US' | 'OTHER'> {
  if (typeof fetch === 'undefined') return 'OTHER'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TRACE_TIMEOUT_MS)
  try {
    const res = await fetch(TRACE_PATH, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (!res.ok) return 'OTHER'
    const text = await res.text()
    // Parse loc=XX only — do not log or store the IP or the rest of the trace.
    const match = /^loc=([A-Z]{2})$/m.exec(text)
    return match?.[1] === 'US' ? 'US' : 'OTHER'
  } catch {
    return 'OTHER'
  } finally {
    clearTimeout(timer)
  }
}

/** Resolve visitor region once; caches in module memory (not localStorage). */
export function resolveRegion(): Promise<'US' | 'OTHER'> {
  if (detectedRegion) return Promise.resolve(detectedRegion)
  if (!regionPromise) {
    regionPromise = fetchRegion().then((region) => {
      detectedRegion = region
      notifyRegionReady()
      return region
    })
  }
  return regionPromise
}

/**
 * Tracking allowed when stored accepted, or US with no decline.
 * Blocks until region is known for the US default-on path.
 */
export function isTrackingAllowed(): boolean {
  const choice = getConsentChoice()
  if (choice === 'declined') return false
  if (choice === 'accepted') return true
  return detectedRegion === 'US'
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer || []
  if (!window.gtag) {
    // Official gtag stub: push the Arguments object (not a rest array).
    // dataLayer.push(args) with rest→array breaks queued command processing.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments)
    }
  }
}

/**
 * Consent Mode defaults before any config.
 * Returning accepted visitors default to granted so collect is not G100.
 * No stored choice waits longer so /cdn-cgi/trace can finish before tags fire.
 */
export function initConsentDefaults(): void {
  if (consentDefaultsSet || typeof document === 'undefined') return
  consentDefaultsSet = true
  ensureGtagStub()
  const choice = getConsentChoice()
  window.gtag?.('consent', 'default', {
    analytics_storage: choice === 'accepted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: choice === null ? 1600 : 500,
  })
}

export function setConsentChoice(choice: 'accepted' | 'declined'): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    /* ignore */
  }
  ensureGtagStub()
  if (choice === 'accepted') {
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
    })
    // page_view fires once from script.onload (or already ran for US default-on).
    // Do not double-send here.
    initAnalytics()
  } else {
    window.gtag?.('consent', 'update', {
      analytics_storage: 'denied',
    })
  }
}

export function initAnalytics(): void {
  if (initialized || !MEASUREMENT_ID || typeof document === 'undefined') return
  if (!isTrackingAllowed()) return
  initialized = true

  ensureGtagStub()
  // Standard order: js + config, then inject script so the stub
  // Arguments-queue is drained when gtag.js boots.
  window.gtag?.('js', new Date())
  window.gtag?.('config', MEASUREMENT_ID, {
    // SPA hash routes: send explicit page_view with pathname+hash.
    send_page_view: false,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  script.onload = () => {
    // Returning visitors and first Accept / US default-on: one page_view when ready.
    trackPageView()
  }
  document.head.appendChild(script)
}

/** Track SPA hash routes as page views (path includes hash). */
export function trackPageView(pagePath?: string): void {
  if (!MEASUREMENT_ID || !window.gtag || !isTrackingAllowed()) return
  const path =
    pagePath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export function analyticsEnabled(): boolean {
  return Boolean(MEASUREMENT_ID)
}

export function analyticsMeasurementId(): string {
  return MEASUREMENT_ID
}

/**
 * After initConsentDefaults(): resolve region, then apply US default-on or stored choice.
 * Safe to call without awaiting from main — ConsentBanner waits on region ready.
 */
export async function bootstrapAnalyticsConsent(): Promise<void> {
  if (typeof document === 'undefined') return

  if (!MEASUREMENT_ID) {
    detectedRegion = 'OTHER'
    notifyRegionReady()
    return
  }

  const choice = getConsentChoice()
  if (choice === 'accepted') {
    void resolveRegion()
    initAnalytics()
    return
  }
  if (choice === 'declined') {
    void resolveRegion()
    return
  }

  const region = await resolveRegion()
  // Re-read in case the banner wrote a choice while we waited.
  if (getConsentChoice() !== null) return
  if (region === 'US') {
    ensureGtagStub()
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
    })
    initAnalytics()
  }
}
