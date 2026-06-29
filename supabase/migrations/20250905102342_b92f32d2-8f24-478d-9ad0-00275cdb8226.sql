-- Ensure all companies have core features enabled and remove obsolete features
-- This migration standardizes the feature set to match the sidebar pages

-- First, enable core features for all existing companies
DO $$
DECLARE
    company_record RECORD;
    core_features TEXT[] := ARRAY['reservations', 'customers', 'menu', 'analytics'];
    feature_name TEXT;
BEGIN
    -- Loop through all active companies
    FOR company_record IN SELECT id FROM public.companies WHERE status = 'active'
    LOOP
        -- Ensure each core feature is enabled for this company
        FOREACH feature_name IN ARRAY core_features
        LOOP
            INSERT INTO public.company_subscription_features (
                company_id,
                feature_name,
                enabled,
                created_at,
                updated_at
            ) VALUES (
                company_record.id,
                feature_name,
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
        DO NOTHING; -- Keep existing marketing setting
    END LOOP;
END $$;

-- Remove obsolete features that are no longer used
DELETE FROM public.company_subscription_features 
WHERE feature_name NOT IN ('reservations', 'customers', 'menu', 'analytics', 'marketing');

-- Add comment for future reference
COMMENT ON TABLE public.company_subscription_features IS 'Manages company feature access. Core features (reservations, customers, menu, analytics) should always be enabled. Only marketing is currently toggleable.';