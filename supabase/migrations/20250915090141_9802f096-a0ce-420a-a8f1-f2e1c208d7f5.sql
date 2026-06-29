-- Fix security warnings by setting search_path for the new functions
CREATE OR REPLACE FUNCTION public.handle_reservation_customer()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
    existing_customer_id UUID;
BEGIN
    -- Check if customer already exists
    SELECT id INTO existing_customer_id
    FROM public.customers
    WHERE company_id = NEW.company_id
      AND (email = NEW.email OR phone = NEW.phone OR name = NEW.customer_name)
    LIMIT 1;
    
    IF existing_customer_id IS NULL THEN
        -- Create new customer with visits = 0 (no visit counting yet)
        INSERT INTO public.customers (
            company_id,
            name,
            email,
            phone,
            visits,
            last_visit
        ) VALUES (
            NEW.company_id,
            NEW.customer_name,
            NEW.email,
            NEW.phone,
            0,  -- Start with 0 visits
            NULL  -- No last visit yet
        );
    ELSE
        -- Update existing customer info but don't increment visits
        UPDATE public.customers
        SET 
            name = COALESCE(NEW.customer_name, name),
            email = COALESCE(NEW.email, email),
            phone = COALESCE(NEW.phone, phone)
        WHERE id = existing_customer_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Fix security warnings by setting search_path for the completed reservation function
CREATE OR REPLACE FUNCTION public.handle_completed_reservation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
    customer_record RECORD;
BEGIN
    -- Only process if status is changing TO 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Find the customer
        SELECT id, visits INTO customer_record
        FROM public.customers
        WHERE company_id = NEW.company_id
          AND (email = NEW.email OR phone = NEW.phone OR name = NEW.customer_name)
        LIMIT 1;
        
        IF customer_record.id IS NOT NULL THEN
            -- Increment visit count and update last visit
            UPDATE public.customers
            SET 
                visits = COALESCE(visits, 0) + 1,
                last_visit = NEW.date::date
            WHERE id = customer_record.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;