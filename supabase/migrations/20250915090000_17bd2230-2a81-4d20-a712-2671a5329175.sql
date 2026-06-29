-- First, drop the existing function and trigger
DROP TRIGGER IF EXISTS trigger_handle_new_customer ON public.reservations;
DROP FUNCTION IF EXISTS public.handle_new_customer();

-- Create updated function for customer creation (without visit counting)
CREATE OR REPLACE FUNCTION public.handle_reservation_customer()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new function to handle completed reservations (this increments visits)
CREATE OR REPLACE FUNCTION public.handle_completed_reservation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for customer creation on reservation insert
CREATE TRIGGER trigger_handle_reservation_customer
    AFTER INSERT ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_reservation_customer();

-- Create trigger for visit counting on status update to completed
CREATE TRIGGER trigger_handle_completed_reservation
    AFTER UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_completed_reservation();