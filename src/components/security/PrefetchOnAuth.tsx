import React, { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { isDeviceBound } from '@/utils/deviceBinding';

interface PrefetchOnAuthProps {
  children: React.ReactNode;
}

export const PrefetchOnAuth: React.FC<PrefetchOnAuthProps> = ({ children }) => {
  const { user, companyId, pinUser } = useAuth();
  const { prefetchData } = useDataPrefetch();

  useEffect(() => {
    // Skip prefetch if device binding has already loaded everything
    const hasDataSource = (user && companyId) || pinUser;
    
    if (hasDataSource) {
      const targetCompany = companyId || pinUser?.company_id;
      
      // ✅ Skip if DeviceDataManager is already running (bound device)
      if (DeviceDataManager.isRunning()) {
        console.log('✅ Skipping prefetch - DeviceDataManager active');
        return;
      }
      
      // ✅ Skip if not device-bound (standard users get data from queries)
      if (!isDeviceBound()) {
        console.log('✅ Skipping prefetch - standard query hooks will handle data loading');
        return;
      }
      
      // Check if comprehensive prefetch was already completed during device binding
      if (targetCompany && localStorage.getItem(`prefetch_complete_${targetCompany}`) === 'true') {
        // Even if prefetch completed, verify product links are cached
        const { queryClient } = require('@tanstack/react-query');
        const cachedLinks = queryClient.getQueryData(['menu-item-product-links', targetCompany]);
        
        if (!cachedLinks || Object.keys(cachedLinks).length === 0) {
          console.warn('⚠️ Product links missing from cache - fetching now');
          const { useQueryClient } = require('@tanstack/react-query');
          const client = useQueryClient();
          client.invalidateQueries({ 
            queryKey: ['menu-item-product-links', targetCompany],
            refetchType: 'active'
          });
        } else {
          console.log('✅ Skipping prefetch - comprehensive data already cached from device binding');
        }
        return;
      }
      
      console.log('🚀 Prefetching data for company:', targetCompany);
      prefetchData().catch(error => {
        console.warn('Data prefetch failed:', error);
      });
    }
  }, [user, companyId, pinUser, prefetchData]);

  return <>{children}</>;
};
