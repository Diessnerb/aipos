-- Add floor_level column to tables table
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS floor_level integer DEFAULT 1 NOT NULL;

-- Add index for better performance when filtering by floor_level
CREATE INDEX idx_tables_floor_level ON public.tables(company_id, floor_level);

-- Add comment explaining the floor_level column
COMMENT ON COLUMN public.tables.floor_level IS 'The floor/level number where this table is located (1 = Ground Floor, 2 = Second Floor, etc.)';

-- Update existing tables to be on floor level 1 (Ground Floor)
UPDATE public.tables 
SET floor_level = 1 
WHERE floor_level IS NULL;