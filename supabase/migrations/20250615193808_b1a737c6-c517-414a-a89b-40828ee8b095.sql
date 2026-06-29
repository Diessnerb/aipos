
-- Create a table for shift swap requests
CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_user_id UUID NOT NULL REFERENCES public.users(id),
  shift_date DATE NOT NULL,
  shift_start_time TEXT NOT NULL,
  shift_finish_time TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for shift swap requests
CREATE POLICY "Users can view all shift swap requests" 
  ON public.shift_swap_requests 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can create shift swap requests for themselves" 
  ON public.shift_swap_requests 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() IN (
    SELECT id FROM public.users WHERE id = original_user_id
  ));

CREATE POLICY "Users can update shift swap requests they created or are involved in" 
  ON public.shift_swap_requests 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM public.users 
    WHERE id = original_user_id OR id = requested_by_user_id
  ));

CREATE POLICY "Users can delete their own shift swap requests" 
  ON public.shift_swap_requests 
  FOR DELETE 
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE id = original_user_id
  ));
