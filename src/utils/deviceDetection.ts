// Device detection utilities for tablet-specific optimizations

export interface DeviceInfo {
  isTablet: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
  orientation: 'portrait' | 'landscape';
  screenSize: 'small' | 'medium' | 'large';
}

// Detect if device is likely a tablet based on screen size and touch capability
export const isTabletDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const minWidth = Math.min(window.screen.width, window.screen.height);
  const maxWidth = Math.max(window.screen.width, window.screen.height);
  
  // Tablet characteristics: touch screen, larger than phone, smaller than desktop
  return hasTouch && minWidth >= 768 && maxWidth <= 1366;
};

// Get comprehensive device information
export const getDeviceInfo = (): DeviceInfo => {
  if (typeof window === 'undefined') {
    return {
      isTablet: false,
      isMobile: false,
      isDesktop: true,
      hasTouch: false,
      orientation: 'landscape',
      screenSize: 'large'
    };
  }
  
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const minDimension = Math.min(screenWidth, screenHeight);
  const maxDimension = Math.max(screenWidth, screenHeight);
  
  const isTablet = hasTouch && minDimension >= 768 && maxDimension <= 1366;
  const isMobile = hasTouch && maxDimension < 768;
  const isDesktop = !hasTouch || (!isTablet && !isMobile);
  
  let screenSize: 'small' | 'medium' | 'large';
  if (screenWidth < 768) screenSize = 'small';
  else if (screenWidth < 1024) screenSize = 'medium';
  else screenSize = 'large';
  
  return {
    isTablet,
    isMobile,
    isDesktop,
    hasTouch,
    orientation: screenWidth > screenHeight ? 'landscape' : 'portrait',
    screenSize
  };
};

// Log device information for debugging
export const logDeviceInfo = () => {
  const device = getDeviceInfo();
  console.log('📱 Device Detection:', {
    ...device,
    screenDimensions: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints
  });
  return device;
};

// Check if device supports efficient module preloading
export const supportsModulePreloading = (): boolean => {
  // Tablets and desktops benefit most from preloading
  const device = getDeviceInfo();
  return device.isTablet || device.isDesktop;
};

// Get bound device info from localStorage (captured during device binding)
export const getBoundDeviceInfo = (): DeviceInfo | null => {
  try {
    const boundCompany = localStorage.getItem('boundCompany');
    if (!boundCompany) return null;
    
    const parsed = JSON.parse(boundCompany);
    if (!parsed.device_profile) return null;
    
    const profile = parsed.device_profile;
    return {
      isTablet: profile.isTablet,
      isMobile: profile.isMobile,
      isDesktop: !profile.isTablet && !profile.isMobile,
      hasTouch: profile.hasTouch,
      orientation: profile.orientation,
      screenSize: profile.screenWidth < 768 ? 'small' : profile.screenWidth < 1024 ? 'medium' : 'large'
    };
  } catch {
    return null;
  }
};

// Create device profile during binding (captures permanent screen dimensions)
export const createDeviceProfile = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const screenWidth = window.screen.width; // Permanent device screen width
  const screenHeight = window.screen.height; // Permanent device screen height
  const minDimension = Math.min(screenWidth, screenHeight);
  const maxDimension = Math.max(screenWidth, screenHeight);
  
  const isTablet = hasTouch && minDimension >= 768 && maxDimension <= 1366;
  const isMobile = hasTouch && maxDimension < 768;
  
  return {
    screenWidth,
    screenHeight,
    isTablet,
    isMobile,
    orientation: (screenWidth > screenHeight ? 'landscape' : 'portrait') as 'portrait' | 'landscape',
    hasTouch
  };
};