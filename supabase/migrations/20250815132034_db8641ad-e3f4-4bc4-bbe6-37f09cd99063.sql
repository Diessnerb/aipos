-- Add triggers to automatically set company_id from user context for menu items, categories, and tables

-- For menu_items table
CREATE OR REPLACE FUNCTION public.set_menu_item_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id = 'auto-set-by-rls' OR NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_menu_item_company_id_trigger
  BEFORE INSERT ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_menu_item_company_id();

-- For menu_categories table
CREATE OR REPLACE FUNCTION public.set_menu_category_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id = 'auto-set-by-rls' OR NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_menu_category_company_id_trigger
  BEFORE INSERT ON public.menu_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_menu_category_company_id();

-- For tables table
CREATE OR REPLACE FUNCTION public.set_table_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id = 'auto-set-by-rls' OR NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_table_company_id_trigger
  BEFORE INSERT ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.set_table_company_id();