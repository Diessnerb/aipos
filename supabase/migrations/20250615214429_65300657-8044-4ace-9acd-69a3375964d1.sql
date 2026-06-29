
-- Add an 'updated_at' column to track the last modification time of a rota.
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill 'updated_at' with 'created_at' for existing rotas so the column can be made non-nullable.
UPDATE public.rotas SET updated_at = created_at WHERE updated_at IS NULL;

-- Make 'updated_at' non-nullable as all rotas should have this timestamp.
ALTER TABLE public.rotas ALTER COLUMN updated_at SET NOT NULL;

-- Create a reusable function to automatically update the 'updated_at' timestamp.
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger on the 'rotas' table to call the function before each update.
CREATE TRIGGER set_rotas_updated_at
BEFORE UPDATE ON public.rotas
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();
