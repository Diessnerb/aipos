-- Add metadata field to integrations table for storing platform-specific data
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add messaging_access to marketing_permissions for DM management consent
ALTER TABLE public.marketing_permissions 
ADD COLUMN IF NOT EXISTS messaging_access boolean DEFAULT false;