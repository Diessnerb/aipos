import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from './useCompanyId';

export interface SMSCampaign {
  id: string;
  company_id: string;
  platform: string;
  content: string;
  approval_status: string;
  posted_at?: string;
  metadata?: {
    name?: string;
    recipients?: number;
    delivery_rate?: number;
    reply_rate?: number;
    delivered?: number;
  };
  created_at: string;
}

export function useSMSCampaigns() {
  const { companyId: effectiveCompanyId } = useCompanyId();

  return useQuery({
    queryKey: ['sms-campaigns', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) throw new Error('No company ID');

      const { data, error } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .eq('platform', 'sms')
        .order('posted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SMSCampaign[];
    },
    enabled: !!effectiveCompanyId,
  });
}
