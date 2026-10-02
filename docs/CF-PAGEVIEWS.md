# Cloudflare every-load pageviews — implementation (no deploy yet)

**Date:** 2026-10-01 PT  
**Choice:** CF every-load counts (not Advanced GA4 cookieless)  
**Status:** Client wired in main; gate `VITE_CF_PAGEVIEWS==='true'`. Worker deploy is separate. Set Pages Production env `VITE_CF_PAGEVIEWS=true` so rebuilds enable pings.

## What was built

1. **Worker** `letter-and-road-pageviews`  
   Path: `workers/letter-and-road-pageviews/`  
   Planned route: `letterandroad.com/api/pv*`  
   Dataset: `letter_and_road_pageviews` (Workers Analytics Engine)

2. **Client ping** `src/lib/cf-pageviews.ts`  
   Wired from `src/main.tsx` but **off unless** `VITE_CF_PAGEVIEWS=true`  
   Fires on first load + `hashchange` via `sendBeacon` / `fetch` (credentials omit)  
   No cookies, no localStorage

3. **Query helpers**  
   `scripts/query-cf-pageviews.sh`  
   `scripts/query-cf-pageviews-total.sql`

GA4 consent path (`src/lib/analytics.ts`) is unchanged.

## How counts are stored

Each hit → `PAGEVIEWS.writeDataPoint({ blobs: [path, kind, country, colo], doubles: [1], indexes: ['letterandroad'] })`.

- Stored in Cloudflare Workers Analytics Engine (time-series, sampled at scale)
- Not a running integer in KV; totals = SQL `SUM(_sample_interval)`
- Country/colo come from the edge request metadata; **IP is not written** into blobs

## How to retrieve

| Method | Where |
|--------|--------|
| SQL API | `POST https://api.cloudflare.com/client/v4/accounts/{id}/analytics_engine/sql` |
| Script | `scripts/query-cf-pageviews.sh` |
| Grafana | AE Grafana plugin (optional) |
| Worker | Health only — no public stats UI (avoids leaking traffic) |

There is **no** Cloudflare “pageviews” chart for this custom dataset until you query it (or wire Grafana). Zone **Web Analytics** / **Analytics** tabs are a separate product (see open question).

## Privacy posture (vs GA4)

| | This Worker | GA4 (current Basic) |
|--|-------------|---------------------|
| Cookies | None | After Accept only |
| Consent banner | Not gated | Required for GA |
| What we send | path/hash + kind; edge country/colo | Full GA after Accept |
| Vendor | Cloudflare (already hosts site) | Google |

About page should disclose always-on aggregate Cloudflare counts when this ships (copy not updated yet — decision item).

## Deploy checklist (blocked until asked)

- [ ] `wrangler deploy` from `workers/letter-and-road-pageviews`
- [ ] Attach route `letterandroad.com/api/pv*`
- [ ] Pages env `VITE_CF_PAGEVIEWS=true` (Production) + rebuild/deploy site
      - Client gate stays `import.meta.env.VITE_CF_PAGEVIEWS === 'true'` (empty/unset = off)
      - Set in Cloudflare Pages → Settings → Environment variables → Production
- [ ] Create API token (Account Analytics Read) for queries
- [ ] Update About privacy copy
- [ ] Confirm CSP: `connect-src 'self'` already allows same-origin `/api/pv`

## Open decisions

1. **Custom Worker vs Cloudflare Web Analytics** — Web Analytics is dashboard-native and cookieless; this Worker gives owned SQL + SPA hash paths. Ship Worker only, WA only, or both?
2. **Route ownership** — Worker route vs Pages Function under the Pages project (same code shape; Functions bind AE in Pages settings).
3. **About copy** — Exact wording for always-on CF counts vs optional GA cookies.
4. **Preview hosts** — Also route `*.pages.dev` / add origins to `ALLOWED_ORIGINS`?
