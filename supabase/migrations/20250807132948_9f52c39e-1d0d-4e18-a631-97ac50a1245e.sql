-- Enable RLS on locations table
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for locations
CREATE POLICY "Allow all operations on locations" 
ON public.locations 
FOR ALL 
USING (true) 
WITH CHECK (true);