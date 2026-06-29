import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface HealthCheckResult {
  service: string;
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Lightweight health check for bound devices
 * Calls all pin-* edge functions in parallel to verify data availability
 */
export const runBoundHealthCheck = async (companyId: string): Promise<HealthCheckResult[]> => {
  console.log('🏥 Running bound device health check for company:', companyId);
  
  const checks = await Promise.allSettled([
    supabase.functions.invoke('pin-menu-items-fetch', {
      body: { companyId, isDeviceBound: true }
    }).then(({ data, error }) => ({
      service: 'menu-items',
      success: !error && data?.success,
      count: data?.items?.length || 0,
      error: error?.message || data?.error
    })),
    
    supabase.functions.invoke('pin-menu-categories-fetch', {
      body: { companyId, isDeviceBound: true }
    }).then(({ data, error }) => ({
      service: 'categories',
      success: !error && data?.success,
      count: data?.categories?.length || 0,
      error: error?.message || data?.error
    })),
    
    supabase.functions.invoke('pin-customers-fetch', {
      body: { companyId, isDeviceBound: true }
    }).then(({ data, error }) => ({
      service: 'customers',
      success: !error && data?.success,
      count: data?.customers?.length || 0,
      error: error?.message || data?.error
    })),
    
    supabase.functions.invoke('pin-orders-fetch', {
      body: { companyId, isDeviceBound: true }
    }).then(({ data, error }) => ({
      service: 'orders',
      success: !error && data?.success,
      count: data?.orders?.length || 0,
      error: error?.message || data?.error
    })),
    
    supabase.functions.invoke('pin-tables-fetch', {
      body: { companyId, isDeviceBound: true }
    }).then(({ data, error }) => ({
      service: 'tables',
      success: !error && data?.success,
      count: data?.tables?.length || 0,
      error: error?.message || data?.error
    }))
  ]);

  const results: HealthCheckResult[] = checks.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        service: ['menu-items', 'categories', 'customers', 'orders', 'tables'][index],
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });

  // Log summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Health check: ${passed}/${results.length} services OK`);
  
  if (failed.length > 0) {
    console.warn('⚠️ Failed services:', failed);
    toast({
      title: "Data Sync Warning",
      description: `${failed.length} service(s) failed to load. Some data may be unavailable.`,
      variant: "destructive"
    });
  }

  return results;
};
