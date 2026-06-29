import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { isDeviceBound, getBoundCompany } from '@/utils/deviceBinding';

interface DeviceLiveLayerProviderProps {
  children: React.ReactNode;
}

export const DeviceLiveLayerProvider: React.FC<DeviceLiveLayerProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const { companyId, loading: authLoading } = useAuth();

  // Combined effect: Pre-initialize and start DeviceDataManager
  useEffect(() => {
    if (!isDeviceBound()) return;

    // Pre-initialize DeviceDataManager early for instant startup (async)
    DeviceDataManager.initialize(queryClient);
    
    // CRITICAL: Use fallback to bound company if auth companyId is temporarily null
    const boundCompany = getBoundCompany();
    const effectiveCompanyId = companyId || boundCompany?.company_id;
    
    console.log('📊 DeviceLiveLayerProvider state:', {
      authCompanyId: companyId,
      boundCompanyId: boundCompany?.company_id,
      effectiveCompanyId,
      authLoading,
      isRunning: DeviceDataManager.isRunning()
    });
    
    // Start data manager when we have effective company ID and not loading
    if (!authLoading && effectiveCompanyId) {
      // Only start if NOT already running to prevent redundant restarts
      if (!DeviceDataManager.isRunning()) {
        console.log('🚀 Starting DeviceDataManager for company:', effectiveCompanyId);
        DeviceDataManager.start(effectiveCompanyId);
      } else {
        console.log('✅ DeviceDataManager already running, preserving state');
        // Proactively repair missing critical caches on auth/bound state transitions
        DeviceDataManager.ensureCriticalCaches(effectiveCompanyId);
      }
      
      return () => {
        // Only stop on unmount if we're truly changing companies (not just transient null)
        const currentCompanyId = DeviceDataManager.getCompanyId();
        if (currentCompanyId && effectiveCompanyId && currentCompanyId !== effectiveCompanyId) {
          console.log('🛑 Stopping DeviceDataManager (company switch detected)');
          DeviceDataManager.stop();
        }
      };
    }
  }, [companyId, authLoading, queryClient]);

  // Session recovery listener - refetch critical queries
  useEffect(() => {
    const handleSessionRecovery = () => {
      console.log('🔄 Session recovered - invalidating critical queries');
      queryClient.invalidateQueries({ queryKey: ['open-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-ready-notifications'] });
    };

    window.addEventListener('session-recovered', handleSessionRecovery);
    return () => window.removeEventListener('session-recovered', handleSessionRecovery);
  }, [queryClient]);

  return <>{children}</>;
};