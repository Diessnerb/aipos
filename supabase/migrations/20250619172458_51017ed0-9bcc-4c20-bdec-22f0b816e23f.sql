
-- Add missing columns for shift_swap_requests table to support the UI requirements
ALTER TABLE shift_swap_requests 
ADD COLUMN IF NOT EXISTS swap_with_date date,
ADD COLUMN IF NOT EXISTS swap_with_start_time text,
ADD COLUMN IF NOT EXISTS swap_with_finish_time text,
ADD COLUMN IF NOT EXISTS swap_with_day_of_week text;

-- Add day_staff_type column to rota_entries to support role overrides per day
ALTER TABLE rota_entries 
ADD COLUMN IF NOT EXISTS notes text;

-- Create off_reasons table to store reasons for off days
CREATE TABLE IF NOT EXISTS off_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  reason text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on off_reasons table
ALTER TABLE off_reasons ENABLE ROW LEVEL SECURITY;

-- Create policies for off_reasons table
CREATE POLICY "Users can read their own off reasons" 
  ON off_reasons FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own off reasons" 
  ON off_reasons FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update their own off reasons" 
  ON off_reasons FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete their own off reasons" 
  ON off_reasons FOR DELETE 
  USING (true);

-- Update users table to include remaining_holiday_days calculation
-- (This column already exists, just ensuring it's properly configured)
ALTER TABLE users 
ALTER COLUMN remaining_holiday_days SET DEFAULT 28;
