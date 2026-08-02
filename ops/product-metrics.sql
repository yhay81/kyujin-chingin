SELECT
  COUNT(DISTINCT CASE WHEN is_qa=0 THEN session_hash END) AS users,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name IN ('searched','no_result') THEN session_hash END) AS searchers,
  COUNT(CASE WHEN is_qa=0 AND event_name='searched' THEN 1 END) AS successful_searches,
  COUNT(CASE WHEN is_qa=0 AND event_name='no_result' THEN 1 END) AS no_result_searches,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='region_changed' THEN session_hash END) AS region_changers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='sort_changed' THEN session_hash END) AS sort_changers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='filter_changed' THEN session_hash END) AS filter_changers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='compared' THEN session_hash END) AS comparers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='copied' THEN session_hash END) AS copiers,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='compared' AND created_at>=unixepoch()-7*86400 THEN session_hash END) AS comparers_7d,
  COUNT(DISTINCT CASE WHEN is_qa=0 AND event_name='copied' AND created_at>=unixepoch()-7*86400 THEN session_hash END) AS copiers_7d,
  COUNT(CASE WHEN is_qa=1 THEN 1 END) AS qa_rows
FROM product_events;
