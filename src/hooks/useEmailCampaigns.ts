import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from './useCompanyId';

export interface EmailCampaign {
  id: string;
  company_id: string;
  platform: string;
  content: string;
  image_urls?: string[];
  approval_status: string;
  posted_at?: string;
  metadata?: {
    subject?: string;
    recipients?: number;
    open_rate?: number;
    click_rate?: number;
    delivered?: number;
  };
  created_at: string;
}

export function useEmailCampaigns() {
  const { companyId: effectiveCompanyId } = useCompanyId();

  return useQuery({
    queryKey: ['email-campaigns', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) throw new Error('No company ID');

      const { data, error } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .eq('platform', 'email')
        .order('posted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailCampaign[];
    },
    enabled: !!effectiveCompanyId,
  });
}
