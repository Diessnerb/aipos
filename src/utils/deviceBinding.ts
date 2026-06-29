export interface DeviceProfile {
  screenWidth: number; // Permanent screen.width - never changes
  screenHeight: number; // Permanent screen.height - never changes
  isTablet: boolean;
  isMobile: boolean;
  orientation: 'portrait' | 'landscape';
  hasTouch: boolean;
}

export interface PreCalculatedLayouts {
  // Layout calculations for common scenarios
  containerPadding: number;
  tableColumnWidth: number;
  seatsColumnWidth: number;
  minColumnWidth: number;
  headerHeight: number;
  minRowHeight: number;
}

export interface TimelineSkeletonDimensions {
  TABLE_COLUMN_WIDTH: number;
  SEATS_COLUMN_WIDTH: number;
  COLUMN_WIDTH: number;
  timelineWidth: number;
  ROW_HEIGHT: number;
  ROW_REMAINDER: number;
  totalWidth: number;
  totalGridHeight: number;
  containerWidth: number;
  containerHeight: number;
  tableCount: number;
  timeSlotCount: number;
  timestamp: number;
}

import { setDeviceScreenDimensions, clearDeviceScreenDimensions } from './deviceScreenSize';
import { setUILock } from './secureStorage';

export interface BoundCompany {
  company_id: string;
  company_name: string;
  bound_at: string; // ISO timestamp
  device_profile: DeviceProfile;
  precalculated_layouts: PreCalculatedLayouts;
  skeleton_dimensions?: TimelineSkeletonDimensions; // Pre-calculated skeleton dimensions
  device_location?: 'bar' | 'floor' | 'kitchen'; // Device physical location
}

const STORAGE_KEY = 'boundCompany';

export const setBoundCompany = (company: { 
  company_id: string; 
  company_name: string;
  device_profile: DeviceProfile;
  precalculated_layouts: PreCalculatedLayouts;
}) => {
  const payload: BoundCompany = {
    company_id: company.company_id,
    company_name: company.company_name,
    bound_at: new Date().toISOString(),
    device_profile: company.device_profile,
    precalculated_layouts: company.precalculated_layouts,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  
  // Store device-specific screen dimensions (current window size, not screen.width/height)
  setDeviceScreenDimensions();
  
  console.log('📱 Device bound with screen profile:', {
    screen: `${company.device_profile.screenWidth}x${company.device_profile.screenHeight}`,
    type: company.device_profile.isTablet ? 'Tablet' : company.device_profile.isMobile ? 'Mobile' : 'Desktop',
    orientation: company.device_profile.orientation,
    layouts: company.precalculated_layouts
  });
};

export const getBoundCompany = (): BoundCompany | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BoundCompany;
  } catch {
    return null;
  }
};

/**
 * Clears device binding and all cached company data.
 * 
 * ⚠️ CRITICAL - Only call this in these TWO scenarios:
 * 1. Manual unbind in Settings (with owner authentication)
 * 2. Account deletion (owner deleting their account)
 * 
 * ❌ NEVER call this for:
 * - Wrong PINs
 * - Auth failures
 * - Session expiration
 * - Network issues
 * - Reconnection failures
 * - Company ID mismatches (these indicate auth bugs, not security threats)
 * 
 * Device binding should be permanent until explicitly unbound by the owner.
 */
export const clearBoundCompany = () => {
  const boundCompany = getBoundCompany();
  localStorage.removeItem(STORAGE_KEY);
  
  // Clear device-specific screen dimensions
  clearDeviceScreenDimensions();
  
  // FIX #4: Clear offline caches when unbinding for security
  if (boundCompany) {
    // Dynamic imports to avoid circular dependencies
    import('./deviceBinding').then(() => {
      import('../device/OfflinePinCache').then(({ OfflinePinCacheService }) => {
        OfflinePinCacheService.clearCache();
      });
      import('../device/OfflineStorageService').then(({ OfflineStorage }) => {
        OfflineStorage.clearCompanyCache(boundCompany.company_id);
      });
    });
  }
  
  // Set UI lock when unbinding device
  setUILock(true);
};

export const isDeviceBound = () => !!getBoundCompany();

// Get device location
export const getDeviceLocation = (): 'bar' | 'floor' | 'kitchen' | null => {
  const boundCompany = getBoundCompany();
  return boundCompany?.device_location || null;
};

// Set device location (updates existing bound company data)
export const setDeviceLocation = (location: 'bar' | 'floor' | 'kitchen') => {
  const boundCompany = getBoundCompany();
  if (!boundCompany) {
    console.error('❌ Cannot set device location - device not bound');
    return;
  }
  
  const updated: BoundCompany = {
    ...boundCompany,
    device_location: location
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  console.log('📍 Device location set:', location);
};

// Check if device location is configured
export const isDeviceLocationConfigured = (): boolean => {
  return getDeviceLocation() !== null;
};
