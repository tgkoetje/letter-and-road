#!/usr/bin/env bash
# Query letter_and_road_pageviews via Analytics Engine SQL API.
# Requires: CF_ACCOUNT_ID, CF_API_TOKEN (Account Analytics Read)
# Usage: ./scripts/query-cf-pageviews.sh [days]
set -euo pipefail
DAYS="${1:-7}"
: "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?set CF_API_TOKEN}"

SQL=$(cat <<SQL
SELECT
  blob1 AS path,
  blob2 AS kind,
  SUM(_sample_interval) AS views
FROM letter_and_road_pageviews
WHERE timestamp >= NOW() - INTERVAL '${DAYS}' DAY
GROUP BY path, kind
ORDER BY views DESC
LIMIT 100
SQL
)

curl -sS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  --header "Authorization: Bearer ${CF_API_TOKEN}" \
  --data "$SQL"
echo
