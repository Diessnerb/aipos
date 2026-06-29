/**
 * Pre-Authentication Data Seeding
 * 
 * Converted from background polling to one-time seed
 * DeviceDataManager handles real-time updates for bound devices
 */

import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBoundCompany } from '@/utils/deviceBinding';
import { format, addDays, subDays } from 'date-fns';

const DEBUG = false;

/**
 * One-time data seeding for pre-auth state
 * Called once on app load for bound devices
 */
export async function seedPreAuthData(queryClient: QueryClient): Promise<void> {
  const boundCompany = getBoundCompany();
  if (!boundCompany?.company_id) {
    if (DEBUG) console.log('⏸️ No bound company, skipping pre-auth seed');
    return;
  }

  const companyId = boundCompany.company_id;
  const startTime = performance.now();
  if (DEBUG) console.log('🌱 Seeding pre-auth data for company:', companyId);

  try {
    // Seed date range (yesterday, today, tomorrow)
    const today = new Date();
    const dates = [
      format(subDays(today, 1), 'yyyy-MM-dd'),
      format(today, 'yyyy-MM-dd'),
      format(addDays(today, 1), 'yyyy-MM-dd'),
    ];

    // Parallel fetch: reservations, tables, company settings
    const [reservationsResult, tablesResult, settingsResult] = await Promise.all([
      supabase
        .from('reservations')
        .select('*')
        .eq('company_id', companyId)
        .in('date', dates)
        .order('date', { ascending: true })
        .order('time', { ascending: true }),
      
      supabase
        .from('tables')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('table_number', { ascending: true }),
      
      supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .single(),
    ]);

    // Check for errors
    if (reservationsResult.error) throw reservationsResult.error;
    if (tablesResult.error) throw tablesResult.error;
    if (settingsResult.error) throw settingsResult.error;

    // Cache reservations by date
    const today_str = format(today, 'yyyy-MM-dd');
    dates.forEach(date => {
      const dateReservations = (reservationsResult.data || []).filter((r: any) => r.date === date);
      const isToday = date === today_str;

      queryClient.setQueryData(['reservations-date', companyId, date], {
        date,
        reservations: dateReservations,
        lastUpdated: Date.now(),
        isToday,
      });
    });

    // Cache tables as plain array
    queryClient.setQueryData(['tables', companyId], tablesResult.data || []);

    // Cache company settings
    queryClient.setQueryData(['company_settings', companyId], settingsResult.data);

    const elapsed = performance.now() - startTime;
    if (DEBUG) {
      console.log(`✅ Pre-auth seed complete in ${elapsed.toFixed(0)}ms`, {
        reservations: (reservationsResult.data || []).length,
        tables: (tablesResult.data || []).length,
      });
    }
  } catch (error) {
    console.error('❌ Pre-auth seed error:', error);
  }
}

// Legacy exports for compatibility (no-ops)
export function startPreAuthManager(queryClient: QueryClient): void {
  console.log('ℹ️ PreAuthManager: Using DeviceDataManager instead');
}

export function stopPreAuthManager(): void {
  // No-op
}

export function isPreAuthManagerRunning(): boolean {
  return false;
}
