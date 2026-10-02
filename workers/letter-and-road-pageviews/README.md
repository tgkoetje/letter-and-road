# letter-and-road-pageviews

Cookieless aggregate page-view Worker for [letterandroad.com](https://letterandroad.com/).

**Status:** implemented in repo; **not deployed**.

## What it does

- Accepts `POST /api/pv` with `{ "path": "/#/about", "kind": "load"|"hash" }`
- Writes one Analytics Engine data point (no cookies, no client IDs)
- Adds edge `country` + `colo` from the Cloudflare request (not stored as IP)
- Independent of the GA4 consent banner

## Dataset

| Binding | Dataset |
|---------|---------|
| `PAGEVIEWS` | `letter_and_road_pageviews` |

Blobs: `blob1=path`, `blob2=kind`, `blob3=country`, `blob4=colo`  
Doubles: `double1=1`  
Index: `letterandroad`

## Deploy (when Tom says go)

```bash
cd workers/letter-and-road-pageviews
npm install
npx wrangler deploy
```

Then in Cloudflare Dashboard → Workers → **letter-and-road-pageviews** → Triggers / Routes:

- `letterandroad.com/api/pv*`
- optional: `letter-and-road.pages.dev/api/pv*`

Ensure the Pages project does **not** also claim `/api/pv` (no overlapping Pages Function).

Site build: set Cloudflare Pages env `VITE_CF_PAGEVIEWS=true` and rebuild so the client pings.

## Read counts

No built-in public dashboard. Use Analytics Engine SQL API (token with **Account Analytics Read**):

```bash
export CF_ACCOUNT_ID=…
export CF_API_TOKEN=…
../../scripts/query-cf-pageviews.sh 7
```

Or Grafana: https://developers.cloudflare.com/analytics/analytics-engine/grafana/

Cloudflare dashboard GraphQL analytics can also query AE datasets.

## Health

`GET /api/pv/health` → `{ ok: true, … }`
