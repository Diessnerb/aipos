import CryptoJS from 'crypto-js';
import { supabase } from '@/integrations/supabase/client';

interface CachedPinUser {
  userId: string;
  fullName: string;
  role: string;
  companyId: string;
  isOwner: boolean;
  pinHash: string; // Hashed PIN for security
  cachedAt: number;
  expiresAt: number; // FIX #5: Add expiry
}

const STORAGE_KEY = 'cached_pin_users';
const ENCRYPTION_KEY = 'device-pin-cache-v1'; // Device-specific key
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export class OfflinePinCacheService {
  
  /**
   * Cache PIN users during device binding for offline authentication
   */
  static async cacheCompanyPinUsers(companyId: string): Promise<void> {
    try {
      console.log('🔐 Caching PIN users for company:', companyId);
      
      // Import dependencies dynamically to avoid circular imports
      const { getRawPin } = await import('@/utils/pinAuth');
      const { supabase } = await import('@/integrations/supabase/client');
      
      const rawPin = getRawPin();
      if (!rawPin) {
        console.warn('⚠️ No PIN available for caching users');
        return;
      }

      // Fetch users via edge function
      const { data, error } = await supabase.functions.invoke('pin-users-fetch', {
        body: { pin: rawPin, companyId, isDeviceBound: false }
      });

      if (error || !data?.success) {
        console.error('❌ Failed to fetch users for caching:', error);
        return;
      }

      const users = data.users || [];
      const now = Date.now();
      const expiresAt = now + CACHE_DURATION;

      // Build cache entries with hashed PINs
      const cachedUsers: CachedPinUser[] = users
        .filter((u: any) => u.pin) // Only cache users with PINs
        .map((u: any) => ({
          userId: u.id,
          fullName: u.full_name,
          role: u.role,
          companyId: u.company_id,
          isOwner: u.role === 'owner',
          pinHash: CryptoJS.SHA256(u.pin).toString(),
          cachedAt: now,
          expiresAt
        }));

      if (cachedUsers.length === 0) {
        console.warn('⚠️ No users with PINs found to cache');
        return;
      }

      // Encrypt and store
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(cachedUsers),
        ENCRYPTION_KEY
      ).toString();

      localStorage.setItem(STORAGE_KEY, encrypted);
      console.log(`✅ Cached ${cachedUsers.length} PIN users for offline authentication`);
    } catch (error) {
      console.error('❌ Failed to cache PIN users:', error);
      // Non-critical - offline PIN won't work but app continues
    }
  }

  /**
   * Authenticate PIN offline using cached data
   */
  static authenticateOffline(pin: string, companyId: string): {
    userId: string;
    fullName: string;
    role: string;
    companyId: string;
    isOwner: boolean;
  } | null {
    try {
      const encrypted = localStorage.getItem(STORAGE_KEY);
      if (!encrypted) {
        console.warn('⚠️ No cached PIN users - offline auth not available');
        return null;
      }

      // Decrypt cache
      const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
      const cachedUsers: CachedPinUser[] = JSON.parse(decrypted);

      // Hash input PIN
      const pinHash = CryptoJS.SHA256(pin).toString();

      // Find matching user with company validation and expiry check
      const now = Date.now();
      const match = cachedUsers.find(
        u => u.pinHash === pinHash && 
             u.companyId === companyId &&
             u.expiresAt > now // FIX #5: Check expiry
      );

      if (!match) {
        // Check if it's an expired entry
        const expiredMatch = cachedUsers.find(u => u.pinHash === pinHash && u.companyId === companyId);
        if (expiredMatch && expiredMatch.expiresAt <= now) {
          console.log('🔐 PIN cache expired - clearing cache');
          this.clearCache();
        } else {
          console.log('🔐 No matching PIN found in offline cache');
        }
        return null;
      }

      console.log('✅ Offline PIN authentication successful:', match.fullName);
      return {
        userId: match.userId,
        fullName: match.fullName,
        role: match.role,
        companyId: match.companyId,
        isOwner: match.isOwner,
      };
    } catch (error) {
      console.error('❌ Offline PIN authentication failed:', error);
      return null;
    }
  }

  /**
   * Clear cached PIN users (when device is unbound)
   */
  static clearCache(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🧹 Cleared offline PIN cache');
  }
}
