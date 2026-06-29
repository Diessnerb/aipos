-- Add network_secret to companies table for secure P2P communication
ALTER TABLE companies ADD COLUMN IF NOT EXISTS network_secret TEXT;

-- Generate network secrets for existing companies
UPDATE companies 
SET network_secret = encode(gen_random_bytes(32), 'hex')
WHERE network_secret IS NULL;

-- Create trusted_devices table for device management
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT DEFAULT 'pos',
  connection_type TEXT,
  first_paired_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  UNIQUE(company_id, device_id)
);

-- Enable RLS on trusted_devices
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their company's trusted devices
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trusted_devices' AND policyname = 'Users can view their company trusted devices'
  ) THEN
    CREATE POLICY "Users can view their company trusted devices"
    ON trusted_devices FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Policy: Owners and admins can manage trusted devices
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trusted_devices' AND policyname = 'Owners can manage trusted devices'
  ) THEN
    CREATE POLICY "Owners can manage trusted devices"
    ON trusted_devices FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;