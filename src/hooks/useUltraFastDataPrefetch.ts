import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { getRawPin } from '@/utils/pinAuth';

interface PrecomputedTimelineData {
  date: string;
  reservations: any[];
  tableLayout: {
    operationalTables: any[];
    totalTables: number;
    maxSeats: number;
  };
  timelineMetrics: {
    totalReservations: number;
    peakHour: number;
    occupancyRate: number;
  };
  lastComputed: number;
}

export const useUltraFastDataPrefetch = () => {
  const queryClient = useQueryClient();
  
  // Safely get auth context - handle case where AuthProvider is not ready
  let user, companyId, pinUser;
  try {
    const auth = useAuth();
    user = auth.user;
    companyId = auth.companyId;
    pinUser = auth.pinUser;
  } catch (error) {
    console.warn('⚡ Auth context not yet available for ultra-fast prefetch');
    user = null;
    companyId = null;
    pinUser = null;
  }

  const prefetchTodayInstant = async () => {
    if ((!user && !pinUser) || !companyId) {
      console.log('⚡ Skipping ultra-fast prefetch - no auth or company ID');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // ✅ Check if DeviceDataManager already seeded cache
    const existingCache = queryClient.getQueryData(['reservations-date', companyId, today]);
    if (existingCache && typeof existingCache === 'object' && 'reservations' in existingCache) {
      const existingData = existingCache as any;
      if (Array.isArray(existingData.reservations) && existingData.reservations.length >= 0) {
        console.log('⚡ Cache already populated by DeviceDataManager, skipping ultra-fast prefetch');
        return existingData;
      }
    }
    
    const startTime = performance.now();
    console.log('⚡ Starting ultra-fast prefetch for TODAY:', today);

    try {
      let reservationsData: any[] = [];
      let tablesData: any[] = [];

      // Parallel fetch of critical today data
      if (pinUser) {
        const rawPin = getRawPin();
        if (!rawPin) {
          console.warn('⚡ PIN mode but no raw PIN available');
          return;
        }

        const { isDeviceBound } = await import('@/utils/deviceBinding');
        const bound = isDeviceBound();

        const [reservationsResult, tablesResult] = await Promise.allSettled([
          supabase.functions.invoke('pin-reservations-fetch', {
            body: { pin: rawPin, companyId, isDeviceBound: bound }
          }),
          // Fetch tables via standard query (PIN users still need table data)
          supabase
            .from('tables')
            .select('*')
            .eq('is_active', true)
            .eq('company_id', companyId)
            .order('table_number')
        ]);

        if (reservationsResult.status === 'fulfilled' && reservationsResult.value.data?.success) {
          reservationsData = reservationsResult.value.data.data || [];
        }
        
        if (tablesResult.status === 'fulfilled') {
          tablesData = tablesResult.value.data || [];
        }
      } else {
        const [reservationsResult, tablesResult] = await Promise.allSettled([
          supabase
            .from('reservations')
            .select(`
              id, customer_name, phone, email, party_size, date, time, end_time,
              table_number, table_numbers, notes, status, locked, has_allergens, allergens
            `)
            .eq('company_id', companyId)
            .eq('date', today)
            .order('time', { ascending: true }),
          
          supabase
            .from('tables')
            .select('*')
            .eq('is_active', true)
            .eq('company_id', companyId)
            .order('table_number')
        ]);

        if (reservationsResult.status === 'fulfilled') {
          reservationsData = reservationsResult.value.data || [];
        }
        
        if (tablesResult.status === 'fulfilled') {
          tablesData = tablesResult.value.data || [];
        }
      }

      // Pre-compute today's timeline data
      const todayReservations = reservationsData.filter(r => r.date === today);
      
      // Calculate operational tables
      const operationalTables = tablesData.filter(t => 
        t.is_active && (!t.service_status || t.service_status === 'available')
      );

      // Pre-compute timeline metrics
      const timelineMetrics = {
        totalReservations: todayReservations.length,
        peakHour: calculatePeakHour(todayReservations),
        occupancyRate: calculateOccupancyRate(todayReservations, operationalTables)
      };

      // Create precomputed cache entry for today
      const precomputedData: PrecomputedTimelineData = {
        date: today,
        reservations: todayReservations,
        tableLayout: {
          operationalTables,
          totalTables: operationalTables.length,
          maxSeats: Math.max(...operationalTables.map(t => t.seats), 0)
        },
        timelineMetrics,
        lastComputed: Date.now()
      };

      // Cache today's data with multiple keys for instant access
      queryClient.setQueryData(['reservations-date', companyId, today], {
        date: today,
        reservations: todayReservations,
        lastUpdated: Date.now(),
        isToday: true
      });

      queryClient.setQueryData(['timeline-precomputed', companyId, today], precomputedData);
      queryClient.setQueryData(['tables', companyId], tablesData);

      // Background prefetch for next 3 days
      setTimeout(() => {
        prefetchAdjacentDates(today, companyId, pinUser);
      }, 50); // Small delay to not block today's loading

      const endTime = performance.now();
      console.log(`⚡ Ultra-fast prefetch completed in ${Math.round(endTime - startTime)}ms`);
      
      return precomputedData;
    } catch (error) {
      console.error('⚡ Error in ultra-fast prefetch:', error);
    }
  };

  const prefetchAdjacentDates = async (baseDate: string, companyId: string, pinUser: any) => {
    const dates = [];
    const baseDateTime = new Date(baseDate);
    
    // Get yesterday, tomorrow, and day after tomorrow
    for (let i = -1; i <= 2; i++) {
      const date = new Date(baseDateTime.getTime() + i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split('T')[0]);
    }

    console.log('⚡ Background prefetching adjacent dates:', dates);

    for (const date of dates) {
      if (date === baseDate) continue; // Skip today, already cached

      try {
        let dateReservations: any[] = [];

        if (pinUser) {
          const rawPin = getRawPin();
          if (rawPin) {
            const { isDeviceBound } = await import('@/utils/deviceBinding');
            const bound = isDeviceBound();
            const { data: response } = await supabase.functions.invoke('pin-reservations-fetch', {
              body: { pin: rawPin, companyId, isDeviceBound: bound }
            });
            if (response?.success) {
              dateReservations = (response.data || []).filter((r: any) => r.date === date);
            }
          }
        } else {
          const { data } = await supabase
            .from('reservations')
            .select(`
              id, customer_name, phone, email, party_size, date, time, end_time,
              table_number, table_numbers, notes, status, locked, has_allergens, allergens
            `)
                .eq('company_id', companyId)
            .eq('date', date)
            .order('time', { ascending: true });

          dateReservations = data || [];
        }

        // Cache each date
        queryClient.setQueryData(['reservations-date', companyId, date], {
          date,
          reservations: dateReservations,
          lastUpdated: Date.now(),
          isToday: false
        });

        // Small delay between dates to not overwhelm
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`⚡ Error prefetching date ${date}:`, error);
      }
    }
  };

  return { prefetchTodayInstant };
};

// Helper functions
function calculatePeakHour(reservations: any[]): number {
  const hourCounts: { [hour: number]: number } = {};
  
  reservations.forEach(r => {
    if (r.time) {
      const hour = parseInt(r.time.split(':')[0]);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });

  return Object.entries(hourCounts).reduce(
    (peak, [hour, count]) => count > peak.count ? { hour: parseInt(hour), count } : peak,
    { hour: 19, count: 0 }
  ).hour;
}

function calculateOccupancyRate(reservations: any[], tables: any[]): number {
  if (!tables.length) return 0;
  
  const totalCapacity = tables.reduce((sum, table) => sum + (table.seats || 0), 0);
  const reservedSeats = reservations
    .filter(r => r.status !== 'cancelled')
    .reduce((sum, r) => sum + (r.party_size || 0), 0);
  
  return totalCapacity > 0 ? Math.round((reservedSeats / totalCapacity) * 100) : 0;
}