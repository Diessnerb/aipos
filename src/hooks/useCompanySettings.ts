import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { getRawPin } from '@/utils/pinAuth';
import { useLocation } from 'react-router-dom';
import { isOnSettingsPage } from '@/utils/debugConfig';
import { getDefaultCompanySettings } from '@/utils/brandingDefaults';
import { useQueryClient } from '@tanstack/react-query';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';

interface CompanySettings {
  id: string;
  company_name: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  support_contact: string | null;
  timezone: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_style: string | null;
  button_style: string | null;
  show_allergen_disclaimer: boolean | null;
  terms_of_service_url: string | null;
  privacy_policy_url: string | null;
  terms_url: string | null;
  auto_assign_tables: boolean;
  optimization_enabled: boolean | null;
  last_optimized_at: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  // Enhanced continuous optimization settings
  optimization_horizon_days: number | null;
  optimization_mode: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  strategic_optimization_enabled: boolean | null;
  accessible_spare_target: number | null;
  // Session lock settings
  pin_idle_timeout_seconds: number | null;
}

export const useCompanySettings = () => {
  // ALL hooks MUST be called unconditionally at the top
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const location = useLocation();
  const queryClient = useQueryClient();
  const deviceLive = useDeviceLiveLayer();
  
  // Call useAuth unconditionally - handle null/error in logic below
  let authContext;
  let authError = false;
  try {
    authContext = useAuth();
  } catch (error) {
    console.error('AuthProvider not available in useCompanySettings:', error);
    authError = true;
  }
  
  // Derive values from hooks
  const isOnSettingsPage = location.pathname.startsWith('/settings');
  const publicRoutes = ['/login', '/owner-login', '/setup-wizard'];
  const isOnPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));
  const { companyId, userRole, isOwner } = authContext || {};
  
  // Determine conditions AFTER all hooks are called
  const shouldSkipLoading = (isOnPublicRoute && !companyId) || authError;
  
  // Check device live layer for instant cached data (inside useEffect to avoid setState during render)
  useEffect(() => {
    if (deviceLive && companyId) {
      const cachedSettings = queryClient.getQueryData<CompanySettings>(['company_settings', companyId]);
      if (cachedSettings) {
        console.log('⚡ useCompanySettings: Returning instant cached data from device live layer');
        setSettings(cachedSettings);
        setLoading(false);
      }
    }
  }, [deviceLive, companyId, queryClient]);

  const fetchSettings = async () => {
    try {
      if (!companyId) {
        setLoading(false);
        return;
      }

      // Check for cached data even with device live layer, but still fetch in background
      const cachedSettings = queryClient.getQueryData<CompanySettings>(['company_settings', companyId]);
      if (cachedSettings && deviceLive) {
        console.log('⚡ useCompanySettings: Using cached data, will refresh in background');
        setSettings(cachedSettings);
        setLoading(false);
        // Continue to fetch fresh data below
      }

      const rawPin = getRawPin();
      const hasAdminSession = authContext?.user && !rawPin;
      const hasPinSession = authContext?.pinUser && rawPin;
      
      // Prioritize admin session over PIN session for consistency
      const useEdgeFunction = rawPin && !hasAdminSession;
      
      if (useEdgeFunction) {
        const response = await supabase.functions.invoke('company-settings-get', {
          body: {
            pin: rawPin,
            companyId: companyId,
            isAuthenticatedAdmin: false
          }
        });

        if (response.error || !response.data?.success) {
          console.error('Edge Function failed:', response.error || response.data);
          throw new Error('Failed to fetch settings');
        }

        if (response.data.data) {
          setSettings(response.data.data);
          return;
        } else {
          // No settings exist, create defaults if user has permission
          if (userRole === 'admin' || userRole === 'manager' || userRole === 'owner' || isOwner) {
            console.log('📝 Creating default settings via Edge Function...');
            const defaultCompanyName = response.data.companyName || 'Restaurant Admin';
            
            const defaultResponse = await supabase.functions.invoke('company-settings-update', {
              body: {
                pin: rawPin,
                companyId: companyId,
                updates: getDefaultCompanySettings(),
                isAuthenticatedAdmin: false
              }
            });

            if (defaultResponse.error || !defaultResponse.data?.success) {
              throw new Error(defaultResponse.data?.error || 'Failed to create default settings');
            }
            
            setSettings(defaultResponse.data.data);
            return;
          } else {
            // Read-only view for non-admin users
            setSettings({
              id: 'readonly',
              company_name: null,
              logo_url: null,
              email: null,
              phone: null,
              website_url: null,
              support_contact: null,
              timezone: null,
              primary_color: null,
              secondary_color: null,
              font_style: null,
              button_style: null,
              show_allergen_disclaimer: false,
              terms_of_service_url: null,
              privacy_policy_url: null,
              terms_url: null,
              auto_assign_tables: false,
              optimization_enabled: false,
              last_optimized_at: null,
              company_id: companyId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              optimization_horizon_days: 90,
              optimization_mode: 'disabled',
              quiet_hours_start: '00:00:00',
              quiet_hours_end: '06:00:00',
              strategic_optimization_enabled: false,
              accessible_spare_target: 1,
              pin_idle_timeout_seconds: 30
            });
            return;
          }
        }
      }

      // Use direct database access for admin sessions
      const [settingsResult, companyResult] = await Promise.all([
        supabase
          .from('company_settings')
          .select('*')
          .eq('company_id', companyId)
          .maybeSingle(),
        supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .maybeSingle()
      ]);

      if (settingsResult.error) {
        throw settingsResult.error;
      }
      
      if (settingsResult.data) {
        setSettings(settingsResult.data);
        // Update cache
        queryClient.setQueryData(['company_settings', companyId], settingsResult.data);
      } else if (userRole === 'admin' || userRole === 'manager' || userRole === 'owner' || isOwner) {
        const { data: newSettings, error: insertError } = await supabase
          .from('company_settings')
          .insert({ 
            company_id: companyId,
            ...getDefaultCompanySettings()
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }
        
        setSettings(newSettings);
        // Update cache
        queryClient.setQueryData(['company_settings', companyId], newSettings);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
      // Only show error toast if we're not on a public route and user should expect settings to load
      if (!isOnPublicRoute && (isOnSettingsPage || (companyId && (authContext?.user || authContext?.pinUser)))) {
        toast({
          title: "Error",
          description: "Failed to load company settings",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<CompanySettings>, skipValidation = false) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company ID available",
        variant: "destructive",
      });
      return;
    }

    // Check for readonly mode
    if (settings?.id === 'readonly') {
      toast({
        title: "Error",
        description: "You don't have permission to update settings",
        variant: "destructive",
      });
      return;
    }

    // Prevent double calls
    if (isSaving && !skipValidation) {
      console.log('🔄 Update already in progress, skipping duplicate call');
      return;
    }

    setIsSaving(true);
    console.log('🔄 Starting updateSettings:', { updates, companyId, isOwner, userRole, hasExistingSettings: !!settings });

    try {
      const rawPin = getRawPin();
      const hasAdminSession = authContext?.user && !rawPin;
      
      // Use edge function for PIN sessions, direct access for admin sessions
      if (rawPin && !hasAdminSession) {
        const response = await supabase.functions.invoke('company-settings-update', {
          body: {
            pin: rawPin,
            companyId: companyId,
            updates: updates,
            isAuthenticatedAdmin: false
          }
        });

        if (response.error || !response.data?.success) {
          throw new Error(response.data?.error || 'Update failed');
        }

        setSettings(response.data.data);
        // Update cache for all devices
        queryClient.setQueryData(['company_settings', companyId], response.data.data);
        queryClient.invalidateQueries({ queryKey: ['company_settings', companyId] });
      } else {
        // Direct update for admin sessions
        const { data: updatedData, error } = await supabase
          .from('company_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        setSettings(updatedData);
        // Update cache for all devices
        queryClient.setQueryData(['company_settings', companyId], updatedData);
        queryClient.invalidateQueries({ queryKey: ['company_settings', companyId] });
      }

      if (isOnSettingsPage) {
        toast({
          title: "Success",
          description: "Settings updated successfully",
        });
      }
      
    } catch (error) {
      console.error('Error updating settings:', error);
      if (isOnSettingsPage) {
        toast({
          title: "Error",
          description: "Failed to update settings",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateLogo = async (logoUrl: string) => {
    return updateSettings({ logo_url: logoUrl });
  };

  const uploadLogo = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo.${fileExt}`;
      const filePath = `${companyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: storageData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      await updateLogo(storageData.publicUrl);
      
      return storageData.publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    // Skip loading if on public route without auth or if auth error
    if (shouldSkipLoading) {
      setLoading(false);
      return;
    }

    if (!companyId) {
      setLoading(false);
      return;
    }

    fetchSettings();

    // Always set up realtime subscription for company-wide synchronization
    // This ensures all devices (bound or not) get updates in real-time
    const channel = supabase
      .channel(`company_settings_changes_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_settings',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('Real-time settings update received for company:', companyId);
          fetchSettings();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${companyId}`
        },
        (payload) => {
          console.log('Real-time company update received:', companyId);
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [companyId, shouldSkipLoading]);

  return {
    settings,
    loading,
    isSaving,
    updateSettings,
    updateLogo,
    uploadLogo,
    refetch: fetchSettings
  };
};