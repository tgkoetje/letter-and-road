-- Total views last 7 days (account for sampling)
SELECT SUM(_sample_interval) AS views
FROM letter_and_road_pageviews
WHERE timestamp >= NOW() - INTERVAL '7' DAY;

-- Views per day
SELECT
  toStartOfDay(timestamp) AS day,
  SUM(_sample_interval) AS views
FROM letter_and_road_pageviews
WHERE timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day;
