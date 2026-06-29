-- Clean up existing data and update constraints to support the simplified feature set

-- First, remove all existing features that are not in our new simplified list
DELETE FROM public.company_subscription_features 
WHERE feature_name NOT IN ('reservations', 'customers', 'menu', 'analytics', 'marketing');

-- Drop the existing constraint
ALTER TABLE public.company_subscription_features 
DROP CONSTRAINT IF EXISTS company_subscription_features_feature_name_check;

-- Add new constraint with the simplified feature set (core + toggleable)
ALTER TABLE public.company_subscription_features 
ADD CONSTRAINT company_subscription_features_feature_name_check 
CHECK (feature_name = ANY (ARRAY['reservations'::text, 'customers'::text, 'menu'::text, 'analytics'::text, 'marketing'::text]));

-- Now ensure all companies have core features enabled
DO $$
DECLARE
    company_record RECORD;
    core_features TEXT[] := ARRAY['reservations', 'customers', 'menu', 'analytics'];
    current_feature TEXT;
BEGIN
    -- Loop through all active companies
    FOR company_record IN SELECT id FROM public.companies WHERE status = 'active'
    LOOP
        -- Ensure each core feature is enabled for this company
        FOREACH current_feature IN ARRAY core_features
        LOOP
            INSERT INTO public.company_subscription_features (
                company_id,
                feature_name,
                enabled,
                created_at,
                updated_at
            ) VALUES (
                company_record.id,
                current_feature,
                true,
                now(),
                now()
            ) ON CONFLICT (company_id, feature_name) 
            DO UPDATE SET 
                enabled = true,
                updated_at = now();
        END LOOP;
        
        -- Also ensure marketing feature exists (but can be toggled)
        INSERT INTO public.company_subscription_features (
            company_id,
            feature_name,
            enabled,
            created_at,
            updated_at
        ) VALUES (
            company_record.id,
            'marketing',
            false, -- Default to disabled, can be toggled
            now(),
            now()
        ) ON CONFLICT (company_id, feature_name) 
        DO NOTHING; -- Keep existing marketing setting if it exists
    END LOOP;
END $$;

-- Add comment for future reference
COMMENT ON TABLE public.company_subscription_features IS 'Manages company feature access. Core features (reservations, customers, menu, analytics) should always be enabled. Only marketing is currently toggleable.';