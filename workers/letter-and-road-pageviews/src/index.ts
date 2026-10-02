/**
 * Cookieless page-view collector for Letter & Road.
 *
 * - No cookies, no localStorage, no Client ID, no user_id
 * - Stores only coarse path/hash + country/colo (from CF edge) + count=1
 * - Independent of GA4 consent banner
 *
 * Endpoints (after route letterandroad.com/api/pv*):
 *   POST /api/pv   — record a view (JSON or empty body)
 *   OPTIONS /api/pv — CORS preflight
 *   GET  /api/pv/health — liveness
 */

export interface Env {
  PAGEVIEWS: AnalyticsEngineDataset
  ALLOWED_ORIGINS: string
}

type HitBody = {
  /** pathname + search + hash, e.g. "/#/about" — no query secrets expected */
  path?: string
  /** "load" | "hash" | "beacon" */
  kind?: string
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allow = allowedOrigins(env)
  const ok = origin && allow.has(origin) ? origin : [...allow][0] || 'https://letterandroad.com'
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function normalizePath(raw: string | undefined, fallbackUrl: URL): string {
  let p = (raw ?? `${fallbackUrl.pathname}${fallbackUrl.search}${fallbackUrl.hash}`).trim()
  if (p.length > 512) p = p.slice(0, 512)
  // Strip accidental credentials / absolute URLs down to path
  try {
    if (/^https?:/i.test(p)) {
      const u = new URL(p)
      p = `${u.pathname}${u.search}${u.hash}`
    }
  } catch {
    /* keep truncated string */
  }
  return p || '/'
}

function recordHit(env: Env, request: Request, body: HitBody) {
  const url = new URL(request.url)
  const path = normalizePath(body.path, url)
  const kind = (body.kind || 'load').slice(0, 32)
  const country = request.cf?.country ? String(request.cf.country) : 'ZZ'
  const colo = request.cf?.colo ? String(request.cf.colo) : 'UNK'

  // Field order is contractual — keep stable for SQL (blob1…blob4, double1).
  // blob1=path, blob2=kind, blob3=country, blob4=colo; double1=1
  env.PAGEVIEWS.writeDataPoint({
    blobs: [path, kind, country, colo],
    doubles: [1],
    indexes: ['letterandroad'],
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env)

    // Accept both /api/pv and bare / for workers.dev smoke tests
    const isPv =
      url.pathname === '/api/pv' ||
      url.pathname === '/api/pv/' ||
      url.pathname === '/' ||
      url.pathname === '/hit'
    const isHealth =
      url.pathname === '/api/pv/health' || url.pathname === '/health'

    if (request.method === 'OPTIONS' && isPv) {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method === 'GET' && isHealth) {
      return Response.json(
        { ok: true, service: 'letter-and-road-pageviews', dataset: 'letter_and_road_pageviews' },
        { headers: cors },
      )
    }

    if (request.method === 'POST' && isPv) {
      let body: HitBody = {}
      const ct = request.headers.get('Content-Type') || ''
      try {
        if (ct.includes('application/json')) {
          body = (await request.json()) as HitBody
        } else if (ct.includes('text/plain') || ct.includes('application/x-www-form-urlencoded')) {
          const text = await request.text()
          try {
            body = JSON.parse(text) as HitBody
          } catch {
            body = { path: text || undefined }
          }
        }
      } catch {
        body = {}
      }
      recordHit(env, request, body)
      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not found', { status: 404, headers: cors })
  },
}
