-- Fix the auto_assign_table_on_insert function to avoid COALESCE with set-returning functions
CREATE OR REPLACE FUNCTION public.auto_assign_table_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    target_table_number INTEGER;
    conflicting_reservation_id UUID;
BEGIN
    -- Only proceed if table assignment is null and company has auto-assignment enabled
    IF NEW.table_number IS NOT NULL OR NEW.table_numbers IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check if company has auto-assignment enabled (assuming default enabled for now)
    -- You can add a company_settings check here if needed
    
    -- Find available table by checking single table conflicts
    SELECT t.table_number INTO target_table_number
    FROM public.tables t
    WHERE t.company_id = NEW.company_id
    AND NOT EXISTS (
        SELECT 1 
        FROM public.reservations r
        WHERE r.company_id = NEW.company_id
        AND r.date = NEW.date
        AND r.status != 'cancelled'
        AND r.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (
            -- Single table conflicts
            (r.table_number = t.table_number)
            OR
            -- Multi-table conflicts  
            (r.table_numbers IS NOT NULL AND t.table_number = ANY(r.table_numbers))
        )
        AND (
            -- Time overlap check
            r.time::time <= (NEW.time::time + INTERVAL '2 hours')
            AND (r.time::time + INTERVAL '2 hours') >= NEW.time::time
        )
    )
    ORDER BY t.table_number
    LIMIT 1;
    
    -- Assign the table if found
    IF target_table_number IS NOT NULL THEN
        NEW.table_number := target_table_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;