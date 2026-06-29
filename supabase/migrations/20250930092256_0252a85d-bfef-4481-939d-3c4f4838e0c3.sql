-- Create alisha_memory table for company-specific learning data
CREATE TABLE IF NOT EXISTS public.alisha_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- 'company_knowledge', 'pattern', 'preference', 'workflow'
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  context TEXT, -- Additional context about when this was learned
  confidence_score NUMERIC DEFAULT 1.0, -- How confident Alisha is about this memory (0-1)
  usage_count INTEGER DEFAULT 0, -- How many times this memory has been useful
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, memory_type, memory_key)
);

-- Create alisha_conversations table for user-specific chat history
CREATE TABLE IF NOT EXISTS public.alisha_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context_data JSONB DEFAULT '{}'::jsonb, -- Store page context, actions taken, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_company FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Create alisha_user_preferences table for individual user patterns
CREATE TABLE IF NOT EXISTS public.alisha_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL, -- 'communication_style', 'common_task', 'shortcut', 'reminder'
  preference_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  frequency INTEGER DEFAULT 1, -- How often this preference is observed
  last_observed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id, preference_type)
);

-- Create alisha_company_settings table for restaurant-specific AI configuration
CREATE TABLE IF NOT EXISTS public.alisha_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  personality_style TEXT DEFAULT 'professional', -- 'professional', 'friendly', 'concise'
  proactive_suggestions BOOLEAN DEFAULT true,
  learning_enabled BOOLEAN DEFAULT true,
  custom_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all Alisha tables
ALTER TABLE public.alisha_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alisha_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alisha_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alisha_company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alisha_memory
CREATE POLICY "Company users can view their company memory"
  ON public.alisha_memory FOR SELECT
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Company users can manage their company memory"
  ON public.alisha_memory FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policies for alisha_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.alisha_conversations FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    AND company_id IN (SELECT allowed_company_ids_for_current_user())
  );

CREATE POLICY "Users can create their own conversations"
  ON public.alisha_conversations FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    AND company_id IN (SELECT allowed_company_ids_for_current_user())
  );

-- RLS Policies for alisha_user_preferences
CREATE POLICY "Users can view their own preferences"
  ON public.alisha_user_preferences FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    AND company_id IN (SELECT allowed_company_ids_for_current_user())
  );

CREATE POLICY "Users can manage their own preferences"
  ON public.alisha_user_preferences FOR ALL
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    AND company_id IN (SELECT allowed_company_ids_for_current_user())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    AND company_id IN (SELECT allowed_company_ids_for_current_user())
  );

-- RLS Policies for alisha_company_settings
CREATE POLICY "Company users can view their company settings"
  ON public.alisha_company_settings FOR SELECT
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Company admins can manage their company settings"
  ON public.alisha_company_settings FOR ALL
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u
      WHERE u.auth_user_id = auth.uid()
      AND (u.role = 'admin' OR u.is_company_admin = true)
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT u.company_id FROM public.users u
      WHERE u.auth_user_id = auth.uid()
      AND (u.role = 'admin' OR u.is_company_admin = true)
    )
  );

-- Create indexes for performance
CREATE INDEX idx_alisha_memory_company ON public.alisha_memory(company_id);
CREATE INDEX idx_alisha_memory_type ON public.alisha_memory(memory_type);
CREATE INDEX idx_alisha_conversations_user ON public.alisha_conversations(user_id, company_id);
CREATE INDEX idx_alisha_conversations_created ON public.alisha_conversations(created_at DESC);
CREATE INDEX idx_alisha_preferences_user ON public.alisha_user_preferences(user_id, company_id);

-- Create trigger for updated_at
CREATE TRIGGER update_alisha_memory_updated_at
  BEFORE UPDATE ON public.alisha_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER update_alisha_preferences_updated_at
  BEFORE UPDATE ON public.alisha_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER update_alisha_settings_updated_at
  BEFORE UPDATE ON public.alisha_company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();