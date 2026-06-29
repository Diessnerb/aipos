import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Reservation } from '@/types/reservation';
import { validateAuthContext } from '@/utils/dataGuards';
import { getRawPin } from '@/utils/pinAuth';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useCompanyId } from '@/hooks/useCompanyId';

const DEBUG_DRAG_DROP = false; // Set to true for detailed logging

interface DateSpecificReservations {
  date: string;
  reservations: Reservation[];
  lastUpdated: number;
  isToday: boolean;
  optimisticUpdates?: Map<string, number>; // Per-reservation optimistic timestamps
}

// Transform raw rows to Reservation shape with data normalization
const transformRows = (rows: any[] = []): Reservation[] => rows.map((reservation: any) => {
  let table_number = reservation.table_number || null;
  let table_numbers = reservation.table_numbers || null;
  
  // Normalize table data for consistency
  if (table_numbers?.length === 1) {
    table_number = table_numbers[0];
  } else if (table_number && (!table_numbers || table_numbers.length === 0)) {
    table_numbers = [table_number];
  }
  
  return {
    id: reservation.id,
    customer_name: reservation.customer_name,
    phone: reservation.phone || '',
    email: reservation.email || '',
    party_size: reservation.party_size,
    date: reservation.date,
    time: reservation.time || '19:00',
    end_time: reservation.end_time || null,
    table_number,
    table_numbers,
    notes: reservation.notes || '',
    status: (reservation.status as any) || 'pending',
    locked: Boolean(reservation.locked) || false,
    locked_until: reservation.locked_until || null,
    has_allergens: Boolean(reservation.has_allergens) || false,
    allergens: reservation.allergens || [],
  };
});

export const useUltraFastReservationsQuery = (selectedDate: string) => {
  const queryClient = useQueryClient();
  const { user, companyId, loading: authLoading, pinUser } = useAuth();
  const deviceLive = useDeviceLiveLayer();
  const { isBound } = useCompanyId();
  
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  // Create date-specific query key
  const queryKey = ['reservations-date', companyId, selectedDate];
  
  // Instant data access when device is bound
  const getInstantData = () => {
    if (deviceLive && companyId) {
      const cached = queryClient.getQueryData(queryKey) as any;
      
      // Expect STANDARD cache shape: { date, reservations: Reservation[], lastUpdated, isToday, preAuthMode }
      if (cached && cached.reservations && Array.isArray(cached.reservations)) {
        return cached.reservations;
      }
    }
    return undefined;
  };
  
  // Return instant data if available when device is bound
  const instantData = getInstantData();
  
  // Priority query for selected date (instant for today if cached)
  const query = useQuery<DateSpecificReservations>({
    queryKey,
    queryFn: async (): Promise<DateSpecificReservations> => {
      if (authLoading) {
        const cached = queryClient.getQueryData<DateSpecificReservations>(queryKey);
        return cached || { date: selectedDate, reservations: [], lastUpdated: Date.now(), isToday };
      }

      // If device is live, prioritize cached data
      if (deviceLive && instantData) {
        console.log('💨 Using device cache for reservations:', selectedDate);
        return { date: selectedDate, reservations: instantData, lastUpdated: Date.now(), isToday };
      }

      // For today, check if we have ultra-fresh cached data (< 30 seconds old)
      if (isToday) {
        const cached = queryClient.getQueryData<DateSpecificReservations>(queryKey);
        if (cached) {
          // When DeviceDataManager is active, trust its real-time updates
          // Only use cache if lastUpdated is 0 (real-time update flag)
          if (deviceLive && cached.lastUpdated === 0) {
            if (DEBUG_DRAG_DROP) {
              console.log(`⚡ ULTRA-FAST CACHE HIT: Real-time update from DeviceDataManager`);
            }
            return cached;
          }
        }
      }

      try {
        const { validCompanyId, isPinMode } = validateAuthContext(
          user, 
          pinUser, 
          companyId, 
          'useUltraFastReservationsQuery'
        );

        console.log(`⚡ Fetching ${isToday ? 'TODAY\'S' : 'date-specific'} reservations:`, selectedDate);

        let rawReservations: any[] = [];

        if (isPinMode) {
          const rawPin = getRawPin();
          if (!rawPin) throw new Error('PIN authentication expired');

          const { data: response, error } = await supabase.functions.invoke('pin-reservations-fetch', {
            body: { pin: rawPin, companyId: validCompanyId, isDeviceBound: isBound }
          });

          if (error) throw error;
          if (!response.success) throw new Error(response.error || 'Failed to fetch reservations via PIN');
          
          rawReservations = response.data || [];
        } else {
          const { data, error } = await supabase
            .from('reservations')
            .select(`
              id, customer_name, phone, email, party_size, date, time, end_time,
              table_number, table_numbers, notes, status, locked, locked_until, has_allergens, allergens
            `)
            .eq('company_id', validCompanyId)
            .eq('date', selectedDate)
            .order('time', { ascending: true });

          if (error) throw error;
          rawReservations = data || [];
        }

        // Filter for selected date and transform
        const dateReservations = rawReservations
          .filter(r => r.date === selectedDate)
          .map(reservation => transformRows([reservation])[0]);

        // Cache the result with metadata
        const cacheData: DateSpecificReservations = {
          date: selectedDate,
          reservations: dateReservations,
          lastUpdated: Date.now(),
          isToday
        };
        
        queryClient.setQueryData(queryKey, cacheData);

        // If this is today, also seed adjacent dates for instant navigation
        if (isToday && !isPinMode) {
          setTimeout(() => {
            const yesterday = new Date(new Date(selectedDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const tomorrow = new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            // Pre-cache adjacent dates
            [yesterday, tomorrow].forEach(date => {
              queryClient.prefetchQuery({
                queryKey: ['reservations-date', companyId, date],
                queryFn: async () => {
                  const adjacentData = rawReservations
                    .filter(r => r.date === date)
                    .map(reservation => transformRows([reservation])[0]);
                  
                  const adjacentCache: DateSpecificReservations = {
                    date,
                    reservations: adjacentData,
                    lastUpdated: Date.now(),
                    isToday: false
                  };
                  
                  return adjacentCache.reservations;
                },
                staleTime: isToday ? 30 * 1000 : 5 * 60 * 1000 // 30s for today, 5min for others
              });
            });
          }, 100); // Small delay to not block main query
        }

        return cacheData;
      } catch (error: any) {
        console.error('⚡ Ultra-fast query error:', error);
        throw error;
      }
    },
    enabled: !!companyId && !authLoading,
    retry: 0,
    staleTime: deviceLive ? 0 : (isToday ? 30 * 1000 : 2 * 60 * 1000), // 0 when live, 30s for today, 2min for other dates
    refetchOnWindowFocus: !deviceLive,
    refetchOnReconnect: isToday, // Only auto-reconnect for today
    refetchOnMount: false,
    refetchInterval: isToday && !deviceLive ? 15000 : false, // 15s polling for today when device live is off
    placeholderData: (prev) => prev, // Keep previous data while loading
  });

  // Real-time subscription for the currently selected date
  // Skip if DeviceDataManager is handling subscriptions
  useEffect(() => {
    if (!companyId || authLoading || deviceLive) {
      console.log('⚡ Skipping hook real-time subscription:', { companyId: !!companyId, authLoading, deviceLive, selectedDate });
      return;
    }
    
    console.log(`⚡ Setting up hook real-time subscription for date: ${selectedDate} (deviceLive: ${deviceLive})`);

    const channel = supabase
      .channel(`reservations-realtime-${selectedDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          // Only process if it affects today's date
          const affectedDate = (payload.new as any)?.date || (payload.old as any)?.date;
          if (affectedDate !== selectedDate) return;

          const eventId = (payload.new as any)?.id || (payload.old as any)?.id;
          console.log('⚡ Hook real-time update for today:', payload.eventType, { 
            id: eventId,
            table_number: (payload.new as any)?.table_number,
            table_numbers: (payload.new as any)?.table_numbers
          });
          
          const currentCache = queryClient.getQueryData<DateSpecificReservations>(queryKey);
          if (!currentCache) {
            console.log('⚡ No current cache found for hook update');
            return;
          }

          let updatedReservations = [...currentCache.reservations];

          if (payload.eventType === 'INSERT' && payload.new) {
            const newReservation = transformRows([payload.new])[0];
            updatedReservations.push(newReservation);
            console.log('⚡ Hook: Added reservation via real-time INSERT', newReservation.id);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const reservationId = payload.new.id;
            
            // Check for per-reservation optimistic update within 400ms window
            if (currentCache.optimisticUpdates) {
              const optimisticTimestamp = currentCache.optimisticUpdates.get(reservationId);
              
              if (optimisticTimestamp && Date.now() - optimisticTimestamp < 400) {
                // Smart event matching: compare real-time data with optimistic data
                const existingReservation = updatedReservations.find(r => r.id === reservationId);
                
                if (existingReservation) {
                  const tablesMatch = existingReservation.table_number === payload.new.table_number &&
                    JSON.stringify(existingReservation.table_numbers) === JSON.stringify(payload.new.table_numbers);
                  const timeMatches = existingReservation.time === payload.new.time;
                  
                  if (tablesMatch && timeMatches) {
                    if (DEBUG_DRAG_DROP) {
                      console.log('✅ Real-time matches optimistic - confirming', {
                        reservationId,
                        optimisticAge: Date.now() - optimisticTimestamp
                      });
                    }
                    // Clear optimistic flag and apply update
                    const updatedOptimisticMap = new Map(currentCache.optimisticUpdates);
                    updatedOptimisticMap.delete(reservationId);
                    currentCache.optimisticUpdates = updatedOptimisticMap;
                  } else {
                    if (DEBUG_DRAG_DROP) {
                      console.log('⏭️ Skipping real-time - conflicts with optimistic', {
                        reservationId,
                        optimisticAge: Date.now() - optimisticTimestamp,
                        tablesMatch,
                        timeMatches
                      });
                    }
                    return; // Don't override optimistic update
                  }
                }
              }
            }
            
            const updatedReservation = transformRows([payload.new])[0];
            updatedReservations = updatedReservations.map(r => 
              r.id === updatedReservation.id ? updatedReservation : r
            );
            if (DEBUG_DRAG_DROP) {
              console.log('⚡ Real-time: UPDATE event received', {
                id: updatedReservation.id,
                table_number: updatedReservation.table_number,
                table_numbers: updatedReservation.table_numbers,
                time: updatedReservation.time
              });
            }
          } else if (payload.eventType === 'DELETE' && payload.old) {
            updatedReservations = updatedReservations.filter(r => r.id !== payload.old.id);
            console.log('⚡ Hook: Removed reservation via real-time');
          }

          // Update cache instantly with fresh timestamp
          const updatedCache: DateSpecificReservations = {
            ...currentCache,
            reservations: updatedReservations,
            lastUpdated: Date.now() // Mark cache as fresh - trust real-time event data
          };
          
          queryClient.setQueryData(queryKey, updatedCache);
          
          // Force query invalidation with active refetch to trigger instant UI update
          queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
          
          if (payload.eventType === 'INSERT') {
            console.log('⚡ Hook: INSERT processed - cache updated, triggering instant re-render');
          } else if (payload.eventType === 'DELETE') {
            console.log('⚡ Hook: DELETE processed - cache updated, triggering instant re-render');
          }
          
          if (DEBUG_DRAG_DROP) {
            console.log('⚡ Real-time: Cache updated and invalidated');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, authLoading, isToday, selectedDate, queryKey, queryClient, deviceLive]);

  // Memoized return to prevent unnecessary re-renders
  return useMemo(() => {
    return {
      reservations: query.data?.reservations || [],
      loading: deviceLive ? false : query.isLoading, // Never loading when device live layer is active
      error: query.error?.message || null,
      refetch: query.refetch,
      isCacheHit: query.isPlaceholderData === false && !query.isFetching,
      isToday,
    };
  }, [query.data, query.isLoading, query.error, query.refetch, query.isPlaceholderData, query.isFetching, isToday, deviceLive]);
};