-- Add unique constraints to integrations table to prevent duplicate integrations per user/service
-- This fixes the 42P10 error in instagram-oauth edge function

-- Add unique constraint for user_id + service_name combination
ALTER TABLE public.integrations 
ADD CONSTRAINT integrations_user_service_unique 
UNIQUE (user_id, service_name);

-- Add unique constraint for company_id + service_name as backup
ALTER TABLE public.integrations 
ADD CONSTRAINT integrations_company_service_unique 
UNIQUE (company_id, service_name);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_integrations_user_service 
ON public.integrations(user_id, service_name);

CREATE INDEX IF NOT EXISTS idx_integrations_company_service 
ON public.integrations(company_id, service_name);

-- Add comments for documentation
COMMENT ON CONSTRAINT integrations_user_service_unique ON public.integrations 
IS 'Ensures a user can only have one integration per service type';

COMMENT ON CONSTRAINT integrations_company_service_unique ON public.integrations 
IS 'Ensures a company can only have one integration per service type';