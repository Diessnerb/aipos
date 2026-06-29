
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Reservation } from '@/types/reservation';
import { ReservationAssignmentService } from '@/services/reservationAssignmentService';
import { ReservationConflictService } from '@/services/reservationConflictService';
import { TableAssignmentOrchestrator } from '@/services/tableAssignmentOrchestrator';
import { getRawPin } from '@/utils/pinAuth';
import { validateAuthContext, logDataAccess } from '@/utils/dataGuards';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { getBoundCompany } from '@/utils/deviceBinding';
import { normalizeUKPhone } from '@/utils/phoneUtils';
import type { Table } from '@/types/table';

export const useReservations = (autoAssignEnabled?: boolean) => {
  const { toast } = useToast();
  const { user, companyId, loading: authLoading, pinUser } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdateTimestamp] = useState<number>(0); // Static value to prevent refresh loops
  const deviceLive = useDeviceLiveLayer();

  const fetchReservations = useCallback(async (options?: { silent?: boolean }) => {
    // Don't fetch if still loading auth
    if (authLoading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📅 Skipping reservations fetch - still loading auth');
      }
      if (!options?.silent) {
        setLoading(false);
      }
      return;
    }

    try {
      // Get bound company as fallback
      const boundCompany = getBoundCompany();
      
      // Priority: pinUser > boundCompany > user companyId
      const effectiveCompanyId = pinUser?.company_id || boundCompany?.company_id || companyId;
      
      if (!effectiveCompanyId) {
        console.warn('⚠️ useReservations: No company context available');
        setFetchError('No company context available');
        setReservations([]);
        setLoading(false);
        return;
      }
      
      // Validate authentication context
      const { validCompanyId, isPinMode } = validateAuthContext(user, pinUser, effectiveCompanyId, 'useReservations.fetchReservations');
      
      if (!options?.silent) {
        setLoading(true);
      }
      setFetchError(null);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📅 Starting fetchReservations with companyId:', validCompanyId, 'pinMode:', isPinMode);
      }

      // Use PIN-based edge function if in PIN mode, otherwise use direct Supabase
      if (isPinMode) {
        const rawPin = getRawPin();
        if (!rawPin) {
          throw new Error('PIN authentication expired. Please log in again.');
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

        logDataAccess('FETCH', 'reservations', validCompanyId, { data: response.data, error: null });

        if (process.env.NODE_ENV === 'development') {
          console.log('📅 PIN-based reservations fetch result:', { 
            dataLength: response.data?.length, 
            user: response.user,
            firstReservation: response.data?.[0]
          });
        }

        const data = response.data || [];
        
        const formattedReservations = data.map((reservation: any) => ({
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
          locked_until: reservation.locked_until || null,
          has_allergens: Boolean(reservation.has_allergens) || false,
          allergens: reservation.allergens || [],
        }));

        setReservations(formattedReservations);
        return;
      }

      // Standard Supabase query for authenticated users
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
          locked_until,
          has_allergens,
          allergens
        `)
        .eq('company_id', validCompanyId)
        .order('date', { ascending: true });

      logDataAccess('FETCH', 'reservations', validCompanyId, { data, error });

      if (process.env.NODE_ENV === 'development') {
        console.log('📅 Reservations query result:', { 
          dataLength: data?.length, 
          firstReservation: data?.[0], 
          error: error 
        });
      }

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('=== DEBUG: Supabase error details ===', error);
        }
        setFetchError(`${error.message} (${error.code || 'no code'})`);
        setReservations([]);
        return;
      }

      if (!data) {
        if (process.env.NODE_ENV === 'development') {
          console.log('=== DEBUG: No data returned from Supabase ===');
        }
        setReservations([]);
        setFetchError('No data returned from database');
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`=== DEBUG: Processing ${data.length} reservations ===`);
        }
        
        const formattedReservations = data.map((reservation: any) => ({
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
          locked_until: reservation.locked_until || null,
          has_allergens: Boolean(reservation.has_allergens) || false,
          allergens: reservation.allergens || [],
        }));

        if (process.env.NODE_ENV === 'development') {
          console.log('=== DEBUG: Formatted reservations ===', formattedReservations);
        }
        setReservations(formattedReservations);
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('=== DEBUG: Catch block error ===', error);
      }
      setFetchError(`Data access error: ${error.message}`);
      toast({ 
        title: "Data Access Issue", 
        description: error.message || "Could not load reservations. Please try re-authenticating.",
        variant: "destructive" 
      });
      
      // If it's an authentication error, clear potentially corrupted data
      if (error.message?.includes('authentication') || error.message?.includes('PIN')) {
        setReservations([]);
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [toast]);

  // Override loading state when device live is active
  const effectiveLoading = deviceLive ? false : loading;

  // Enhanced auto-assignment with retry mechanism
  const autoAssignSingleReservation = async (reservation: Reservation, retryCount = 0) => {
    if (!autoAssignEnabled || !companyId) return;
    
    try {
      // Check if this reservation needs a table
      const needsTable = !reservation.table_number && 
        (!reservation.table_numbers || reservation.table_numbers.length === 0) &&
        reservation.status !== 'cancelled' &&
        reservation.status !== 'no-show' &&
        reservation.status !== 'completed';

      if (!needsTable) return;

      // Use unified reservation assignment service with optimization
      const result = await ReservationAssignmentService.assignOptimalTables(
        companyId,
        reservation.date,
        reservation.time,
        reservation.party_size,
        reservation.notes,
        reservation.id
      );
      
      if (result.success && (result.assignedTable || result.assignedTables)) {
        // Handle both single and multi-table assignments
        const updateData: any = {};
        
        if (result.assignedTables && result.assignedTables.length > 1) {
          // Multi-table assignment
          updateData.table_numbers = result.assignedTables;
          updateData.table_number = null;
        } else if (result.assignedTables && result.assignedTables.length === 1) {
          // Single table assignment
              updateData.table_number = result.assignedTables[0];
          updateData.table_numbers = null;
        } else if (result.assignedTables && result.assignedTables.length === 1) {
          // Single table from array
          updateData.table_number = result.assignedTables[0];
          updateData.table_numbers = null;
        }
        
        // Update the reservation with the assigned table(s)
        const { error } = await supabase
          .from('reservations')
          .update(updateData)
          .eq('id', reservation.id);

        if (!error) {
          const assignmentDetails = result.assignedTables && result.assignedTables.length > 1 
            ? `tables ${result.assignedTables.join(', ')} (${result.tableSeats} total seats)`
            : `table ${result.assignedTable || result.assignedTables?.[0]} (${result.tableSeats} seats)`;
            
          toast({
            title: "Table Auto-Assigned",
            description: `${reservation.customer_name} assigned to ${assignmentDetails}${result.accessibilityFriendly ? ' - Accessible' : ''}`,
          });
          console.log(`Smart auto-assigned reservation ${reservation.id}: ${result.message}`);
        } else {
          throw error;
        }
      } else {
        // Handle failed assignment with suggestions
        if (result.alternativeTimes && result.alternativeTimes.length > 0 && retryCount === 0) {
          console.log(`Assignment failed for ${reservation.id}, suggesting alternatives:`, result.alternativeTimes);
          toast({
            title: "Assignment Suggestions Available",
            description: `${reservation.customer_name}: ${result.message}. Alternative times: ${result.alternativeTimes.join(', ')}`,
            variant: "destructive",
          });
        } else if (retryCount === 0) {
          toast({
            title: "Manual Assignment Required", 
            description: `${reservation.customer_name}: ${result.message || 'No tables available at requested time'}`,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error('Error in smart reservation auto-assignment:', error);
      
      // Retry mechanism for transient errors
      if (retryCount < 2 && error.message?.includes('lock')) {
        console.log(`Retrying assignment for reservation ${reservation.id}, attempt ${retryCount + 1}`);
        setTimeout(() => autoAssignSingleReservation(reservation, retryCount + 1), 1000);
      }
    }
  };

  const handleSaveReservation = async (reservation: Reservation): Promise<boolean> => {
    try {
      // Validate authentication context
      const { validCompanyId, isPinMode } = validateAuthContext(user, pinUser, companyId, 'useReservations.handleSaveReservation');
      
      const isNewReservation = !reservation.id || !reservations.find(r => r.id === reservation.id);
      
      // Use PIN-based edge function if in PIN mode
      if (isPinMode) {
        const rawPin = getRawPin();
        if (!rawPin) {
          throw new Error('PIN authentication expired. Please log in again.');
        }

        const { data: response, error } = await supabase.functions.invoke('pin-reservation-save', {
          body: { 
            pin: rawPin, 
            companyId: validCompanyId, 
            reservation,
            isUpdate: !isNewReservation
          }
        });

        if (error) {
          console.error('PIN reservation save error:', error);
          
          // Handle 401 errors specifically for PIN functions
          if (error.message?.includes('401') || error.message?.includes('Invalid PIN')) {
            toast({
              title: "PIN Authentication Failed",
              description: "PIN invalid or expired. Please re-enter your PIN or exit PIN mode.",
              variant: "destructive"
            });
            return false;
          }
          
          // Handle function errors with HTTP status
          if (error.context?.json?.error) {
            toast({
              title: "Failed to Save Reservation",
              description: error.context.json.error,
              variant: "destructive"
            });
            return false;
          }
          
          throw error;
        }
        
        if (!response?.success) {
          const errorMessage = response?.error || 'Failed to save reservation via PIN';
          toast({
            title: "Failed to Save Reservation",
            description: errorMessage,
            variant: "destructive"
          });
          return false;
        }

        toast({ title: isNewReservation ? "Reservation added successfully" : "Reservation updated successfully" });
        fetchReservations();
        return true;
      }
      
      // Validate for conflicts before saving (for both new and existing reservations)
      try {
        await ReservationConflictService.validateBeforeSave(
          reservation,
          validCompanyId,
          reservation.id // Exclude current reservation from conflict check for updates
        );
      } catch (conflictError: any) {
        toast({
          title: isNewReservation ? "Can't Create Reservation - Overlaps Existing Booking" : "Can't Edit Reservation - Overlaps Existing Booking",
          description: conflictError.message || "Table is already booked for this time slot",
          variant: "destructive",
        });
        return;
      }
      
      // Customer sync is now handled automatically by the database trigger (handle_new_customer)
      // No need to manually sync customers here - the trigger will handle it on reservation insert/update

      if (reservation.id && reservations.find(r => r.id === reservation.id)) {
        // Determine table configuration and explicitly null out the unused field
        const updateData = {
          customer_name: reservation.customer_name,
          phone: reservation.phone ? normalizeUKPhone(reservation.phone) : null,
          email: reservation.email,
          party_size: reservation.party_size,
          date: reservation.date,
          time: reservation.time,
          notes: reservation.notes,
          status: reservation.status,
          locked: reservation.locked,
          locked_until: reservation.locked_until,
          has_allergens: reservation.has_allergens || false,
          allergens: reservation.allergens || [],
          // Clear both fields and set the appropriate one
          table_number: null as number | null,
          table_numbers: null as number[] | null,
        };

        // Set the appropriate table field based on configuration
        if (reservation.table_numbers && reservation.table_numbers.length > 1) {
          updateData.table_numbers = reservation.table_numbers;
        } else if (reservation.table_numbers && reservation.table_numbers.length === 1) {
          updateData.table_number = reservation.table_numbers[0];
        } else if (reservation.table_number) {
          updateData.table_number = reservation.table_number;
        }

        console.log('=== UPDATING RESERVATION WITH EXPLICIT TABLE CLEARING ===', {
          reservationId: reservation.id,
          updateData,
          originalReservation: {
            table_number: reservation.table_number,
            table_numbers: reservation.table_numbers
          }
        });

        const { error } = await supabase
          .from('reservations')
          .update(updateData)
          .eq('id', reservation.id);

        if (error) throw error;
        toast({ title: "Reservation updated successfully" });
      } else {
        // For new reservations, also use the same logic
        const insertData = {
          customer_name: reservation.customer_name,
          phone: reservation.phone ? normalizeUKPhone(reservation.phone) : null,
          email: reservation.email,
          party_size: reservation.party_size,
          date: reservation.date,
          time: reservation.time,
          notes: reservation.notes,
          status: reservation.status,
          locked: reservation.locked || false,
          locked_until: reservation.locked_until || null,
          table_number: null as number | null,
          table_numbers: null as number[] | null,
        };

        // Set the appropriate table field
        if (reservation.table_numbers && reservation.table_numbers.length > 1) {
          insertData.table_numbers = reservation.table_numbers;
        } else if (reservation.table_numbers && reservation.table_numbers.length === 1) {
          insertData.table_number = reservation.table_numbers[0];
        } else if (reservation.table_number) {
          insertData.table_number = reservation.table_number;
        }

        const { data: newReservationData, error } = await supabase
          .from('reservations')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        toast({ title: "Reservation added successfully" });
        
        // Auto-assign table for new reservations if enabled
        if (isNewReservation && autoAssignEnabled && newReservationData) {
          // Format the database result to match Reservation type
          const formattedNewReservation: Reservation = {
            id: newReservationData.id,
            customer_name: newReservationData.customer_name,
            phone: newReservationData.phone || '',
            email: newReservationData.email || '',
            party_size: newReservationData.party_size,
            date: newReservationData.date,
            time: newReservationData.time || '19:00',
            end_time: newReservationData.end_time || undefined,
            table_number: newReservationData.table_number || undefined,
            table_numbers: newReservationData.table_numbers || undefined,
            notes: newReservationData.notes || '',
            status: (newReservationData.status as Reservation['status']) || 'pending',
            locked: Boolean(newReservationData.locked) || false,
            has_allergens: Boolean(newReservationData.has_allergens) || false,
            allergens: newReservationData.allergens || [],
          };
          setTimeout(() => autoAssignSingleReservation(formattedNewReservation), 500);
        }
      }
      
      fetchReservations();
      return true;
    } catch (error: any) {
      console.error('Error saving reservation:', error);
      toast({ 
        title: "Data Access Error", 
        description: error.message || "Failed to save reservation. Please try re-authenticating.",
        variant: "destructive" 
      });
      return false;
    }
  };

  const handleDeleteReservation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "Reservation deleted" });
      fetchReservations();
    } catch (error: any) {
      console.error('Error deleting reservation:', error);
      toast({ title: "Error deleting reservation", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: Reservation['status']) => {
    try {
      const updateData: Partial<Reservation> = { status };
      
      // Clear table assignments for cancelled/no-show reservations
      if (status === 'cancelled' || status === 'no-show') {
        updateData.table_number = null;
        updateData.table_numbers = null;
      }
      
      // Set end_time for completed reservations (keeps table assignment)
      if (status === 'completed') {
        const { roundToLast15Minutes } = await import('@/utils/timeUtils');
        updateData.end_time = roundToLast15Minutes();
      }

      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update customer counters for no-shows
      if (status === 'no-show') {
        const reservation = reservations.find(r => r.id === id);
        if (reservation?.phone) {
          const { normalizeUKPhone } = await import('@/utils/phoneUtils');
          const normalizedPhone = normalizeUKPhone(reservation.phone);
          
          if (normalizedPhone) {
            const { data: customer } = await supabase
              .from('customers')
              .select('id, no_show_count')
              .eq('company_id', companyId)
              .eq('phone', normalizedPhone)
              .maybeSingle();
            
            if (customer) {
              const newCount = (customer.no_show_count || 0) + 1;
              await supabase
                .from('customers')
                .update({ no_show_count: newCount })
                .eq('id', customer.id);
              
              console.log(`✅ Updated customer no-show count: ${newCount}`);
            }
          }
        }
      }
      
      toast({ 
        title: status === 'completed' 
          ? "Reservation completed" 
          : status === 'cancelled' || status === 'no-show'
          ? `Reservation ${status} - table cleared`
          : `Reservation marked as ${status}` 
      });
      
      // Trigger auto-assignment for status changes that might enable assignment
      if (autoAssignEnabled && (status === 'confirmed' || status === 'pending')) {
        const reservation = reservations.find(r => r.id === id);
        if (reservation) {
          setTimeout(() => autoAssignSingleReservation(reservation), 500);
        }
      }
      
      fetchReservations();
    } catch (error: any) {
      console.error('Error updating reservation status:', error);
      toast({ title: "Error updating reservation", variant: "destructive" });
    }
  };

  const handleManualAssign = async (reservation: Reservation, tableNumber: number) => {
    try {
      // Prevent moving seated or in-progress reservations
      const inProgressStatuses = ['seated', 'waiting-for-order', 'waiting-for-starters', 'starters-ready-in-kitchen', 
        'starters-served', 'requires-check-back-on-starters', 'eating-starters', 'clear-starters', 
        'waiting-for-mains', 'mains-ready-in-kitchen', 'mains-served', 'requires-check-back-on-mains', 
        'eating-mains', 'clear-mains', 'waiting-for-desserts', 'desserts-ready-in-kitchen', 
        'desserts-served', 'requires-check-back-on-desserts', 'eating-dessert', 'clear-desserts', 
        'table-cleared', 'bill-requested-waiting-to-pay', 'table-complete'];
      
      if (inProgressStatuses.includes(reservation.status)) {
        toast({
          title: "Cannot Move Reservation",
          description: "This reservation cannot be moved as service has already started",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('reservations')
        .update({ 
          table_number: tableNumber,
          table_numbers: null 
        })
        .eq('id', reservation.id);

      if (error) throw error;
      
      toast({ 
        title: "Table Assigned",
        description: `${reservation.customer_name} assigned to table ${tableNumber}`
      });
      fetchReservations();
    } catch (error: any) {
      console.error('Error manually assigning table:', error);
      toast({ 
        title: "Assignment Failed", 
        description: "Could not assign table. Please try again.",
        variant: "destructive" 
      });
    }
  };

  const autoAssignTables = async (autoAssignEnabled: boolean) => {
    if (!autoAssignEnabled || !companyId) return;
    
    try {
      // Find unassigned reservations that need tables (exclude cancelled, no-show, completed)
      const unassignedReservations = reservations.filter(reservation => 
        !reservation.table_number && 
        (!reservation.table_numbers || reservation.table_numbers.length === 0) &&
        reservation.status !== 'cancelled' &&
        reservation.status !== 'no-show' &&
        reservation.status !== 'completed'
      );

      if (unassignedReservations.length === 0) {
        toast({
          title: "All Tables Assigned",
          description: "No unassigned reservations found.",
        });
        return;
      }

      let assignmentCount = 0;
      let failedCount = 0;
      const suggestions: string[] = [];
      
      // Process assignments in batches to avoid overwhelming the system
      for (let i = 0; i < unassignedReservations.length; i++) {
        const reservation = unassignedReservations[i];
        
        try {
          const result = await TableAssignmentOrchestrator.autoAssignTables(
            companyId,
            reservation.party_size,
            reservation.date,
            reservation.time,
            {
              id: reservation.id,
              customer_name: reservation.customer_name,
              party_size: reservation.party_size,
              date: reservation.date,
              time: reservation.time,
              notes: reservation.notes
            } as any
          );
          
          if (result.success && result.tables) {
            // Handle both single and multi-table assignments
            const updateData: any = {};
            
            if (result.tables.length > 1) {
              // Multi-table assignment
              updateData.table_numbers = result.tables;
              updateData.table_number = null;
            } else if (result.tables.length === 1) {
              // Single table assignment
              updateData.table_number = result.tables[0];
              updateData.table_numbers = null;
            }

            // Update the reservation with the assigned table(s)
            const { error } = await supabase
              .from('reservations')
              .update(updateData)
              .eq('id', reservation.id);

            if (!error) {
              assignmentCount++;
              const assignmentDetails = result.tables.length > 1 
                ? `tables ${result.tables.join(', ')}`
                : `table ${result.tables[0]}`;
              console.log(`Bulk auto-assigned reservation ${reservation.id} to ${assignmentDetails} using ${result.strategy} strategy`);
            }
          } else {
            failedCount++;
            console.log(`Failed to assign reservation ${reservation.id}: ${result.reason}`);
          }
          
          // Small delay between assignments to prevent overwhelming
          if (i < unassignedReservations.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Failed to assign table for reservation ${reservation.id}:`, error);
          failedCount++;
        }
      }

      // Show comprehensive results
      if (assignmentCount > 0) {
        toast({
          title: "Bulk Assignment Complete",
          description: `Successfully assigned ${assignmentCount} of ${unassignedReservations.length} reservations${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`,
        });
        fetchReservations(); // Refresh to show updates
      }
      
      if (suggestions.length > 0 && suggestions.length <= 3) {
        toast({
          title: "Alternative Time Suggestions",
          description: suggestions.slice(0, 3).join('; '),
          variant: "destructive",
        });
      } else if (failedCount > 0) {
        toast({
          title: "Some Assignments Failed",
          description: `${failedCount} reservations could not be auto-assigned. Manual assignment may be required.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in bulk auto table assignment:', error);
      toast({
        title: "Bulk Assignment Error",
        description: "Failed to complete bulk assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Periodic assignment check (every 5 minutes)
  const periodicAssignmentCheck = useCallback(async () => {
    if (!autoAssignEnabled || !companyId) return;
    
    const unassignedCount = reservations.filter(r => 
      !r.table_number && 
      (!r.table_numbers || r.table_numbers.length === 0) &&
      r.status !== 'cancelled' && 
      r.status !== 'no-show' && 
      r.status !== 'completed'
    ).length;
    
    if (unassignedCount > 0) {
      console.log(`Periodic check: ${unassignedCount} unassigned reservations found, attempting auto-assignment`);
      await autoAssignTables(true);
    }
  }, [autoAssignEnabled, companyId, reservations, autoAssignTables]);

  useEffect(() => {
    // Only fetch when auth is ready and we have a company ID
    if (!authLoading && companyId) {
      fetchReservations();
    }
    
    // Set up real-time subscription for reservations only if we have companyId
    if (!companyId) return;

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
          if (process.env.NODE_ENV === 'development') {
            console.log('=== REAL-TIME RESERVATION UPDATE ===', payload);
          }
          
          // Handle INSERT events (new reservations from external sources)
          if (payload.eventType === 'INSERT' && autoAssignEnabled) {
            const newReservation = payload.new as any;
            
            // Only process if it's for our company (additional safety check)
            if (newReservation.company_id === companyId) {
              // Check if the reservation needs auto-assignment
              const needsTable = !newReservation.table_number && 
                (!newReservation.table_numbers || newReservation.table_numbers.length === 0) &&
                newReservation.status !== 'cancelled' &&
                newReservation.status !== 'no-show' &&
                newReservation.status !== 'completed';
              
              if (needsTable) {
                if (process.env.NODE_ENV === 'development') {
                  console.log('=== TRIGGERING AUTO-ASSIGNMENT FOR EXTERNAL RESERVATION ===', newReservation.id);
                }
                
                // Convert the database result to a proper Reservation type
                const formattedReservation: Reservation = {
                  id: newReservation.id,
                  customer_name: newReservation.customer_name,
                  phone: newReservation.phone || '',
                  email: newReservation.email || '',
                  party_size: newReservation.party_size,
                  date: newReservation.date,
                  time: newReservation.time || '19:00',
                  end_time: newReservation.end_time || undefined,
                  table_number: newReservation.table_number || undefined,
                  table_numbers: newReservation.table_numbers || undefined,
                  notes: newReservation.notes || '',
                  status: (newReservation.status as Reservation['status']) || 'pending',
                  locked: Boolean(newReservation.locked) || false,
                  has_allergens: Boolean(newReservation.has_allergens) || false,
                  allergens: newReservation.allergens || [],
                };
                
                // Try auto-assignment after a small delay to ensure data consistency
                setTimeout(() => autoAssignSingleReservation(formattedReservation), 1000);
              }
            }
          }

          // Handle UPDATE events for status changes that might enable assignment
          if (payload.eventType === 'UPDATE' && autoAssignEnabled) {
            const updatedReservation = payload.new as any;
            
            if (updatedReservation.company_id === companyId) {
              const needsTable = !updatedReservation.table_number && 
                (!updatedReservation.table_numbers || updatedReservation.table_numbers.length === 0) &&
                (updatedReservation.status === 'confirmed' || updatedReservation.status === 'pending');
              
              if (needsTable) {
                const formattedReservation: Reservation = {
                  id: updatedReservation.id,
                  customer_name: updatedReservation.customer_name,
                  phone: updatedReservation.phone || '',
                  email: updatedReservation.email || '',
                  party_size: updatedReservation.party_size,
                  date: updatedReservation.date,
                  time: updatedReservation.time || '19:00',
                  end_time: updatedReservation.end_time || undefined,
                  table_number: updatedReservation.table_number || undefined,
                  table_numbers: updatedReservation.table_numbers || undefined,
                  notes: updatedReservation.notes || '',
                  status: (updatedReservation.status as Reservation['status']) || 'pending',
                  locked: Boolean(updatedReservation.locked) || false,
                  has_allergens: Boolean(updatedReservation.has_allergens) || false,
                  allergens: updatedReservation.allergens || [],
                };
                
                setTimeout(() => autoAssignSingleReservation(formattedReservation), 1000);
              }
            }
          }
          
          // Update local state incrementally instead of full refresh
          if (payload.eventType === 'INSERT' && payload.new) {
            const newReservation = payload.new as any;
            setReservations(prevReservations => {
              const existingIndex = prevReservations.findIndex(r => r.id === newReservation.id);
              if (existingIndex === -1) {
                const formattedReservation: Reservation = {
                  id: newReservation.id,
                  customer_name: newReservation.customer_name,
                  phone: newReservation.phone || '',
                  email: newReservation.email || '',
                  party_size: newReservation.party_size,
                  date: newReservation.date,
                  time: newReservation.time || '19:00',
                  end_time: newReservation.end_time || undefined,
                  table_number: newReservation.table_number || undefined,
                  table_numbers: newReservation.table_numbers || undefined,
                  notes: newReservation.notes || '',
                  status: (newReservation.status as Reservation['status']) || 'pending',
                  locked: Boolean(newReservation.locked) || false,
                  has_allergens: Boolean(newReservation.has_allergens) || false,
                  allergens: newReservation.allergens || [],
                };
                return [...prevReservations, formattedReservation];
              }
              return prevReservations;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedReservation = payload.new as any;
            setReservations(prevReservations => 
              prevReservations.map(reservation => {
                if (reservation.id === updatedReservation.id) {
                  return {
                    id: updatedReservation.id,
                    customer_name: updatedReservation.customer_name,
                    phone: updatedReservation.phone || '',
                    email: updatedReservation.email || '',
                    party_size: updatedReservation.party_size,
                    date: updatedReservation.date,
                    time: updatedReservation.time || '19:00',
                    end_time: updatedReservation.end_time || undefined,
                    table_number: updatedReservation.table_number || undefined,
                    table_numbers: updatedReservation.table_numbers || undefined,
                    notes: updatedReservation.notes || '',
                    status: (updatedReservation.status as Reservation['status']) || 'pending',
                    locked: Boolean(updatedReservation.locked) || false,
                    has_allergens: Boolean(updatedReservation.has_allergens) || false,
                    allergens: updatedReservation.allergens || [],
                  };
                }
                return reservation;
              })
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setReservations(prevReservations => 
              prevReservations.filter(reservation => reservation.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      console.log('=== CLEANING UP RESERVATIONS SUBSCRIPTION ===');
      supabase.removeChannel(channel);
    };
  }, [autoAssignEnabled, authLoading, companyId]);

  // Periodic assignment check interval (every 5 minutes)
  useEffect(() => {
    if (!autoAssignEnabled || !companyId) return;
    
    const interval = setInterval(() => {
      periodicAssignmentCheck();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [autoAssignEnabled, companyId, periodicAssignmentCheck]);

  return {
    reservations,
    loading: effectiveLoading,
    fetchError,
    fetchReservations,
    handleSaveReservation,
    handleDeleteReservation,
    handleStatusChange,
    handleManualAssign,
    autoAssignTables,
    periodicAssignmentCheck,
    lastUpdateTimestamp,
  };
};
