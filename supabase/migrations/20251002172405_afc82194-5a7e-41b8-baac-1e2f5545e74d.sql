-- Modify link_templates table to store flat option lists instead of hierarchical structure
-- We'll rename the column to better reflect its new purpose

-- The link_structure_json column will now store a simple array of {option_name, price}
-- instead of the full hierarchical ProductLink[] structure

-- Add comment to clarify the new structure
COMMENT ON COLUMN public.link_templates.link_structure_json IS 'Array of {option_name: string, price: number} - flat list of options that can be loaded at any level';

-- Remove the level_1_pricing_mode column as templates now adapt to the current context
ALTER TABLE public.link_templates DROP COLUMN IF EXISTS level_1_pricing_mode;

-- Update existing templates to have empty arrays (they will need to be recreated)
UPDATE public.link_templates SET link_structure_json = '[]'::jsonb;