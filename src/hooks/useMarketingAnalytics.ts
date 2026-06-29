import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export interface MarketingMetric {
  id: string;
  platform: 'facebook' | 'instagram' | 'email' | 'sms';
  metric_type: 'likes' | 'shares' | 'comments' | 'views' | 'impressions' | 'clicks' | 'reach';
  metric_value: number;
  date: string;
  hour?: number;
}

export interface SocialMediaPost {
  id: string;
  platform: 'facebook' | 'instagram' | 'email' | 'sms';
  menu_item_id?: string;
  post_id?: string;
  content?: string;
  image_urls?: string[];
  video_url?: string;
  cta_url?: string;
  posted_at: string;
  likes_count: number;
  shares_count: number;
  comments_count: number;
  views_count: number;
  impressions_count: number;
  clicks_count: number;
}

export interface MarketingPermissions {
  id: string;
  platform: 'facebook' | 'instagram' | 'email' | 'sms';
  post_access: boolean;
  analytics_access: boolean;
  content_creation: boolean;
  automated_posting: boolean;
}

export interface SubscriptionFeature {
  id: string;
  feature_name: 'marketing_analytics' | 'automated_posting' | 'advanced_reporting' | 'phone_agent';
  enabled: boolean;
  expires_at?: string;
}

export function useMarketingAnalytics(dateRange: { start: Date; end: Date }) {
  const { currentUser: user } = useCurrentUser();
  
  return useQuery({
    queryKey: ['marketing-analytics', user?.company_id, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!user?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('marketing_analytics')
        .select('*')
        .eq('company_id', user.company_id)
        .gte('date', dateRange.start.toISOString().split('T')[0])
        .lte('date', dateRange.end.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as MarketingMetric[];
    },
    enabled: !!user?.company_id,
  });
}

export function useSocialMediaPosts(platform?: string) {
  const { currentUser: user } = useCurrentUser();
  
  return useQuery({
    queryKey: ['social-media-posts', user?.company_id, platform],
    queryFn: async () => {
      if (!user?.company_id) throw new Error('No company ID');
      
      let query = supabase
        .from('social_media_posts')
        .select(`
          *,
          menu_items(name, category_id)
        `)
        .eq('company_id', user.company_id)
        .order('posted_at', { ascending: false })
        .limit(50);
      
      if (platform) {
        query = query.eq('platform', platform);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as SocialMediaPost[];
    },
    enabled: !!user?.company_id,
  });
}

export function useMarketingPermissions() {
  const { currentUser: user } = useCurrentUser();
  
  return useQuery({
    queryKey: ['marketing-permissions', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('marketing_permissions')
        .select('*')
        .eq('company_id', user.company_id);
      
      if (error) throw error;
      return data as MarketingPermissions[];
    },
    enabled: !!user?.company_id,
  });
}

export function useSubscriptionFeatures() {
  const { currentUser: user } = useCurrentUser();
  
  return useQuery({
    queryKey: ['subscription-features', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('company_subscription_features')
        .select('*')
        .eq('company_id', user.company_id);
      
      if (error) throw error;
      return data as SubscriptionFeature[];
    },
    enabled: !!user?.company_id,
  });
}

export function useConnectedPlatforms() {
  const { currentUser: user } = useCurrentUser();
  
  return useQuery({
    queryKey: ['connected-platforms', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('integrations')
        .select('service_name')
        .eq('company_id', user.company_id)
        .eq('connected', true);
      
      if (error) throw error;
      return data?.map(integration => integration.service_name) || [];
    },
    enabled: !!user?.company_id,
  }).data || [];
}