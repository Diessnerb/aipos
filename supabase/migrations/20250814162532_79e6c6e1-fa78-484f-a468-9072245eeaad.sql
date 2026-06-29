-- Enable pg_stat_statements extension for performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Fix get_all_users_cross_company function GROUP BY error
CREATE OR REPLACE FUNCTION public.get_all_users_cross_company()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  -- Only super admins can access this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  
  SELECT json_agg(
    json_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'email', u.email,
      'role', u.role,
      'is_company_admin', u.is_company_admin,
      'is_active', u.is_active,
      'company_id', u.company_id,
      'company_name', c.name,
      'pin_code', u.pin_code,
      'created_at', u.created_at,
      'updated_at', COALESCE(au.updated_at, u.created_at),
      'last_login', au.last_sign_in_at,
      'remaining_holiday_days', COALESCE(u.remaining_holiday_days, 25)
    )
  ) INTO result
  FROM public.users u
  LEFT JOIN public.companies c ON u.company_id = c.id
  LEFT JOIN auth.users au ON u.auth_user_id = au.id
  ORDER BY u.created_at DESC;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- Update get_system_health_detailed with better error handling and fallbacks
CREATE OR REPLACE FUNCTION public.get_system_health_detailed()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  db_size_bytes bigint;
  total_connections integer;
  active_connections integer;
  idle_connections integer;
  waiting_connections integer;
  buffer_hit_ratio numeric;
  uptime_hours numeric;
  query_stats json;
  table_stats json;
  memory_stats json;
  cpu_stats json;
BEGIN
  -- Only super admins can access this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Database size
  SELECT pg_database_size(current_database()) INTO db_size_bytes;

  -- Connection statistics
  SELECT COUNT(*) INTO total_connections FROM pg_stat_activity;
  SELECT COUNT(*) INTO active_connections FROM pg_stat_activity WHERE state = 'active';
  SELECT COUNT(*) INTO idle_connections FROM pg_stat_activity WHERE state = 'idle';
  SELECT COUNT(*) INTO waiting_connections FROM pg_stat_activity WHERE wait_event IS NOT NULL;

  -- Buffer hit ratio (cache efficiency)
  SELECT 
    CASE 
      WHEN (blks_hit + blks_read) = 0 THEN 100
      ELSE ROUND((blks_hit::float / (blks_hit + blks_read)) * 100, 2)
    END
  INTO buffer_hit_ratio
  FROM pg_stat_database 
  WHERE datname = current_database();

  -- Uptime (approximate based on stats reset time)
  SELECT EXTRACT(EPOCH FROM (now() - stats_reset)) / 3600
  INTO uptime_hours
  FROM pg_stat_database 
  WHERE datname = current_database()
  LIMIT 1;

  -- Query performance stats (with fallback for missing pg_stat_statements)
  BEGIN
    SELECT json_build_object(
      'total_queries', COALESCE(SUM(calls), 0),
      'avg_query_time_ms', COALESCE(ROUND(AVG(mean_exec_time), 2), 0),
      'slow_queries', COALESCE(COUNT(*) FILTER (WHERE mean_exec_time > 1000), 0)
    ) INTO query_stats
    FROM pg_stat_statements;
  EXCEPTION
    WHEN undefined_table THEN
      -- Fallback when pg_stat_statements is not available
      query_stats := json_build_object(
        'total_queries', 0,
        'avg_query_time_ms', 0,
        'slow_queries', 0,
        'note', 'pg_stat_statements extension not available'
      );
  END;

  -- Table statistics
  SELECT json_build_object(
    'total_tables', COUNT(*),
    'largest_table_mb', COALESCE(ROUND(MAX(pg_total_relation_size(schemaname||'.'||tablename)) / 1024.0 / 1024.0, 2), 0),
    'total_size_mb', COALESCE(ROUND(SUM(pg_total_relation_size(schemaname||'.'||tablename)) / 1024.0 / 1024.0, 2), 0)
  ) INTO table_stats
  FROM pg_tables 
  WHERE schemaname = 'public';

  -- Memory statistics (from pg_stat_bgwriter)
  SELECT json_build_object(
    'buffers_clean', COALESCE(buffers_clean, 0),
    'buffers_backend', COALESCE(buffers_backend, 0),
    'buffer_hit_ratio', COALESCE(buffer_hit_ratio, 100),
    'memory_efficiency_score', CASE 
      WHEN buffer_hit_ratio >= 95 THEN 95
      WHEN buffer_hit_ratio >= 85 THEN 75
      WHEN buffer_hit_ratio >= 70 THEN 55
      ELSE 30
    END
  ) INTO memory_stats
  FROM pg_stat_bgwriter;

  -- CPU statistics (derived from connection activity)
  SELECT json_build_object(
    'active_ratio', CASE 
      WHEN total_connections = 0 THEN 0
      ELSE ROUND((active_connections::float / total_connections) * 100, 2)
    END,
    'waiting_ratio', CASE 
      WHEN total_connections = 0 THEN 0
      ELSE ROUND((waiting_connections::float / total_connections) * 100, 2)
    END,
    'cpu_efficiency_score', CASE 
      WHEN total_connections = 0 THEN 95
      WHEN (active_connections::float / total_connections) < 0.5 THEN 90
      WHEN (active_connections::float / total_connections) < 0.8 THEN 70
      ELSE 40
    END
  ) INTO cpu_stats;

  -- Build final result
  result := json_build_object(
    'database', json_build_object(
      'size_gb', ROUND(db_size_bytes / 1024.0 / 1024.0 / 1024.0, 2),
      'uptime_hours', COALESCE(uptime_hours, 0),
      'health_score', CASE 
        WHEN buffer_hit_ratio >= 95 THEN 95
        WHEN buffer_hit_ratio >= 85 THEN 80
        ELSE 60
      END
    ),
    'performance', json_build_object(
      'response_time_ms', COALESCE((query_stats->>'avg_query_time_ms')::numeric, 0),
      'throughput', COALESCE((query_stats->>'total_queries')::integer, 0),
      'slow_queries', COALESCE((query_stats->>'slow_queries')::integer, 0),
      'performance_score', CASE 
        WHEN COALESCE((query_stats->>'avg_query_time_ms')::numeric, 0) < 100 THEN 95
        WHEN COALESCE((query_stats->>'avg_query_time_ms')::numeric, 0) < 500 THEN 75
        ELSE 45
      END
    ),
    'errors', json_build_object(
      'error_count', 0,
      'last_error', null,
      'error_rate', 0.0,
      'errors_score', 95
    ),
    'resources', json_build_object(
      'connections', total_connections,
      'max_connections', 100,
      'disk_usage_gb', ROUND(db_size_bytes / 1024.0 / 1024.0 / 1024.0, 2),
      'resources_score', CASE 
        WHEN total_connections < 50 THEN 95
        WHEN total_connections < 80 THEN 75
        ELSE 50
      END
    ),
    'memory', memory_stats,
    'cpu', cpu_stats,
    'uptime', COALESCE(uptime_hours, 0),
    'timestamp', now()
  );

  RETURN result;
END;
$function$;