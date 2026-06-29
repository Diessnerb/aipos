-- Clean up orphaned menu items and categories (assign them to a system company or delete)
-- First, let's clean up orphaned menu categories and items with NULL company_id

-- Delete orphaned menu items that have NULL company_id (Loom's personal dishes)
DELETE FROM public.menu_items WHERE company_id IS NULL;

-- Delete orphaned menu categories that have NULL company_id
DELETE FROM public.menu_categories WHERE company_id IS NULL;

-- Add NOT NULL constraints to prevent future orphaned data
ALTER TABLE public.menu_items 
ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.menu_categories 
ALTER COLUMN company_id SET NOT NULL;

-- Add NOT NULL constraint to tables as well to ensure proper company scoping
ALTER TABLE public.tables 
ALTER COLUMN company_id SET NOT NULL;