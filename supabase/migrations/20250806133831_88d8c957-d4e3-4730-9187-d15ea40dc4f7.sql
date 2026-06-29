
-- Injected missing column by repair script
ALTER TABLE IF EXISTS public.menu ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE IF EXISTS public.items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE IF EXISTS public.existing ADD COLUMN IF NOT EXISTS category TEXT;
-- Create a function to migrate existing menu items to use category_id
-- This will map the existing text category field to the new category_id foreign key

-- First, let's update existing menu items to use the new category structure
DO $$
DECLARE
    category_record RECORD;
    item_record RECORD;
BEGIN
    -- Update menu items with matching category names
    FOR category_record IN 
        SELECT id, name FROM menu_categories WHERE parent_id IS NULL
    LOOP
        UPDATE menu_items 
        SET category_id = category_record.id 
        WHERE LOWER(category) = LOWER(category_record.name)
        AND category_id IS NULL;
    END LOOP;
    
    -- Handle some common variations and mappings
    UPDATE menu_items 
    SET category_id = (SELECT id FROM menu_categories WHERE name = 'Cakes/Snacks' LIMIT 1)
    WHERE LOWER(category) IN ('snacks', 'cakes', 'desserts', 'cake') 
    AND category_id IS NULL;
    
    UPDATE menu_items 
    SET category_id = (SELECT id FROM menu_categories WHERE name = 'Soft Drinks' LIMIT 1)
    WHERE LOWER(category) IN ('drinks', 'beverages', 'soft drinks') 
    AND category_id IS NULL;
    
    UPDATE menu_items 
    SET category_id = (SELECT id FROM menu_categories WHERE name = 'Wines' LIMIT 1)
    WHERE LOWER(category) IN ('wine', 'wines', 'alcoholic') 
    AND category_id IS NULL;
    
    -- For subcategories, update items that might belong to Pints or Half Pints
    UPDATE menu_items 
    SET category_id = (SELECT id FROM menu_categories WHERE name = 'Pints' AND parent_id IS NOT NULL LIMIT 1)
    WHERE LOWER(category) IN ('pint', 'pints', 'beer pints') 
    AND category_id IS NULL;
    
    UPDATE menu_items 
    SET category_id = (SELECT id FROM menu_categories WHERE name = 'Half Pints' AND parent_id IS NOT NULL LIMIT 1)
    WHERE LOWER(category) IN ('half pint', 'half pints', 'small beer') 
    AND category_id IS NULL;
END $$;