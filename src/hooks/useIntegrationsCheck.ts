import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from './useCompanyId';

interface Integration {
  id: string;
  service_name: string;
  connected: boolean;
  auth_token: string | null;
}

export const useIntegrationsCheck = () => {
  const { companyId } = useCompanyId();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAnyIntegrations, setHasAnyIntegrations] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchIntegrations = async () => {
      try {
        const { data, error } = await supabase
          .from('integrations')
          .select('id, service_name, connected, auth_token')
          .eq('company_id', companyId)
          .eq('connected', true);

        if (error) throw error;

        setIntegrations(data || []);
        setHasAnyIntegrations((data || []).length > 0);
      } catch (error) {
        console.error('Error fetching integrations:', error);
        setIntegrations([]);
        setHasAnyIntegrations(false);
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();

    // Subscribe to integration changes
    const channel = supabase
      .channel('integrations-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integrations',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          fetchIntegrations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const getConnectedPlatforms = () => {
    return integrations.filter(integration => integration.connected);
  };

  const isServiceConnected = (serviceName: string) => {
    return integrations.some(
      integration => integration.service_name === serviceName && integration.connected
    );
  };

  return {
    integrations,
    loading,
    hasAnyIntegrations,
    getConnectedPlatforms,
    isServiceConnected
  };
};