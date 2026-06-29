-- Fix RLS policy issues by enabling RLS and creating policies for tables without them

-- Enable RLS and create policies for rota_entries
ALTER TABLE public.rota_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rota_entries_company_isolation" ON public.rota_entries
FOR ALL
USING (
  rota_id IN (
    SELECT r.id FROM public.rotas r 
    JOIN public.users u ON r.user_id = u.id 
    WHERE u.company_id IN (
      SELECT u2.company_id FROM public.users u2 WHERE u2.auth_user_id = auth.uid()
      UNION
      SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
        SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  rota_id IN (
    SELECT r.id FROM public.rotas r 
    JOIN public.users u ON r.user_id = u.id 
    WHERE u.company_id IN (
      SELECT u2.company_id FROM public.users u2 WHERE u2.auth_user_id = auth.uid()
      UNION
      SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
        SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
      )
    )
  )
);

-- Enable RLS and create policies for rotas
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotas_company_isolation" ON public.rotas
FOR ALL
USING (
  user_id IN (
    SELECT u.id FROM public.users u WHERE u.company_id IN (
      SELECT u2.company_id FROM public.users u2 WHERE u2.auth_user_id = auth.uid()
      UNION
      SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
        SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  user_id IN (
    SELECT u.id FROM public.users u WHERE u.company_id IN (
      SELECT u2.company_id FROM public.users u2 WHERE u2.auth_user_id = auth.uid()
      UNION
      SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
        SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
      )
    )
  )
);

-- Enable RLS and create policies for holiday_requests
ALTER TABLE public.holiday_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holiday_requests_company_isolation" ON public.holiday_requests
FOR ALL
USING (
  user_id IN (
    SELECT u.id FROM public.users u WHERE u.company_id IN (
      SELECT u2.company_id FROM public.users u2 WHERE u2.auth_user_id = auth.uid()
      UNION
      SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
        SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  user_id IN (
    SELECT u.id FROM public.users u WHERE u.company_id IN (
      SELECT u2.company_id FROM public.users u2 WHERE u2.auth_user_id = auth.uid()
      UNION
      SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
        SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
      )
    )
  )
);

-- Enable RLS and create policies for integrations
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_company_isolation" ON public.integrations
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Enable RLS and create policies for copilot_logs
ALTER TABLE public.copilot_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_logs_company_isolation" ON public.copilot_logs
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Enable RLS and create policies for ai_campaign_logs
DROP POLICY IF EXISTS "Authenticated users can manage AI campaign logs" ON public.ai_campaign_logs;
ALTER TABLE public.ai_campaign_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_campaign_logs_company_isolation" ON public.ai_campaign_logs
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Enable RLS and create policies for company_permission_templates
ALTER TABLE public.company_permission_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_permission_templates_isolation" ON public.company_permission_templates
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Update channels RLS policy
DROP POLICY IF EXISTS "Authenticated users can manage channels" ON public.channels;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels_company_isolation" ON public.channels
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Update messenger_notes RLS policy
DROP POLICY IF EXISTS "Authenticated users can manage messenger notes" ON public.messenger_notes;
ALTER TABLE public.messenger_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messenger_notes_company_isolation" ON public.messenger_notes
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);