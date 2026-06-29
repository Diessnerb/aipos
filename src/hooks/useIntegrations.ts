import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';

interface Integration {
  id: string;
  service_name: string;
  connected: boolean;
  auth_token: string | null;
  created_at: string;
  last_synced_at: string | null;
  metadata?: any;
}

export const useIntegrations = () => {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const deviceLive = useDeviceLiveLayer();

  const fetchIntegrations = async () => {
    try {
      // If device live and we have company ID, use cached data
      if (deviceLive && companyId) {
        const cachedIntegrations = queryClient.getQueryData<Integration[]>(['integrations', companyId]) || [];
        console.log('🔌 Using cached integrations from device live layer');
        setIntegrations(cachedIntegrations);
        setLoading(false);
        return;
      }

      console.log('🔌 Fetching integrations from database');
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data || []);
      
      // Update cache for device live layer
      if (companyId) {
        queryClient.setQueryData(['integrations', companyId], data || []);
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    // Skip real-time subscription if device live
    if (deviceLive) return;

    // Subscribe to real-time changes
    const channel = supabase
      .channel('integrations_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'integrations' 
      }, () => {
        fetchIntegrations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceLive, companyId]);

  const connectIntegration = async (serviceId: string, credentials: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) throw new Error('No company found');

      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          company_id: userData.company_id,
          service_name: serviceId,
          auth_token: JSON.stringify(credentials),
          connected: true,
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_name,company_id'
        });

      if (error) throw error;

      toast({
        title: 'Integration Connected',
        description: 'Successfully connected to the service.'
      });
      
      return { success: true };
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect.',
        variant: 'destructive'
      });
      return { success: false };
    } finally {
      fetchIntegrations();
    }
  };

  const disconnectIntegration = async (serviceId: string) => {
    try {
      const integration = integrations.find(i => i.service_name === serviceId);
      if (!integration) throw new Error('Integration not found');

      const { error } = await supabase
        .from('integrations')
        .update({ 
          connected: false, 
          auth_token: null 
        })
        .eq('id', integration.id);

      if (error) throw error;

      toast({
        title: 'Integration Disconnected',
        description: 'Successfully disconnected from the service.'
      });

      return { success: true };
    } catch (error) {
      toast({
        title: 'Disconnection Failed',
        description: 'Failed to disconnect.',
        variant: 'destructive'
      });
      return { success: false };
    } finally {
      fetchIntegrations();
    }
  };

  const getIntegrationStatus = (serviceId: string) => {
    const integration = integrations.find(i => i.service_name === serviceId);
    const connected = integration?.connected || false;
    return {
      connected,
      status: connected ? 'connected' : 'disconnected',
      integration
    };
  };

  return {
    integrations,
    loading,
    fetchIntegrations,
    connectIntegration,
    disconnectIntegration,
    getIntegrationStatus,
    hasAnyIntegrations: integrations.some(i => i.connected)
  };
};

export type { Integration };
