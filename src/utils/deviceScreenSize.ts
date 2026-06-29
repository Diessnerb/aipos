/**
 * Device-specific screen dimensions storage
 * Each device stores its own window dimensions independently
 */

export interface DeviceScreenDimensions {
  deviceId: string;
  physicalScreenWidth: number;   // screen.width (physical device screen)
  physicalScreenHeight: number;  // screen.height (physical device screen)
  initialViewportWidth: number;  // window.innerWidth at binding time
  initialViewportHeight: number; // window.innerHeight at binding time
  viewportWidth: number;          // Current viewport width (can change with orientation)
  viewportHeight: number;         // Current viewport height (can change with orientation)
  timestamp: number;
  isTablet: boolean;
  isMobile: boolean;
  orientation: 'portrait' | 'landscape';
}

const SCREEN_DIMENSIONS_KEY = 'device_screen_dimensions';

/**
 * Get device ID (use existing bound company as device identifier)
 */
function getDeviceId(): string | null {
  try {
    const bound = localStorage.getItem('boundCompany');
    if (!bound) return null;
    const parsed = JSON.parse(bound);
    return parsed.company_id || null;
  } catch {
    return null;
  }
}

/**
 * Detect device type and orientation from current window
 */
function detectDeviceProfile(): {
  isMobile: boolean;
  isTablet: boolean;
  orientation: 'portrait' | 'landscape';
} {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const orientation: 'portrait' | 'landscape' = width > height ? 'landscape' : 'portrait';
  
  return { isMobile, isTablet, orientation };
}

/**
 * Store device-specific screen dimensions
 */
export function setDeviceScreenDimensions(): void {
  const deviceId = getDeviceId();
  if (!deviceId) {
    console.warn('Cannot store screen dimensions - no device bound');
    return;
  }

  const profile = detectDeviceProfile();
  
  const dimensions: DeviceScreenDimensions = {
    deviceId,
    physicalScreenWidth: window.screen.width,
    physicalScreenHeight: window.screen.height,
    initialViewportWidth: window.innerWidth,
    initialViewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    timestamp: Date.now(),
    isTablet: profile.isTablet,
    isMobile: profile.isMobile,
    orientation: profile.orientation,
  };

  try {
    localStorage.setItem(SCREEN_DIMENSIONS_KEY, JSON.stringify(dimensions));
    console.log('📐 Device screen dimensions stored:', {
      physical: `${dimensions.physicalScreenWidth}x${dimensions.physicalScreenHeight}`,
      viewport: `${dimensions.initialViewportWidth}x${dimensions.initialViewportHeight}`,
      type: profile.isTablet ? 'Tablet' : profile.isMobile ? 'Mobile' : 'Desktop',
      orientation: profile.orientation,
    });
  } catch (error) {
    console.error('Failed to store screen dimensions:', error);
  }
}

/**
 * Get device-specific screen dimensions
 */
export function getDeviceScreenDimensions(): DeviceScreenDimensions | null {
  try {
    const stored = localStorage.getItem(SCREEN_DIMENSIONS_KEY);
    if (!stored) return null;

    const dimensions = JSON.parse(stored) as DeviceScreenDimensions;
    
    // Verify it's for the current device
    const currentDeviceId = getDeviceId();
    if (dimensions.deviceId !== currentDeviceId) {
      console.log('📐 Screen dimensions found but for different device');
      return null;
    }

    console.log('📐 Retrieved device screen dimensions:', {
      physical: `${dimensions.physicalScreenWidth}x${dimensions.physicalScreenHeight}`,
      viewport: `${dimensions.initialViewportWidth}x${dimensions.initialViewportHeight}`,
      age: `${Math.round((Date.now() - dimensions.timestamp) / 1000)}s`,
    });

    return dimensions;
  } catch (error) {
    console.error('Failed to read screen dimensions:', error);
    return null;
  }
}

/**
 * Update screen dimensions if they've changed significantly
 * Also updates viewport dimensions on orientation change
 */
export function updateScreenDimensionsIfChanged(): boolean {
  const current = getDeviceScreenDimensions();
  if (!current) {
    setDeviceScreenDimensions();
    return true;
  }

  const widthDiff = Math.abs(current.physicalScreenWidth - window.screen.width);
  const heightDiff = Math.abs(current.physicalScreenHeight - window.screen.height);
  
  // Check if orientation changed (viewport dimensions swapped)
  const currentProfile = detectDeviceProfile();
  const orientationChanged = current.orientation !== currentProfile.orientation;
  
  // Update if physical dimensions or orientation changed
  if (widthDiff > 10 || heightDiff > 10 || orientationChanged) {
    console.log('📐 Screen dimensions changed, updating:', {
      old: `${current.physicalScreenWidth}x${current.physicalScreenHeight} ${current.orientation}`,
      new: `${window.screen.width}x${window.screen.height} ${currentProfile.orientation}`,
      orientationChanged
    });
    setDeviceScreenDimensions();
    return true;
  }

  return false;
}

/**
 * Check and update device screen dimensions on orientation change
 * Call this when orientation change is detected
 */
export function checkAndUpdateDeviceScreenDimensions(): void {
  const updated = updateScreenDimensionsIfChanged();
  if (updated) {
    console.log('📐 Device dimensions updated after orientation change');
    // Trigger a layout recalculation by clearing any cached layouts
    window.dispatchEvent(new CustomEvent('device-dimensions-updated'));
  }
}

/**
 * Clear screen dimensions (on device unbind)
 */
export function clearDeviceScreenDimensions(): void {
  localStorage.removeItem(SCREEN_DIMENSIONS_KEY);
  console.log('📐 Device screen dimensions cleared');
}
