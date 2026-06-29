import React, { useEffect } from 'react';
import { getDeviceInfo, logDeviceInfo } from '@/utils/deviceDetection';
import { isDeviceBound, getBoundCompany } from '@/utils/deviceBinding';
import { isUILocked, SecureStorage } from '@/utils/secureStorage';
import { getCurrentPinUser } from '@/utils/pinAuth';

// Comprehensive debugging component for tablet authentication issues
export const TabletAuthDebugger: React.FC = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const device = getDeviceInfo();
    if (!device.isTablet) return; // Only debug on tablets
    
    // Start debugging session
    console.log('🔍 TABLET AUTH DEBUGGER STARTED');
    console.log('='.repeat(50));
    
    // Log initial state
    const logAuthState = () => {
      const boundCompany = getBoundCompany();
      const pinUser = getCurrentPinUser();
      const uiLocked = isUILocked();
      
      console.log('📱 TABLET AUTH STATE:', {
        device: logDeviceInfo(),
        boundCompany: boundCompany ? `${boundCompany.company_name} (${boundCompany.company_id})` : 'None',
        pinUser: pinUser ? `${pinUser.full_name} (${pinUser.user_id})` : 'None',
        uiLocked,
        secureStorageItems: {
          pinUser: !!SecureStorage.getItem('pinUser'),
          rawPin: !!SecureStorage.getItem('rawPin'),
          uiLocked: !!SecureStorage.getItem('uiLocked')
        },
        timestamp: new Date().toISOString()
      });
    };
    
    // Log initial state
    logAuthState();
    
    // Monitor navigation changes
    const logNavigation = () => {
      console.log('🧭 TABLET NAVIGATION:', window.location.pathname + window.location.search);
      logAuthState();
    };
    
    // Monitor orientation changes
    const logOrientationChange = () => {
      setTimeout(() => { // Wait for orientation to settle
        console.log('🔄 TABLET ORIENTATION CHANGED');
        logAuthState();
      }, 300);
    };
    
    // Monitor secure storage changes
    const logStorageChange = () => {
      console.log('💾 SECURE STORAGE CHANGED');
      logAuthState();
    };
    
    // Set up event listeners
    window.addEventListener('popstate', logNavigation);
    window.addEventListener('orientationchange', logOrientationChange);
    window.addEventListener('resize', logOrientationChange);
    window.addEventListener('storage', logStorageChange);
    window.addEventListener('pinUserChanged', logStorageChange);
    window.addEventListener('uiLockChanged', logStorageChange);
    
    // Performance monitoring for tablet-specific issues
    const performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes('login') || entry.name.includes('auth')) {
          console.log('⚡ TABLET PERFORMANCE:', {
            name: entry.name,
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime)
          });
        }
      });
    });
    
    performanceObserver.observe({entryTypes: ['navigation', 'measure']});
    
    return () => {
      window.removeEventListener('popstate', logNavigation);
      window.removeEventListener('orientationchange', logOrientationChange);
      window.removeEventListener('resize', logOrientationChange);
      window.removeEventListener('storage', logStorageChange);
      window.removeEventListener('pinUserChanged', logStorageChange);
      window.removeEventListener('uiLockChanged', logStorageChange);
      performanceObserver.disconnect();
      
      console.log('🔍 TABLET AUTH DEBUGGER STOPPED');
    };
  }, []);
  
  return null; // No UI, just debugging
};

export default TabletAuthDebugger;