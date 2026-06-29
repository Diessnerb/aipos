-- Fix critical security issues identified by the linter

-- Enable RLS on tables that have policies but RLS is disabled
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_logs ENABLE ROW LEVEL SECURITY;

-- Fix all functions missing SET search_path
CREATE OR REPLACE FUNCTION public.set_reservation_times()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  new.start_time := new.time;
  new.end_time := new.time + interval '90 minutes';
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.calculate_shift_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate times
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    IF NEW.end_time < NEW.start_time THEN
      RAISE EXCEPTION 'End time cannot be before start time';
    END IF;

    -- Calculate duration in decimal hours
    NEW.duration_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_user_to_all_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Add the new user to all existing channels
  INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
  SELECT 
    c.id as channel_id,
    NEW.id as user_id,
    CASE 
      WHEN c.is_read_only = true AND NEW.role NOT IN ('manager', 'admin') THEN false
      ELSE true
    END as can_write
  FROM public.channels c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel_memberships cm 
    WHERE cm.channel_id = c.id AND cm.user_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_all_users_to_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Add all existing users to the new channel
  INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
  SELECT 
    NEW.id as channel_id,
    u.id as user_id,
    CASE 
      WHEN NEW.is_read_only = true AND u.role NOT IN ('manager', 'admin') THEN false
      ELSE true
    END as can_write
  FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel_memberships cm 
    WHERE cm.channel_id = NEW.id AND cm.user_id = u.id
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_holiday_days_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  days_requested integer;
BEGIN
  -- Only run on status update to Approved, and only transition from NOT Approved to Approved
  IF NEW.status = 'Approved' AND OLD.status IS DISTINCT FROM NEW.status AND OLD.status IS DISTINCT FROM 'Approved' THEN
    IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
      days_requested := (NEW.end_date - NEW.start_date) + 1;
      IF days_requested > 0 THEN
        -- Remove GREATEST constraint to allow negative balances
        UPDATE public.users
        SET remaining_holiday_days = remaining_holiday_days - days_requested
        WHERE id = NEW.user_id;

        -- Log deduction for audit/debugging
        INSERT INTO public.holiday_deduction_log(holiday_request_id, user_id, deducted_days)
        VALUES (NEW.id, NEW.user_id, days_requested);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_reservation_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  -- Only set defaults for new reservations (INSERT), not updates
  if TG_OP = 'INSERT' then
    new.start_time := new.time;
    new.end_time := new.time + interval '90 minutes';
    new.status := 'confirmed';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only set created_by if the column exists and is not already set
  IF TG_TABLE_NAME = 'orders' THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_customer_id uuid;
BEGIN
  -- First check if customer exists by phone number (primary identifier)
  SELECT id INTO existing_customer_id
  FROM customers 
  WHERE phone = NEW.phone AND phone IS NOT NULL AND phone != '';

  -- If no match by phone, check by email as fallback
  IF existing_customer_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO existing_customer_id
    FROM customers 
    WHERE email = NEW.email;
  END IF;

  IF existing_customer_id IS NOT NULL THEN
    -- Customer exists, update their visit count and last visit date
    UPDATE customers 
    SET 
      visits = COALESCE(visits, 0) + 1,
      last_visit = NEW.date,
      -- Update name if it was empty or if new name is more complete
      name = CASE 
        WHEN name IS NULL OR name = '' OR char_length(NEW.customer_name) > char_length(name) 
        THEN NEW.customer_name 
        ELSE name 
      END,
      -- Update email if it was empty
      email = CASE 
        WHEN (email IS NULL OR email = '') AND NEW.email IS NOT NULL AND NEW.email != ''
        THEN NEW.email 
        ELSE email 
      END
    WHERE id = existing_customer_id;
  ELSE
    -- Customer doesn't exist, create new record
    INSERT INTO customers (
      name, 
      email, 
      phone, 
      visits, 
      total_spent, 
      last_visit, 
      preferences, 
      notes, 
      vip_status, 
      do_not_contact
    )
    VALUES (
      NEW.customer_name,
      NEW.email,
      NEW.phone,
      1,                    -- initial visit count
      0.0,                  -- starting spend
      NEW.date,            -- first visit date
      array[]::text[],      -- empty preferences
      null,                 -- no notes initially
      false,                -- not VIP by default
      false                 -- allow contact by default
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, auth_user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If user already exists, just return NEW to continue
    RETURN NEW;
END;
$$;