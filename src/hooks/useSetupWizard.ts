import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBoundCompany } from '@/utils/deviceBinding';

interface SetupStatus {
  needsSetup: boolean;
  setupCompleted: boolean;
  setupPath: 'pos' | 'manual' | null;
  isLoading: boolean;
  companyId: string | null;
}

export const useSetupWizard = () => {
  const [status, setStatus] = useState<SetupStatus>({
    needsSetup: false,
    setupCompleted: false,
    setupPath: null,
    isLoading: true,
    companyId: null
  });

  const checkSetupStatus = async () => {
    try {
      const boundCompany = getBoundCompany();
      if (!boundCompany) {
        setStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check company setup status
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('setup_completed, setup_path, first_admin_login_at')
        .eq('id', boundCompany.company_id)
        .single();

      if (companyError) {
        console.error('Error checking setup status:', companyError);
        setStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if there are existing tables and menu items
      const [tablesResult, menuItemsResult] = await Promise.all([
        supabase
          .from('tables')
          .select('id')
          .eq('company_id', boundCompany.company_id)
          .eq('is_active', true)
          .limit(1),
        supabase
          .from('menu_items')
          .select('id')
          .eq('company_id', boundCompany.company_id)
          .limit(1)
      ]);

      const hasExistingData = (tablesResult.data?.length || 0) > 0 || (menuItemsResult.data?.length || 0) > 0;
      const isFirstLogin = companyData.first_admin_login_at && 
        new Date(companyData.first_admin_login_at) > new Date(Date.now() - 24 * 60 * 60 * 1000); // within 24 hours

      // Determine if setup is needed
      const needsSetup = !companyData.setup_completed && (isFirstLogin || !hasExistingData);

      setStatus({
        needsSetup,
        setupCompleted: companyData.setup_completed || false,
        setupPath: companyData.setup_path as 'pos' | 'manual' | null,
        isLoading: false,
        companyId: boundCompany.company_id
      });

    } catch (error) {
      console.error('Error in setup wizard check:', error);
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const completeSetup = async () => {
    if (!status.companyId) return;

    // Use RPC function to bypass RLS (service_role / security definer)
    const { data, error } = await supabase
      .rpc('complete_company_setup', { p_company_id: status.companyId });

    if (error) {
      console.error('Error completing setup:', error);
    }

    // Mettre à jour le statut local immédiatement
    setStatus(prev => ({ ...prev, needsSetup: false, setupCompleted: true }));
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  return {
    ...status,
    completeSetup,
    refetch: checkSetupStatus
  };
};