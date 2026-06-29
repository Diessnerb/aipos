import { useEffect } from 'react';

// Prefetch critical modules to avoid loading delays
export const useModulePrefetch = () => {
  useEffect(() => {
    // Prefetch commonly used pages to avoid Suspense fallbacks
    const prefetchModules = async () => {
      try {
        // Prefetch admin/settings pages and common entry points
        await Promise.all([
          import('../pages/settings/CompanyDetailsSettings'),
          import('../pages/settings/TeamMembersSettings'),
          import('../pages/settings/BrandingSettings'),
          import('../pages/settings/TableAssignmentSettings'),
          import('../pages/settings/MenuSettings'),
          import('../pages/settings/AccessLevelSettings'),
          import('../pages/SuperAdminDashboard'),
          import('../pages/OwnerLogin'),
          import('../pages/SetupWizardPage'),
          import('../pages/DeliveryPage'),
          import('../pages/SuppliersPage'),
          import('../pages/WastagePage'),
          import('../pages/AnalyticsPage')
        ]);
      } catch (error) {
        console.warn('Module prefetch failed:', error);
      }
    };

    // Start prefetching after app is fully loaded
    const timeoutId = setTimeout(prefetchModules, 1000);
    
    return () => clearTimeout(timeoutId);
  }, []);
};