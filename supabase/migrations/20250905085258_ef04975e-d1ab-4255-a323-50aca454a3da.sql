-- Add image_urls and meal_category to menu_items table
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS meal_category TEXT CHECK (meal_category IN ('breakfast', 'lunch', 'dinner', 'all_day')) DEFAULT 'all_day';

-- Create marketing_analytics table for social media performance tracking
CREATE TABLE IF NOT EXISTS public.marketing_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'email', 'sms')),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('likes', 'shares', 'comments', 'views', 'impressions', 'clicks', 'reach')),
  metric_value INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  hour INTEGER CHECK (hour >= 0 AND hour <= 23),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create social_media_posts table
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'email', 'sms')),
  post_id TEXT, -- External platform post ID
  content TEXT,
  image_urls TEXT[],
  video_url TEXT,
  cta_url TEXT, -- Call-to-action URL for tracking
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create marketing_permissions table
CREATE TABLE IF NOT EXISTS public.marketing_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'email', 'sms')),
  post_access BOOLEAN DEFAULT false,
  analytics_access BOOLEAN DEFAULT false,
  content_creation BOOLEAN DEFAULT false,
  automated_posting BOOLEAN DEFAULT false,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create phone_agent_reservations table
CREATE TABLE IF NOT EXISTS public.phone_agent_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  source_post_id UUID REFERENCES public.social_media_posts(id) ON DELETE SET NULL,
  phone_number TEXT,
  call_duration INTEGER, -- in seconds
  successful_booking BOOLEAN DEFAULT false,
  call_recording_url TEXT,
  notes TEXT,
  called_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_subscription_features table for premium features
CREATE TABLE IF NOT EXISTS public.company_subscription_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  feature_name TEXT NOT NULL CHECK (feature_name IN ('marketing_analytics', 'automated_posting', 'advanced_reporting', 'phone_agent')),
  enabled BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, feature_name)
);

-- Enable RLS on all new tables
ALTER TABLE public.marketing_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_agent_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscription_features ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company isolation
CREATE POLICY "marketing_analytics_company_isolation" ON public.marketing_analytics
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "social_media_posts_company_isolation" ON public.social_media_posts
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "marketing_permissions_company_isolation" ON public.marketing_permissions
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "phone_agent_reservations_company_isolation" ON public.phone_agent_reservations
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "company_subscription_features_company_isolation" ON public.company_subscription_features
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create indexes for better performance
CREATE INDEX idx_marketing_analytics_company_date ON public.marketing_analytics(company_id, date);
CREATE INDEX idx_social_media_posts_company_platform ON public.social_media_posts(company_id, platform);
CREATE INDEX idx_marketing_permissions_company_platform ON public.marketing_permissions(company_id, platform);
CREATE INDEX idx_phone_agent_reservations_company_date ON public.phone_agent_reservations(company_id, called_at);

-- Create storage bucket for menu item images
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);

-- Create storage policies for menu images
CREATE POLICY "Companies can upload menu images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Companies can view menu images" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

CREATE POLICY "Companies can update their menu images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'menu-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Companies can delete their menu images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'menu-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_analytics_updated_at
  BEFORE UPDATE ON public.marketing_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_media_posts_updated_at
  BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketing_permissions_updated_at
  BEFORE UPDATE ON public.marketing_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_subscription_features_updated_at
  BEFORE UPDATE ON public.company_subscription_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();