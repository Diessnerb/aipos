-- Add partial unique index to prevent duplicate API tokens for external_api service
CREATE UNIQUE INDEX IF NOT EXISTS unique_company_external_api_service 
ON public.integrations (company_id, service_name) 
WHERE service_name = 'external_api';

-- Add index for faster auth_token lookups
CREATE INDEX IF NOT EXISTS idx_integrations_auth_token 
ON public.integrations(auth_token) 
WHERE service_name = 'external_api' AND connected = true;

-- Backfill any missing external_api tokens for existing companies
DO $$
DECLARE
    company_record RECORD;
    new_token TEXT;
BEGIN
    FOR company_record IN 
        SELECT c.id, c.name 
        FROM public.companies c 
        WHERE c.status = 'active' 
        AND NOT EXISTS (
            SELECT 1 FROM public.integrations i 
            WHERE i.company_id = c.id 
            AND i.service_name = 'external_api'
        )
    LOOP
        -- Generate unique token
        new_token := 'int_' || encode(gen_random_bytes(16), 'base64');
        new_token := replace(new_token, '/', '');
        new_token := replace(new_token, '+', '');
        new_token := substr(new_token, 1, 32);
        
        -- Insert integration token
        INSERT INTO public.integrations (
            company_id, 
            service_name, 
            auth_token, 
            connected,
            metadata
        ) VALUES (
            company_record.id,
            'external_api',
            new_token,
            true,
            jsonb_build_object(
                'created_for', 'AI_agent_integration',
                'company_name', company_record.name
            )
        );
        
        RAISE LOG 'Created external_api token for company: % (ID: %)', company_record.name, company_record.id;
    END LOOP;
END $$;