import { supabase } from '@/integrations/supabase/client';
import { getBoundCompany, clearBoundCompany, isDeviceBound } from '@/utils/deviceBinding';
import { getCurrentPinUser, clearPinUser } from '@/utils/pinAuth';
import { DeviceDataManager } from './DeviceDataManager';
import { OfflineMutationQueue } from './OfflineMutationQueue';
import { toast } from '@/hooks/use-toast';

class ReconnectionManagerClass {
  private reconnecting = false;

  async handleReconnection(silent: boolean = false): Promise<boolean> {
    if (this.reconnecting) return false;
    
    this.reconnecting = true;
    if (!silent) {
      console.log('🔄 Starting reconnection sequence...');
    }

    try {
      // Step 1: Verify device binding
      const boundCompany = getBoundCompany();
      if (!boundCompany?.company_id) {
        console.error('❌ Device not bound');
        toast({ 
          title: "Connection Error",
          description: "Device binding lost. Please log in again.",
          variant: "destructive"
        });
        window.location.href = '/owner-login';
        return false;
      }

      // Step 2: Refresh auth session (optional for bound devices)
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('⚠️ Session refresh failed:', error);
        // Check if PIN user is still valid
        const pinUser = getCurrentPinUser();
        
        // CRITICAL: For bound devices, absence of PIN user just means we're at the PIN gate
        // This is NOT an error condition - don't redirect or clear binding
        if (!pinUser) {
          console.log('📌 No PIN user (at PIN gate), but device is bound - this is OK');
          // Don't toast, don't redirect to /login, device stays bound
          // Just ensure the data layer is running
          if (!DeviceDataManager.isRunning()) {
            console.log('🚀 Ensuring DeviceDataManager is running for bound device');
            await DeviceDataManager.start(boundCompany.company_id);
          }
          return true; // Successful - device is bound and data layer is ready
        }
      } else {
        console.log('✅ Session refreshed');
      }

      // Step 3: Validate company ID consistency (only if PIN user exists)
      // NOTE: This should NEVER happen if PIN authentication is working correctly
      // PIN auth is already company-scoped at database level - any mismatch indicates a bug
      const pinUser = getCurrentPinUser();
      if (pinUser && pinUser.company_id !== boundCompany.company_id) {
        console.error('❌ Company ID mismatch detected - this indicates an auth bug');
        clearPinUser();
        // DO NOT unbind device - this is just a wrong PIN, not a security threat
        toast({ 
          title: "Invalid PIN",
          description: "Please try again.",
          variant: "destructive"
        });
        window.location.href = '/login';
        return false;
      }

      // Step 4: Ensure DeviceDataManager is running (don't stop/restart unnecessarily)
      if (!DeviceDataManager.isRunning()) {
        console.log('🚀 Starting DeviceDataManager...');
        await DeviceDataManager.start(boundCompany.company_id);
      } else {
        console.log('✅ DeviceDataManager already running');
      }

      // Step 5: Sync offline mutations
      console.log('🔄 Syncing offline data...');
      await OfflineMutationQueue.syncQueue(boundCompany.company_id);

      console.log('✅ Reconnection complete');
      
      // Only show toast if not in silent mode
      if (!silent) {
        toast({ 
          title: "Back Online",
          description: "Connection restored successfully.",
        });
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      toast({ 
        title: "Reconnection Failed",
        description: "Unable to restore connection. Please refresh.",
        variant: "destructive"
      });
      return false;
    } finally {
      this.reconnecting = false;
    }
  }
}

export const ReconnectionManager = new ReconnectionManagerClass();
