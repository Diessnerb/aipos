import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PinLoginPreloader } from '../preloading/PinLoginPreloader';
import { TabletAuthDebugger } from '../debugging/TabletAuthDebugger';
import { useModulePrefetch } from '@/hooks/useModulePrefetch';
import { isDeviceBound, getBoundCompany, getDeviceLocation } from '@/utils/deviceBinding';
import { getDeviceInfo } from '@/utils/deviceDetection';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { ReconnectionManager } from '@/device/ReconnectionManager';
import { BoundDeviceAuthWatchdog } from '@/device/BoundDeviceAuthWatchdog';
import { ScreenWakeLock } from '@/device/ScreenWakeLock';
import { CapacitorPermissionManager } from '@/device/CapacitorPermissionManager';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { runBoundHealthCheck } from '@/utils/boundHealthCheck';
import { supabase } from '@/integrations/supabase/client';

// Routes that should NOT run device-specific logic
const UNBOUND_ROUTES = [
  '/super-admin',
  '/super-admin-login', 
  '/owner-login'
];

interface DeviceBootstrapProps {
  children: React.ReactNode;
}

export const DeviceBootstrap: React.FC<DeviceBootstrapProps> = ({ children }) => {
  const [bootstrapped, setBootstrapped] = useState(false);
  const queryClient = useQueryClient();
  const location = useLocation();
  
  // Check if current route is an admin/unbound route
  const isUnboundRoute = UNBOUND_ROUTES.some(route => 
    location.pathname.startsWith(route)
  );
  
  // Use existing module prefetch hook
  useModulePrefetch();
  
  useEffect(() => {
    const initializeDevice = async () => {
      // Skip all device-specific logic for admin routes
      if (isUnboundRoute) {
        console.log('⏭️ DeviceBootstrap: Skipping device logic for admin route:', location.pathname);
        setBootstrapped(true);
        return;
      }
      
      const device = getDeviceInfo();
      console.log('⚡ DeviceBootstrap initializing for', device.isTablet ? 'tablet' : device.isMobile ? 'mobile' : 'desktop');
      
      // Check permissions on native platforms
      if (CapacitorPermissionManager.isNativePlatform()) {
        const permissions = await CapacitorPermissionManager.checkAllPermissions();
        console.log('📋 Device permissions:', permissions);
      }
      
      // DEFENSIVE: Verify company binding before starting DeviceDataManager
      const boundCompany = getBoundCompany();
      if (boundCompany?.company_id) {
        // Verify auth session is ready before proceeding
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error || !session) {
            console.warn('⚠️ DeviceBootstrap: Auth session not ready, waiting 2s...');
            await new Promise(r => setTimeout(r, 2000));
            
            // Re-check after wait
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (!retrySession) {
              console.error('❌ DeviceBootstrap: Auth session still not ready after wait');
            }
          }
        } catch (e) {
          console.warn('⚠️ DeviceBootstrap: Session check failed:', e);
        }
      }
      
      // Check if this is a page refresh
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const isPageRefresh = navigation?.type === 'reload';
      
      if (isPageRefresh) {
        console.log('🔄 Page refresh detected - validating device binding');
        
        // Verify device binding is intact after refresh
        if (isDeviceBound()) {
          const boundCompany = getBoundCompany();
          if (!boundCompany?.company_id) {
            console.error('❌ Device binding corrupted during refresh');
            toast({ 
              title: "Session Lost",
              description: "Please log in again.",
              variant: "destructive"
            });
            window.location.href = '/owner-login';
            return;
          }
          
          // If online, trigger reconnection to ensure everything is fresh
          if (navigator.onLine) {
            console.log('🚀 Triggering reconnection after page refresh');
            await ReconnectionManager.handleReconnection();
            
            // Verify device is still bound after reconnection
            if (!isDeviceBound()) {
              console.error('❌ Device binding lost during reconnection!');
              toast({
                title: "Binding Error",
                description: "Device binding was lost. Please log in as owner.",
                variant: "destructive"
              });
              window.location.href = '/owner-login';
              return;
            }
          }
        }
      }
      
      // Start DeviceDataManager early if device is bound
      if (isDeviceBound()) {
        const boundCompany = getBoundCompany();
        if (boundCompany?.company_id) {
          console.log('🚀 Starting DeviceDataManager early for bound device:', boundCompany.company_id);
          DeviceDataManager.initialize(queryClient);
          await DeviceDataManager.start(boundCompany.company_id);
          await DeviceDataManager.ensureCriticalCaches(boundCompany.company_id);
          console.log('✅ DeviceDataManager seed complete, data ready');
          
          // Setup wake lock based on device location
          const deviceLocation = getDeviceLocation();
          if (deviceLocation === 'kitchen') {
            console.log('🔒 Enabling screen wake lock for kitchen device');
            await ScreenWakeLock.enableWakeLock();
          }
          
          // Run health check to verify all services
          if (navigator.onLine) {
            runBoundHealthCheck(boundCompany.company_id);
          }
        }
      }
      
      setBootstrapped(true);
      console.log('✅ DeviceBootstrap complete');
    };
    
    initializeDevice();
  }, [queryClient, isUnboundRoute, location.pathname]);
  
  // CRITICAL: Start BoundDeviceAuthWatchdog for multi-tier self-healing auth
  useEffect(() => {
    if (!bootstrapped || isUnboundRoute) return;
    
    const boundCompany = getBoundCompany();
    if (!boundCompany?.company_id) return;

    console.log('🐕 Starting BoundDeviceAuthWatchdog (silent 4-tier recovery)');
    BoundDeviceAuthWatchdog.start();

    return () => {
      BoundDeviceAuthWatchdog.stop();
    };
  }, [bootstrapped, isUnboundRoute]);
  
  // CRITICAL: Watchdog to ensure DeviceDataManager stays running for bound devices
  useEffect(() => {
    if (!isDeviceBound() || isUnboundRoute) return;
    
    console.log('🐕 Starting DeviceDataManager watchdog');
    
    // Check every 10 seconds if manager should be running but isn't
    const watchdogInterval = setInterval(() => {
      const boundCompany = getBoundCompany();
      if (!boundCompany?.company_id) return;
      
      if (!DeviceDataManager.isRunning()) {
        console.warn('⚠️ Watchdog detected stopped DeviceDataManager - restarting');
        DeviceDataManager.initialize(queryClient);
        DeviceDataManager.start(boundCompany.company_id);
        DeviceDataManager.ensureCriticalCaches(boundCompany.company_id);
      }
    }, 10000);
    
    // Listen for visibility changes and page shows (bfcache restore)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isDeviceBound()) {
        console.log('👁️ Page visible, triggering reconnection check');
        await ReconnectionManager.handleReconnection();
        const boundCompany = getBoundCompany();
        if (boundCompany?.company_id) {
          await DeviceDataManager.ensureCriticalCaches(boundCompany.company_id);
        }
      }
    };
    
    const handlePageShow = async (event: PageTransitionEvent) => {
      if (event.persisted && isDeviceBound()) {
        console.log('🔄 Page restored from bfcache, triggering reconnection');
        await ReconnectionManager.handleReconnection();
        const boundCompany = getBoundCompany();
        if (boundCompany?.company_id) {
          await DeviceDataManager.ensureCriticalCaches(boundCompany.company_id);
        }
      }
    };
    
    const handlePinUserReady = async () => {
      if (!isDeviceBound()) return;
      const boundCompany = getBoundCompany();
      if (!boundCompany?.company_id) return;

      console.log('📌 PIN user context ready, ensuring data layer is active');

      // Start if needed
      if (!DeviceDataManager.isRunning()) {
        console.log('🚀 Starting DeviceDataManager after PIN login');
        DeviceDataManager.initialize(queryClient);
        await DeviceDataManager.start(boundCompany.company_id);
      } else {
        console.log('🔧 DeviceDataManager already running after PIN login');
      }

      // Always repair critical caches (idempotent, fast)
      console.log('🔧 Repairing critical caches after PIN login');
      await DeviceDataManager.ensureCriticalCaches(boundCompany.company_id);
    };
    
    const handleOnline = async () => {
      if (isDeviceBound()) {
        console.log('🌐 Network online, triggering reconnection');
        await ReconnectionManager.handleReconnection();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pinUserContextReady', handlePinUserReady);
    window.addEventListener('online', handleOnline);
    
    return () => {
      clearInterval(watchdogInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pinUserContextReady', handlePinUserReady);
      window.removeEventListener('online', handleOnline);
    };
  }, [queryClient, isUnboundRoute]);
  
  if (!bootstrapped) {
    // Show a minimal loading state while bootstrapping
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-8 h-8 bg-primary/20 rounded-full"></div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {/* Preloader components run in background */}
      <PinLoginPreloader />
      <TabletAuthDebugger />
      {children}
    </>
  );
};

export default DeviceBootstrap;