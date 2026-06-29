
-- Fix: avoid invalid uuid casting in company_id setter functions

-- 1) menu_categories
CREATE OR REPLACE FUNCTION public.set_menu_category_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Safely handle sentinel and null values
  IF NEW.company_id IS NULL OR NEW.company_id::text = 'auto-set-by-rls' THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) menu_items
CREATE OR REPLACE FUNCTION public.set_menu_item_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id IS NULL OR NEW.company_id::text = 'auto-set-by-rls' THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) tables
CREATE OR REPLACE FUNCTION public.set_table_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id IS NULL OR NEW.company_id::text = 'auto-set-by-rls' THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;
