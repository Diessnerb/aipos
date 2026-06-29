import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from './useCompanyId';
import { offlineAwareInsert } from '@/utils/offlineAwareSupabase';

// Types
export interface Asset {
  id: string;
  company_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  enhancement_status: 'pending' | 'processing' | 'completed' | 'failed';
  enhanced_file_path?: string;
  metadata?: {
    title?: string;
    dish_name?: string;
    description?: string;
    tags?: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface BrandKit {
  id: string;
  company_id: string;
  logo_url?: string;
  secondary_logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  tone_of_voice: 'warm' | 'premium' | 'fun' | 'professional' | 'custom';
  custom_tone_description?: string;
  primary_font?: string;
  secondary_font?: string;
  created_at: string;
  updated_at: string;
}

export interface PendingApproval {
  id: string;
  platform: 'instagram' | 'facebook';
  content?: string;
  image_urls?: string[];
  approval_status: 'pending' | 'approved' | 'rejected';
  scheduled_at?: string;
  estimated_reach?: string;
  created_at: string;
}

export interface MarketingKPI {
  email_sent: number;
  email_delivered: number;
  email_open_rate: number;
  email_click_rate: number;
  sms_sent: number;
  sms_delivered: number;
  sms_click_rate: number;
  instagram_posts: number;
  instagram_impressions: number;
  instagram_engagement_rate: number;
  facebook_posts: number;
  facebook_impressions: number;
  facebook_engagement_rate: number;
}

// Assets
export function useAssets(filters?: { status?: string; fileType?: string }) {
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useQuery({
    queryKey: ['marketing-assets', effectiveCompanyId, filters],
    queryFn: async () => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      let query = supabase
        .from('assets')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('enhancement_status', filters.status);
      }
      
      if (filters?.fileType) {
        query = query.ilike('file_type', `${filters.fileType}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Asset[];
    },
    enabled: !!effectiveCompanyId,
  });
}

export function useAssetProcessingStatus(assetId: string) {
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useQuery({
    queryKey: ['asset-status', assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('enhancement_status, enhanced_file_path')
        .eq('id', assetId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!assetId && !!effectiveCompanyId,
    refetchInterval: (data: any) => {
      // Poll every 5 seconds if processing
      return data?.enhancement_status === 'processing' ? 5000 : false;
    },
  });
}

export function useUploadAsset() {
  const queryClient = useQueryClient();
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useMutation({
    mutationFn: async (file: File) => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${effectiveCompanyId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('marketing-assets')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Create asset record
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .insert({
          company_id: effectiveCompanyId,
          file_path: uploadData.path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          enhancement_status: 'pending',
        })
        .select()
        .single();
      
      if (assetError) throw assetError;
      
      // Queue for enhancement
      await offlineAwareInsert('image_processing_queue', {
        company_id: effectiveCompanyId,
        asset_id: asset.id,
        status: 'pending',
      });
      
      return asset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-assets'] });
    },
  });
}

// Brand Kit
export function useBrandKit() {
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useQuery({
    queryKey: ['brand-kit', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('brand_kit')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .maybeSingle();
      
      if (error) throw error;
      return data as BrandKit | null;
    },
    enabled: !!effectiveCompanyId,
  });
}

export function useUpdateBrandKit() {
  const queryClient = useQueryClient();
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useMutation({
    mutationFn: async (brandKit: Partial<BrandKit>) => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('brand_kit')
        .upsert({
          company_id: effectiveCompanyId,
          ...brandKit,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kit'] });
    },
  });
}

// Pending Approvals
export function usePendingApprovals(platform?: string) {
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useQuery({
    queryKey: ['pending-approvals', effectiveCompanyId, platform],
    queryFn: async () => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      let query = supabase
        .from('social_media_posts')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });
      
      if (platform) {
        query = query.eq('platform', platform);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as PendingApproval[];
    },
    enabled: !!effectiveCompanyId,
  });
}

export function useApprovePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase
        .from('social_media_posts')
        .update({ approval_status: 'approved' })
        .eq('id', postId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
  });
}

export function useRejectPost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase
        .from('social_media_posts')
        .update({ approval_status: 'rejected' })
        .eq('id', postId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
  });
}

// Marketing KPIs
export function useMarketingKPIs(dateRange: { start: Date; end: Date }) {
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useQuery({
    queryKey: ['marketing-kpis', effectiveCompanyId, dateRange],
    queryFn: async () => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      const startDate = dateRange.start.toISOString().split('T')[0];
      const endDate = dateRange.end.toISOString().split('T')[0];
      
      // Fetch Instagram posts and metrics
      const { data: instagramPosts, error: igPostsError } = await supabase
        .from('social_media_posts')
        .select('id, likes_count, comments_count, shares_count, impressions_count, platform')
        .eq('company_id', effectiveCompanyId)
        .eq('platform', 'instagram')
        .gte('posted_at', startDate)
        .lte('posted_at', endDate);
      
      if (igPostsError) throw igPostsError;
      
      // Fetch Facebook posts and metrics
      const { data: facebookPosts, error: fbPostsError } = await supabase
        .from('social_media_posts')
        .select('id, likes_count, comments_count, shares_count, impressions_count, platform')
        .eq('company_id', effectiveCompanyId)
        .eq('platform', 'facebook')
        .gte('posted_at', startDate)
        .lte('posted_at', endDate);
      
      if (fbPostsError) throw fbPostsError;
      
      // Fetch Instagram impressions from analytics
      const { data: igImpressions, error: igImpressionsError } = await supabase
        .from('marketing_analytics')
        .select('metric_value')
        .eq('company_id', effectiveCompanyId)
        .eq('platform', 'instagram')
        .eq('metric_type', 'impressions')
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (igImpressionsError) throw igImpressionsError;
      
      // Fetch Facebook impressions from analytics
      const { data: fbImpressions, error: fbImpressionsError } = await supabase
        .from('marketing_analytics')
        .select('metric_value')
        .eq('company_id', effectiveCompanyId)
        .eq('platform', 'facebook')
        .eq('metric_type', 'impressions')
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (fbImpressionsError) throw fbImpressionsError;
      
      // Calculate Instagram metrics
      const igTotalImpressions = igImpressions?.reduce((sum, record) => sum + (record.metric_value || 0), 0) || 0;
      const igTotalEngagement = instagramPosts?.reduce((sum, post) => 
        sum + (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0), 0) || 0;
      const igEngagementRate = igTotalImpressions > 0 
        ? Number(((igTotalEngagement / igTotalImpressions) * 100).toFixed(1))
        : 0;
      
      // Calculate Facebook metrics
      const fbTotalImpressions = fbImpressions?.reduce((sum, record) => sum + (record.metric_value || 0), 0) || 0;
      const fbTotalEngagement = facebookPosts?.reduce((sum, post) => 
        sum + (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0), 0) || 0;
      const fbEngagementRate = fbTotalImpressions > 0 
        ? Number(((fbTotalEngagement / fbTotalImpressions) * 100).toFixed(1))
        : 0;
      
      // TODO: Fetch email and SMS metrics when those integrations are implemented
      return {
        email_sent: 1250,
        email_delivered: 1200,
        email_open_rate: 42,
        email_click_rate: 12,
        sms_sent: 850,
        sms_delivered: 835,
        sms_click_rate: 18,
        instagram_posts: instagramPosts?.length || 0,
        instagram_impressions: igTotalImpressions,
        instagram_engagement_rate: igEngagementRate,
        facebook_posts: facebookPosts?.length || 0,
        facebook_impressions: fbTotalImpressions,
        facebook_engagement_rate: fbEngagementRate,
      } as MarketingKPI;
    },
    enabled: !!effectiveCompanyId,
  });
}

// Today's Queue
export function useTodaysQueue() {
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  return useQuery({
    queryKey: ['todays-queue', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get posts awaiting approval
      const { data: pendingPosts, error: postsError } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .eq('approval_status', 'pending');
      
      if (postsError) throw postsError;
      
      return {
        pendingApprovals: pendingPosts?.length || 0,
        scheduledToday: 0, // Would query scheduled sends
        automationErrors: 0, // Would query automation errors
      };
    },
    enabled: !!effectiveCompanyId,
  });
}
