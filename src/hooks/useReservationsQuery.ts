import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Reservation } from '@/types/reservation';
import { validateAuthContext } from '@/utils/dataGuards';
import { getRawPin } from '@/utils/pinAuth';

export const useReservationsQuery = () => {
  const queryClient = useQueryClient();
  const { user, companyId, loading: authLoading, pinUser } = useAuth();
  // Transform raw rows to Reservation shape
  const transformRows = (rows: any[] = []): Reservation[] => rows.map((reservation: any) => ({
    id: reservation.id,
    customer_name: reservation.customer_name,
    phone: reservation.phone || '',
    email: reservation.email || '',
    party_size: reservation.party_size,
    date: reservation.date,
    time: reservation.time || '19:00',
    end_time: reservation.end_time || null,
    table_number: reservation.table_number || null,
    table_numbers: reservation.table_numbers || null,
    notes: reservation.notes || '',
    status: (reservation.status as any) || 'pending',
    locked: Boolean(reservation.locked) || false,
    has_allergens: Boolean(reservation.has_allergens) || false,
    allergens: reservation.allergens || [],
  }));

  // Only create query when auth is ready
  const query = useQuery({
    queryKey: ['reservations', companyId],
    initialData: () => {
      const cached = queryClient.getQueryData<any[]>(['reservations', companyId]);
      return cached ? transformRows(cached) : undefined;
    },
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<Reservation[]> => {
      if (authLoading) {
        console.log('📅 Auth loading - serving cached reservations');
        const cached = queryClient.getQueryData<any[]>(['reservations', companyId]);
        return transformRows(cached || []);
      }

      try {
        const { validCompanyId, isPinMode } = validateAuthContext(
          user, 
          pinUser, 
          companyId, 
          'useReservationsQuery'
        );

        console.log('📅 Fetching reservations via React Query', {
          companyId: validCompanyId,
          isPinMode
        });

        if (isPinMode) {
          // First check if we have cached data - use it immediately for instant loading
          const cached = queryClient.getQueryData<any[]>(['reservations', validCompanyId]);
          if (cached && cached.length > 0) {
            console.log('📅 Using cached reservations for PIN mode - instant loading');
            // Schedule background refresh after 5 seconds if cache is older than 2 minutes
            const cacheTime = queryClient.getQueryState(['reservations', validCompanyId])?.dataUpdatedAt || 0;
            const isStale = Date.now() - cacheTime > 2 * 60 * 1000; // 2 minutes
            
            if (isStale) {
              setTimeout(async () => {
                console.log('📅 Background refresh of reservations data');
                const rawPin = getRawPin();
                if (rawPin) {
                  const { isDeviceBound } = await import('@/utils/deviceBinding');
                  const bound = isDeviceBound();
                  supabase.functions.invoke('pin-reservations-fetch', {
                    body: { pin: rawPin, companyId: validCompanyId, isDeviceBound: bound }
                  }).then(({ data: response, error }) => {
                    if (!error && response?.success) {
                      const freshData = (response.data || []).map((reservation: any) => ({
                        id: reservation.id,
                        customer_name: reservation.customer_name,
                        phone: reservation.phone || '',
                        email: reservation.email || '',
                        party_size: reservation.party_size,
                        date: reservation.date,
                        time: reservation.time || '19:00',
                        end_time: reservation.end_time || null,
                        table_number: reservation.table_number || null,
                        table_numbers: reservation.table_numbers || null,
                        notes: reservation.notes || '',
                        status: (reservation.status as any) || 'pending',
                        locked: Boolean(reservation.locked) || false,
                        has_allergens: Boolean(reservation.has_allergens) || false,
                        allergens: reservation.allergens || [],
                      }));
                      queryClient.setQueryData(['reservations', validCompanyId], freshData);
                    }
                  });
                }
              }, 5000);
            }
            
            return transformRows(cached);
          }

          // Fallback to edge function if no cache available
          const rawPin = getRawPin();
          if (!rawPin) {
            throw new Error('PIN authentication expired');
          }

          const { isDeviceBound } = await import('@/utils/deviceBinding');
          const bound = isDeviceBound();

          const { data: response, error } = await supabase.functions.invoke('pin-reservations-fetch', {
            body: { pin: rawPin, companyId: validCompanyId, isDeviceBound: bound }
          });

          if (error) throw error;
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch reservations via PIN');
          }

          return (response.data || []).map((reservation: any) => ({
            id: reservation.id,
            customer_name: reservation.customer_name,
            phone: reservation.phone || '',
            email: reservation.email || '',
            party_size: reservation.party_size,
            date: reservation.date,
            time: reservation.time || '19:00',
            end_time: reservation.end_time || null,
            table_number: reservation.table_number || null,
            table_numbers: reservation.table_numbers || null,
            notes: reservation.notes || '',
            status: (reservation.status as any) || 'pending',
            locked: Boolean(reservation.locked) || false,
            has_allergens: Boolean(reservation.has_allergens) || false,
            allergens: reservation.allergens || [],
          }));
        }

        // Standard Supabase query
        const { data, error } = await supabase
          .from('reservations')
          .select(`
            id,
            customer_name,
            phone,
            email,
            party_size,
            date,
            time,
            end_time,
            table_number,
            table_numbers,
            notes,
            status,
            locked,
            has_allergens,
            allergens
          `)
          .eq('company_id', validCompanyId)
          .order('date', { ascending: true });

        if (error) throw error;

        return (data || []).map((reservation: any) => ({
          id: reservation.id,
          customer_name: reservation.customer_name,
          phone: reservation.phone || '',
          email: reservation.email || '',
          party_size: reservation.party_size,
          date: reservation.date,
          time: reservation.time || '19:00',
          end_time: reservation.end_time || null,
          table_number: reservation.table_number || null,
          table_numbers: reservation.table_numbers || null,
          notes: reservation.notes || '',
          status: (reservation.status as any) || 'pending',
          locked: Boolean(reservation.locked) || false,
          has_allergens: Boolean(reservation.has_allergens) || false,
          allergens: reservation.allergens || [],
        }));
      } catch (error: any) {
        console.error('📅 Query error:', error);
        throw error;
      }
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes for reservations - balance freshness with speed
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!companyId || authLoading) return;

    console.log('📅 Setting up real-time reservation subscription');

    const channel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('📅 Real-time reservation update:', payload);
          
          // Smart cache update instead of full invalidation
          const currentData = queryClient.getQueryData<Reservation[]>(['reservations', companyId]) || [];
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newReservation = transformRows([payload.new])[0];
            queryClient.setQueryData(['reservations', companyId], [...currentData, newReservation]);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedReservation = transformRows([payload.new])[0];
            const updatedData = currentData.map(r => 
              r.id === updatedReservation.id ? updatedReservation : r
            );
            queryClient.setQueryData(['reservations', companyId], updatedData);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const filteredData = currentData.filter(r => r.id !== payload.old.id);
            queryClient.setQueryData(['reservations', companyId], filteredData);
          } else {
            // Fallback to invalidation for complex changes
            queryClient.invalidateQueries({ queryKey: ['reservations', companyId] });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('📅 Cleaning up reservation subscription');
      supabase.removeChannel(channel);
    };
  }, [companyId, authLoading, queryClient]);

  return {
    reservations: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
};