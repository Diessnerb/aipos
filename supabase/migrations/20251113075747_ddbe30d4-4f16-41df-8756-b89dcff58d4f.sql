-- Create assets table for image/media management
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  enhancement_status TEXT NOT NULL DEFAULT 'pending' CHECK (enhancement_status IN ('pending', 'processing', 'completed', 'failed')),
  enhanced_file_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create image processing queue
CREATE TABLE IF NOT EXISTS image_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Create brand kit table
CREATE TABLE IF NOT EXISTS brand_kit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  secondary_logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  background_color TEXT,
  tone_of_voice TEXT NOT NULL DEFAULT 'warm' CHECK (tone_of_voice IN ('warm', 'premium', 'fun', 'professional', 'custom')),
  custom_tone_description TEXT,
  primary_font TEXT,
  secondary_font TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add approval_status to social_media_posts if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'social_media_posts' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE social_media_posts 
    ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Add scheduled_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'social_media_posts' 
    AND column_name = 'scheduled_at'
  ) THEN
    ALTER TABLE social_media_posts 
    ADD COLUMN scheduled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add estimated_reach column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'social_media_posts' 
    AND column_name = 'estimated_reach'
  ) THEN
    ALTER TABLE social_media_posts 
    ADD COLUMN estimated_reach TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_kit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for assets
CREATE POLICY "Users can view their company assets"
  ON assets FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their company assets"
  ON assets FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their company assets"
  ON assets FOR UPDATE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their company assets"
  ON assets FOR DELETE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Create RLS policies for image_processing_queue
CREATE POLICY "Users can view their company queue"
  ON image_processing_queue FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their company queue items"
  ON image_processing_queue FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their company queue items"
  ON image_processing_queue FOR UPDATE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Create RLS policies for brand_kit
CREATE POLICY "Users can view their company brand kit"
  ON brand_kit FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their company brand kit"
  ON brand_kit FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their company brand kit"
  ON brand_kit FOR UPDATE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assets_company_id ON assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_enhancement_status ON assets(enhancement_status);
CREATE INDEX IF NOT EXISTS idx_image_processing_queue_status ON image_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_image_processing_queue_asset_id ON image_processing_queue(asset_id);
CREATE INDEX IF NOT EXISTS idx_brand_kit_company_id ON brand_kit(company_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_image_processing_queue_updated_at ON image_processing_queue;
CREATE TRIGGER update_image_processing_queue_updated_at
  BEFORE UPDATE ON image_processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_kit_updated_at ON brand_kit;
CREATE TRIGGER update_brand_kit_updated_at
  BEFORE UPDATE ON brand_kit
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();