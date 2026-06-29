import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { offlineAwareUpdate } from '@/utils/offlineAwareSupabase';
import { useInstantData } from './useInstantData';
import { getRawPin } from '@/utils/pinAuth';
import type { DeliverySettings } from '@/types/delivery-db';

export const useDeliverySettings = () => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();
  const { getInstantDeliverySettings, isDeviceLive } = useInstantData();

  // Try instant data first
  const instantResult = getInstantDeliverySettings();
  const hasInstantData = instantResult.isInstant && instantResult.data;

  const { data: fetchedSettings, isLoading } = useQuery({
    queryKey: ['delivery_settings', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      // For bound devices, check cache first then use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['delivery_settings', companyId]);
        if (cached) {
          return cached as DeliverySettings;
        }

        const { data, error } = await supabase.functions.invoke('pin-delivery-settings-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return cached || null;
        }

        return (data.settings || null) as DeliverySettings | null;
      }

      // Web users: direct query
      const { data, error } = await supabase
        .from('delivery_settings' as any)
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      
      // If no settings exist, create default settings
      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from('delivery_settings' as any)
          .insert({
            company_id: companyId,
            auto_generate_orders: true,
            require_approval: true,
            auto_stock_deduction: true,
            track_wastage: true,
            enable_fifo_tracking: false,
            enable_shelf_life_alerts: false,
            low_stock_threshold_days: 3,
            lead_time_buffer_days: 1,
            profit_margin_alert_threshold: 30.0,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newSettings as any;
      }

      return data as any;
    },
    enabled: !!companyId && !hasInstantData,
    initialData: () => queryClient.getQueryData(['delivery_settings', companyId]),
    retry: 0,
  });

  const settings = hasInstantData ? (instantResult.data as DeliverySettings) : fetchedSettings;

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<DeliverySettings>) => {
      if (!companyId) throw new Error('No company ID');

      const rawPin = getRawPin();

      // If we have a PIN, use the edge function (bypasses RLS)
      if (rawPin) {
        const { data, error } = await supabase.functions.invoke('delivery-settings-update', {
          body: {
            pin: rawPin,
            companyId,
            updates,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to update settings');
        return data.data;
      }

      // Admin session: use direct update or offline-aware update
      if (!settings?.id) throw new Error('Settings not initialized');
      const data = await offlineAwareUpdate('delivery_settings', settings.id, updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['delivery_settings', companyId], data);
      queryClient.invalidateQueries({ queryKey: ['delivery_settings', companyId] });
      toast.success('Settings updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating settings:', error);
      const errorMessage = error?.message || 'Failed to update settings';
      toast.error(errorMessage);
    },
  });

  return {
    settings,
    isLoading: hasInstantData ? false : isLoading,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
};
