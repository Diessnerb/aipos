-- 1) Ensure partial unique index for (company_id, phone) when phone is non-empty
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customers_company_phone_not_empty
ON public.customers (company_id, phone)
WHERE phone IS NOT NULL AND btrim(phone) <> '';

-- 2) Robust UPSERT-based customer sync function using index inference (works with partial unique index)
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
  -- Require a customer name to proceed
  IF coalesce(trim(NEW.customer_name), '') = '' THEN
    RETURN NEW;
  END IF;

  -- Normalize phone: strip non-digits; treat empty result as NULL
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
    normalized_phone := regexp_replace(btrim(NEW.phone), '[^0-9]', '', 'g');
    IF btrim(coalesce(normalized_phone, '')) = '' THEN
      normalized_phone := NULL;
    END IF;
  ELSE
    normalized_phone := NULL;
  END IF;

  -- If neither phone nor email provided, skip
  IF (coalesce(trim(NEW.email), '') = '') AND (normalized_phone IS NULL) THEN
    RETURN NEW;
  END IF;

  -- Primary path: phone-based UPSERT using index inference for the partial unique index
  IF normalized_phone IS NOT NULL THEN
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
      0, -- visits increments only when reservation is completed
      NEW.date,
      false,
      false,
      false,
      0,
      0,
      0
    )
    ON CONFLICT (company_id, phone)
    WHERE phone IS NOT NULL AND btrim(phone) <> ''
    DO UPDATE SET
      -- Prefer longer/better name when provided
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

  -- Fallback path: email-only match where phone is absent
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