import { useAuth } from '@/components/AuthProvider';
import { getBoundCompany } from '@/utils/deviceBinding';

/**
 * Central hook for getting the effective company ID.
 * For bound devices, ALWAYS returns the bound company ID regardless of auth state.
 * This ensures queries never "drop out" due to transient auth issues.
 */
export const useCompanyId = () => {
  const boundCompany = getBoundCompany();
  const { companyId: authCompanyId } = useAuth();
  
  // Bound device = company ID is locked and immutable
  if (boundCompany?.company_id) {
    return {
      companyId: boundCompany.company_id,
      source: 'device_binding',
      isLocked: true,
      isBound: true
    };
  }
  
  // Fallback to auth context for non-bound devices (web users)
  return {
    companyId: authCompanyId,
    source: 'auth_context',
    isLocked: false,
    isBound: false
  };
};
