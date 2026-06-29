-- Robust UPSERT-based customer sync from reservations trigger to prevent unique violations
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_phone text;
  did_update boolean;
BEGIN
  -- Require a name
  IF coalesce(trim(NEW.customer_name), '') = '' THEN
    RETURN NEW;
  END IF;

  -- Normalize phone if provided
  IF NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN
    normalized_phone := normalize_uk_phone(NEW.phone);
  ELSE
    normalized_phone := NULL;
  END IF;

  -- If neither phone nor email, skip
  IF (coalesce(trim(NEW.email), '') = '') AND (coalesce(trim(normalized_phone), '') = '') THEN
    RETURN NEW;
  END IF;

  -- Primary path: phone-based UPSERT (conflict-safe under uniq_customers_company_phone_not_empty)
  IF normalized_phone IS NOT NULL AND normalized_phone <> '' THEN
    INSERT INTO public.customers (
      company_id,
      name,
      email,
      phone,
      visits,
      last_visit,
      vip_status,
      sms_opt_out,
      do_not_contact,
      late_count,
      no_show_count,
      average_minutes_late
    ) VALUES (
      NEW.company_id,
      NEW.customer_name,
      NULLIF(trim(NEW.email), ''),
      normalized_phone,
      0, -- visits increment happens only when reservation is completed
      NEW.date,
      false,
      false,
      false,
      0,
      0,
      0
    )
    ON CONFLICT ON CONSTRAINT uniq_customers_company_phone_not_empty
    DO UPDATE SET
      -- Prefer longer/better name
      name = CASE 
        WHEN EXCLUDED.name IS NOT NULL AND LENGTH(EXCLUDED.name) > LENGTH(customers.name) THEN EXCLUDED.name
        ELSE customers.name
      END,
      -- Only fill missing email
      email = COALESCE(customers.email, EXCLUDED.email),
      -- Keep the most recent last_visit
      last_visit = GREATEST(COALESCE(customers.last_visit, EXCLUDED.last_visit), EXCLUDED.last_visit);

    RETURN NEW;
  END IF;

  -- Fallback path: email-only match (no unique constraint on email)
  IF coalesce(trim(NEW.email), '') <> '' THEN
    UPDATE public.customers c
    SET 
      name = CASE 
        WHEN LENGTH(NEW.customer_name) > LENGTH(c.name) THEN NEW.customer_name
        ELSE c.name
      END,
      last_visit = CASE 
        WHEN c.last_visit IS NULL OR NEW.date > c.last_visit THEN NEW.date
        ELSE c.last_visit
      END
    WHERE c.company_id = NEW.company_id
      AND c.email = NEW.email
    RETURNING true INTO did_update;

    IF NOT did_update THEN
      INSERT INTO public.customers (
        company_id,
        name,
        email,
        phone,
        visits,
        last_visit,
        vip_status,
        sms_opt_out,
        do_not_contact,
        late_count,
        no_show_count,
        average_minutes_late
      ) VALUES (
        NEW.company_id,
        NEW.customer_name,
        NEW.email,
        NULL,
        0,
        NEW.date,
        false,
        false,
        false,
        0,
        0,
        0
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;