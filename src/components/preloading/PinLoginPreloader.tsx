import React, { useEffect, useState } from 'react';
import { isDeviceBound } from '@/utils/deviceBinding';
import { getDeviceInfo, logDeviceInfo } from '@/utils/deviceDetection';

// Pre-import PIN login components for instant rendering
const preloadComponents = async () => {
  try {
    console.log('🔄 Pre-loading PIN login components...');
    const startTime = performance.now();
    
    // Import all PIN login related components
    await Promise.all([
      import('../auth/PinPad'),
      import('../auth/PinLoginWrapper'),
      import('../ui/button'),
      import('../ui/input')
    ]);
    
    const loadTime = performance.now() - startTime;
    console.log(`✅ PIN login components pre-loaded in ${Math.round(loadTime)}ms`);
    return true;
  } catch (error) {
    console.warn('⚠️ PIN login preload failed:', error);
    return false;
  }
};

export const PinLoginPreloader: React.FC = () => {
  const [preloaded, setPreloaded] = useState(false);
  
  useEffect(() => {
    // Only preload if device is bound (user will need PIN login)
    if (!isDeviceBound()) {
      return;
    }
    
    const device = logDeviceInfo();
    console.log('🚀 Starting PIN login preloader for', device.isTablet ? 'tablet' : device.isMobile ? 'mobile' : 'desktop');
    
    // Start preloading immediately
    const preloadTimer = setTimeout(async () => {
      const success = await preloadComponents();
      setPreloaded(success);
    }, 100); // Small delay to avoid blocking initial render
    
    return () => clearTimeout(preloadTimer);
  }, []);
  
  // Also preload on orientation change for tablets
  useEffect(() => {
    const device = getDeviceInfo();
    if (!device.isTablet) return;
    
    const handleOrientationChange = () => {
      console.log('🔄 Tablet orientation changed, ensuring PIN components are ready');
      // Re-trigger preload if needed
      if (!preloaded) {
        preloadComponents().then(setPreloaded);
      }
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [preloaded]);
  
  return null; // This component only handles preloading, no UI
};

export default PinLoginPreloader;