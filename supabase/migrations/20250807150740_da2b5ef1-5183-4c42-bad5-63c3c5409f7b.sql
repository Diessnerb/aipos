-- Create permission types enum
CREATE TYPE public.permission_type AS ENUM ('view', 'edit', 'full_control');

-- Create access levels enum  
CREATE TYPE public.access_level AS ENUM ('staff', 'manager', 'admin');

-- Create page permissions table
CREATE TABLE IF NOT EXISTS public.page_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name TEXT NOT NULL,
  access_level public.access_level NOT NULL,
  permission_type public.permission_type NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_name, access_level, permission_type, company_id)
);

-- Enable RLS
ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for page permissions
CREATE POLICY "Users can view their company's page permissions" 
ON public.page_permissions 
FOR SELECT 
USING (company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create their company's page permissions" 
ON public.page_permissions 
FOR INSERT 
WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their company's page permissions" 
ON public.page_permissions 
FOR UPDATE 
USING (company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their company's page permissions" 
ON public.page_permissions 
FOR DELETE 
USING (company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Create function to update timestamps
CREATE TRIGGER update_page_permissions_updated_at
BEFORE UPDATE ON public.page_permissions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Insert default permissions for common pages
INSERT INTO public.page_permissions (page_name, access_level, permission_type, company_id) 
SELECT 
  unnest(ARRAY['reservations', 'customers', 'menu_items', 'analytics', 'company_settings']) as page_name,
  unnest(ARRAY['admin'::public.access_level]) as access_level,
  unnest(ARRAY['full_control'::public.permission_type]) as permission_type,
  c.id as company_id
FROM public.companies c;