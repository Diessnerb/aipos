import { clearPinUser } from './pinAuth';
import { supabase } from '@/integrations/supabase/client';
import { getBoundCompany, setBoundCompany, BoundCompany } from './deviceBinding';

/**
 * Resets authentication state while preserving device binding
 * Use this when fixing authentication issues WITHOUT unbinding the device
 * 
 * @param autoRedirect - If true, redirects to /login after reset. If false, returns without redirect.
 */
export const resetAuthenticationState = async (autoRedirect: boolean = true): Promise<boolean> => {
  console.log('🔄 Resetting authentication state (preserving device binding)...');
  
  // Clear PIN user data
  clearPinUser();
  
  // Sign out from Supabase
  await supabase.auth.signOut();
  
  // Selective localStorage clearing - NEVER touch device binding
  const keysToRemove = [
    'sb-blsrpowvuxcvhqkeykyi-auth-token', // Supabase auth
    'supabase.auth.token', // Legacy Supabase auth
    'pinUser', // PIN user data
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Clear all sessionStorage
  sessionStorage.clear();
  
  console.log('✅ Authentication state reset complete (device binding untouched)');
  
  // Only redirect if requested
  if (autoRedirect) {
    window.location.href = '/login';
  }
  
  return true;
};
