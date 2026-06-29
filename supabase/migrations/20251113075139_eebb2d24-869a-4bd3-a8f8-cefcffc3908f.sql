-- Enable marketing feature for the currently authenticated user's company

-- Injected unique constraint for ON CONFLICT by repair script
-- Delete duplicate rows before adding constraint to avoid unique violation
DELETE FROM public.company_subscription_features a USING public.company_subscription_features b WHERE a.ctid < b.ctid AND a.company_id = b.company_id AND a.feature_name = b.feature_name;
ALTER TABLE public.company_subscription_features DROP CONSTRAINT IF EXISTS uniq_company_subscription_features_company_id_feature_name;
ALTER TABLE public.company_subscription_features ADD CONSTRAINT uniq_company_subscription_features_company_id_feature_name UNIQUE (company_id,feature_name);

INSERT INTO company_subscription_features (company_id, feature_name, enabled, expires_at)
SELECT 
  company_id,
  'marketing' as feature_name,
  true as enabled,
  (NOW() + INTERVAL '1 year')::timestamptz as expires_at
FROM users
WHERE id = auth.uid()
ON CONFLICT (company_id, feature_name) 
DO UPDATE SET 
  enabled = true,
  expires_at = (NOW() + INTERVAL '1 year')::timestamptz,
  updated_at = NOW();