import { DeviceDataManager } from '@/device/DeviceDataManager';
import { isDeviceBound } from '@/utils/deviceBinding';

/**
 * Hook to check if the device-level live data layer is active
 * When true, components should avoid setting up their own subscriptions
 * and rely on the DeviceDataManager for real-time updates
 */
export const useDeviceLiveLayer = () => {
  const isDeviceActive = DeviceDataManager.isRunning();
  const isBound = isDeviceBound();
  const debugInfo = DeviceDataManager.getDebugInfo();
  
  return {
    isActive: isBound && isDeviceActive,
    isOfflineMode: debugInfo.offlineMode,
    lastSync: debugInfo.lastOnlineSync
  };
};