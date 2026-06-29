-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on customer_name for faster fuzzy matching
CREATE INDEX IF NOT EXISTS idx_reservations_customer_name_gin 
ON public.reservations USING GIN (customer_name gin_trgm_ops);

-- Create fuzzy search function for reservations
CREATE OR REPLACE FUNCTION public.search_reservations_fuzzy(
    p_company_id UUID,
    p_date DATE,
    p_time TIME,
    p_customer_name TEXT,
    p_similarity_threshold FLOAT DEFAULT 0.3,
    p_time_window_minutes INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    company_id UUID,
    customer_name TEXT,
    email TEXT,
    phone TEXT,
    party_size INTEGER,
    date DATE,
    "time" TIME,
    status TEXT,
    table_number INTEGER,
    table_numbers INTEGER[],
    notes TEXT,
    special_requests TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    start_time TIME,
    end_time TIME,
    similarity_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    start_time_window TIME;
    end_time_window TIME;
BEGIN
    -- Calculate time window
    start_time_window := p_time - (p_time_window_minutes || ' minutes')::INTERVAL;
    end_time_window := p_time + (p_time_window_minutes || ' minutes')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        r.id,
        r.company_id,
        r.customer_name,
        r.email,
        r.phone,
        r.party_size,
        r.date,
        r."time",
        r.status,
        r.table_number,
        r.table_numbers,
        r.notes,
        r.special_requests,
        r.created_at,
        r.updated_at,
        r.start_time,
        r.end_time,
        similarity(r.customer_name, p_customer_name) as similarity_score
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r."time" BETWEEN start_time_window AND end_time_window
      AND r.status NOT IN ('cancelled', 'no-show')
      AND similarity(r.customer_name, p_customer_name) >= p_similarity_threshold
    ORDER BY similarity(r.customer_name, p_customer_name) DESC, r."time" ASC
    LIMIT p_limit;
END;
$$;