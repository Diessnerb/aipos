
import { supabase } from '@/integrations/supabase/client';
import { SecureStorage, setUILock, clearUILock } from './secureStorage';
import { isUILocked } from './secureStorage';
import { getBoundCompany } from './deviceBinding';

export interface PinUser {
  user_id: string;
  email?: string;
  full_name: string;
  role: string;
  company_id: string | null;
  is_owner?: boolean;
}

export const authenticateWithPin = async (pin: string, companyId: string): Promise<PinUser | null> => {
  try {
    console.log('🔐 Authenticating PIN for company:', companyId);
    
    // Check if we're online
    const isOnline = navigator.onLine;
    
    if (!isOnline) {
      // Try offline authentication (will fail gracefully until DB migration)
      console.log('📡 Offline mode - attempting offline PIN authentication');
      const { OfflinePinCacheService } = await import('@/device/OfflinePinCache');
      const offlineUser = OfflinePinCacheService.authenticateOffline(pin, companyId);
      
      if (!offlineUser) {
        console.warn('❌ Offline PIN authentication not available - requires internet');
        return null;
      }
      
      SecureStorage.setItem('rawPin', pin, 480);
      return {
        user_id: offlineUser.userId,
        full_name: offlineUser.fullName,
        role: offlineUser.role,
        company_id: offlineUser.companyId,
        is_owner: offlineUser.isOwner,
      };
    }
    
    // Online mode - use Supabase RPC
    const { data, error } = await supabase.rpc('authenticate_by_pin_for_company_secure', {
      pin_input: pin,
      company_id_input: companyId
    });

    if (error) {
      console.error('PIN authentication error:', error);
      return null;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.log('No user data returned from PIN authentication');
      return null;
    }

    const user = Array.isArray(data) ? data[0] : data;
    
    if (!user) {
      return null;
    }

    console.log('🔐 PIN authentication response:', user);

    const boundCompany = getBoundCompany();
    const resolvedCompanyId = user.company_id || boundCompany?.company_id;

    if (!resolvedCompanyId) {
      console.error('❌ No company_id available from RPC or bound device');
      return null;
    }

    const pinUserData = {
      user_id: user.user_id,
      full_name: user.user_name,
      role: user.user_role,
      company_id: resolvedCompanyId,
      is_owner: user.is_owner || user.user_role === 'owner'
    };

    SecureStorage.setItem('rawPin', pin, 480);

    console.log('🔐 Final PIN user data:', pinUserData);
    return pinUserData;
  } catch (error) {
    console.error('PIN authentication error:', error);
    
    // Fallback to offline if Supabase fails
    try {
      console.log('⚠️ Supabase auth failed, trying offline cache...');
      const { OfflinePinCacheService } = await import('@/device/OfflinePinCache');
      const offlineUser = OfflinePinCacheService.authenticateOffline(pin, companyId);
      
      if (offlineUser) {
        SecureStorage.setItem('rawPin', pin, 480);
        return {
          user_id: offlineUser.userId,
          full_name: offlineUser.fullName,
          role: offlineUser.role,
          company_id: offlineUser.companyId,
          is_owner: offlineUser.isOwner,
        };
      }
    } catch (offlineError) {
      console.error('Offline auth also failed:', offlineError);
    }
    
    return null;
  }
};

export const getCurrentPinUser = (): PinUser | null => {
  // If UI is locked, don't return PIN user (forces re-authentication)
  if (isUILocked()) {
    return null;
  }
  
  const pinUser = SecureStorage.getItem('pinUser');
  if (!pinUser) return null;
  
  // Validate pinUser has required fields - patch company_id from bound device if missing
  if (!pinUser.user_id) {
    console.warn('⚠️ PIN user missing user_id, clearing:', pinUser);
    SecureStorage.removeItem('pinUser');
    return null;
  }

  // Patch company_id from bound device if missing (for owner PINs)
  if (!pinUser.company_id) {
    const boundCompany = getBoundCompany();
    if (boundCompany?.company_id) {
      console.log('🔧 Patching PIN user company_id from bound device');
      pinUser.company_id = boundCompany.company_id;
      // Re-save the patched user
      SecureStorage.setItem('pinUser', pinUser, 480);
    } else {
      console.warn('⚠️ PIN user missing company_id and no bound device, clearing:', pinUser);
      SecureStorage.removeItem('pinUser');
      return null;
    }
  }
  
  console.log('📌 PIN User Data:', pinUser);
  return pinUser;
};

export const clearPinUser = () => {
  // Set UI lock when clearing PIN user (used by idle timeout)
  setUILock(true);
  SecureStorage.removeItem('pinUser');
  SecureStorage.removeItem('rawPin'); // Clear the raw PIN too
  // Dispatch event to notify AuthProvider
  window.dispatchEvent(new CustomEvent('pinUserChanged'));
};

export const setPinUser = (userData: PinUser) => {
  console.log('🔐 setPinUser called with:', userData.user_id);
  
  // Use secure storage with 8-hour expiration for PIN user sessions
  SecureStorage.setItem('pinUser', userData, 480);
  
  // Clear UI lock when successfully logging in
  clearUILock();
  
  // Dispatch event to notify AuthProvider synchronously (before navigation)
  window.dispatchEvent(new CustomEvent('pinUserChanged'));
  console.log('⚡ PIN user set instantly - ready for navigation');
};

// DEPRECATED: Removed waitForPinUserContext to eliminate delays
// PIN user context now updates synchronously via events

export const getRawPin = (): string | null => {
  return SecureStorage.getItem('rawPin');
};

export const clearPinUserByUserId = (userId: string) => {
  const currentPinUser = SecureStorage.getItem('pinUser');
  if (currentPinUser?.user_id === userId) {
    clearPinUser(); // Clear if it matches current user
  }
};
