import { supabase } from '@/integrations/supabase/client';
import { getBoundCompany } from './deviceBinding';

interface StabilizationResult {
  success: boolean;
  companyId: string | null;
  errors: string[];
}

/**
 * Ensures the device binding is fully stabilized before navigation.
 * Verifies auth session, company binding, and data readiness.
 * 
 * @param companyId - The company ID that was just bound
 * @param maxWaitMs - Maximum time to wait for stabilization (default 10s)
 * @returns Promise with stabilization result
 */
export const stabilizeBinding = async (
  companyId: string,
  maxWaitMs: number = 10000
): Promise<StabilizationResult> => {
  const errors: string[] = [];
  const startTime = Date.now();
  
  console.log('🔒 Starting binding stabilization phase...');

  // Check 1: Verify boundCompany is in localStorage
  let boundCompanyVerified = false;
  for (let i = 0; i < 5; i++) {
    const boundCompany = getBoundCompany();
    if (boundCompany?.company_id === companyId) {
      boundCompanyVerified = true;
      console.log('✅ Bound company verified in localStorage');
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  if (!boundCompanyVerified) {
    errors.push('Bound company verification failed');
    console.warn('⚠️ Bound company not found in localStorage');
  }

  // Check 2: Verify auth session is active
  let authVerified = false;
  for (let i = 0; i < 5; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authVerified = true;
      console.log('✅ Auth session verified');
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  if (!authVerified) {
    errors.push('Auth session verification failed');
    console.warn('⚠️ Auth session not ready');
  }

  // Check 3: Verify data can be fetched with the company ID
  let dataVerified = false;
  try {
    const { data, error } = await supabase
      .from('tables')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);
    
    if (!error) {
      dataVerified = true;
      console.log('✅ Data access verified');
    } else {
      console.warn('⚠️ Data access check failed:', error);
    }
  } catch (e) {
    console.warn('⚠️ Data verification exception:', e);
  }
  
  if (!dataVerified) {
    errors.push('Data access verification failed');
  }

  // Ensure minimum stabilization time (3 seconds minimum)
  const elapsed = Date.now() - startTime;
  const minStabilizationTime = 3000;
  if (elapsed < minStabilizationTime) {
    const remainingTime = minStabilizationTime - elapsed;
    console.log(`⏳ Waiting ${remainingTime}ms to reach minimum stabilization time...`);
    await new Promise(r => setTimeout(r, remainingTime));
  }

  const success = boundCompanyVerified && authVerified && dataVerified;
  const totalTime = Date.now() - startTime;
  
  console.log(`🔒 Binding stabilization ${success ? 'COMPLETED' : 'FAILED'}:`, {
    boundCompanyVerified,
    authVerified,
    dataVerified,
    totalTime: `${totalTime}ms`,
    errors: errors.length > 0 ? errors : 'none'
  });

  return {
    success,
    companyId: success ? companyId : null,
    errors
  };
};
