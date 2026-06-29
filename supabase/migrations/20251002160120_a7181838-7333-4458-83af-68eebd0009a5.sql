-- Add card_color column to menu_categories table to support visual customization
ALTER TABLE public.menu_categories 
ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT NULL;