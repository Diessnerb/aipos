-- Clean up manually-added menu item ingredients
-- All ingredients must now come from the master ingredients library
DELETE FROM public.menu_item_ingredients;

-- Add comment explaining the cleanup
COMMENT ON TABLE public.menu_item_ingredients IS 
'Menu item ingredients linked to master ingredient library. Cleaned on 2025-11-01 to enforce master library requirement.';