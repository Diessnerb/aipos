-- Add service_status column to tables table
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS service_status TEXT DEFAULT 'available' 
CHECK (service_status IN ('available', 'out_of_service', 'temporarily_removed'));

-- Add index for better query performance
CREATE INDEX idx_tables_service_status ON public.tables(service_status);

-- Add comment for documentation
COMMENT ON COLUMN public.tables.service_status IS 'Service status of the table: available, out_of_service (physically present but unavailable), temporarily_removed (physically not present)';