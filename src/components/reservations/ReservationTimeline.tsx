import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { useTablesQuery, type TableChangeEvent } from '@/hooks/useTablesQuery';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineGrid } from './timeline/TimelineGrid';
import { TimelineLoadingState } from './timeline/TimelineLoadingState';
import { TimelineEmptyState } from './timeline/TimelineEmptyState';
import { ResponsiveTimelineContainer } from './timeline/ResponsiveTimelineContainer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TableServiceSchedule } from '@/types/table';
import { NewReservationModal } from './NewReservationModal';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';
import { getDayOfWeekFromDate } from '@/utils/foodServiceValidation';
import { DEFAULT_OPERATING_HOURS, type DayOfWeek } from '@/types/openingHours';



import { useOptimizedTimelineLayout } from './timeline/hooks/useOptimizedTimelineLayout';
import { useTouchDragDrop } from './timeline/hooks/useTouchDragDrop';
import { useEnhancedMouseDragDrop } from './timeline/hooks/useEnhancedMouseDragDrop';
import { generateTimeSlots } from './timeline/utils/timelineUtils';
import { useAINotifications } from '@/hooks/useAINotifications';
import { TableMoveFeedbackModal } from './TableMoveFeedbackModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRealtimeOptimization } from '@/hooks/useRealtimeOptimization';
import { useTableGroups } from '@/hooks/useTableGroups';
import { useStatusConfig } from '@/contexts/StatusConfigContext';
import { useAuth } from '@/components/AuthProvider';
import { normalizeReservationTableNumbers } from '@/utils/normalizeReservationRow';
import { TimeChangeConfirmationDialog } from './timeline/TimeChangeConfirmationDialog';

// Debug flag for console logging (Phase 4)
const DEBUG = typeof window !== 'undefined' && (window as any).__DEBUG_TIMELINE_CLICKS__;

interface ReservationTimelineProps {
  reservations: Reservation[];
  onReservationUpdate: () => void;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  openingHour?: number;
  closingHour?: number;
  onEditReservation?: (reservation: Reservation) => void;
  dateRange?: { from?: Date; to?: Date };
  onDateRangeChange?: (range: { from?: Date; to?: Date }) => void;
  isRecentModalEdit?: (reservationId: string) => boolean;
}

// Memoized component to prevent unnecessary re-renders
const ReservationTimelineComponent: React.FC<ReservationTimelineProps> = ({

  reservations = [],
  onReservationUpdate,
  selectedDate,
  onSelectedDateChange,
  openingHour = 9,
  closingHour = 23,
  onEditReservation,
  dateRange,
  onDateRangeChange,
  isRecentModalEdit,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { checkPermission } = usePermissionCheck();
  const { tables, loading: loadingTables } = useTablesQuery({ 
    onTableChange: async (event) => {
      if (event?.type === 'table_unavailable' && event.tableNumber) {
        console.log(`🚨 Table ${event.tableNumber} unavailable - will reassign affected reservations`);
        await handleTableUnavailable(event.tableNumber, event.serviceStatus!, event.scheduledEnd);
      } else {
        triggerOptimization();
      }
    }
  });
  const { tableGroups, fetchTableGroups } = useTableGroups();
  const deviceLive = useDeviceLiveLayer();
  
  // Filter out temporarily_removed tables, but keep out_of_service tables visible
  const safeTables = Array.isArray(tables) 
    ? tables.filter(t => t.service_status !== 'temporarily_removed')
    : [];
  
  // State for table service schedules (date-range coloring)
  const [tableSchedules, setTableSchedules] = useState<Map<string, TableServiceSchedule>>(new Map());
  const { startTimer, endTimer, logInstantMetric } = usePerformanceMonitor('ReservationTimeline');
  const [londonTime, setLondonTime] = useState(new Date());
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);
  const [newReservationDefaults, setNewReservationDefaults] = useState<{
    tableNumber: number;
    startTime: string;
    date: string;
  } | undefined>(undefined);
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    reservationId: string;
    oldTableNumbers: number[] | null;
    newTableNumbers: number[];
  }>({
    isOpen: false,
    reservationId: '',
    oldTableNumbers: null,
    newTableNumbers: []
  });
  const { currentUser } = useCurrentUser();
  const { companyId } = useAuth(); // Use auth companyId for cache keys
  const { location } = useCompanyLocation();
  const { statusConfig } = useStatusConfig();
  
  // Initialize AI notifications
  useAINotifications();

  // Update London time every 5 seconds for live current-time indicator
  useEffect(() => {
    const updateLondonTime = () => {
      const now = new Date();
      setLondonTime(now);
    };
    
    // Update immediately on mount
    updateLondonTime();
    
    // Then update every 5 seconds
    const interval = setInterval(updateLondonTime, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Ensure table groups are loaded for drag-and-drop group capacity logic
  useEffect(() => {
    fetchTableGroups?.({ silent: true });
  }, [fetchTableGroups]);

  // Helper: force reload selected date cache via direct fetch (bypass ultra-fast cache)
  const forceDateReload = useCallback(async () => {
    if (!companyId || !selectedDate) return;
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, customer_name, phone, email, party_size, date, time, end_time,
          table_number, table_numbers, notes, status, locked, locked_until, has_allergens, allergens
        `)
        .eq('company_id', companyId)
        .eq('date', selectedDate)
        .order('time', { ascending: true });
      if (error) throw error;

      const transform = (rows: any[] = []) => rows.map((r: any) => ({
        id: r.id,
        customer_name: r.customer_name,
        phone: r.phone || '',
        email: r.email || '',
        party_size: r.party_size,
        date: r.date,
        time: r.time || '19:00',
        end_time: r.end_time || null,
        table_number: r.table_number || null,
        table_numbers: r.table_numbers || null,
        notes: r.notes || '',
        status: (r.status as any) || 'pending',
        locked: Boolean(r.locked) || false,
        locked_until: r.locked_until || null,
        has_allergens: Boolean(r.has_allergens) || false,
        allergens: r.allergens || [],
      }));

      const reservations = transform(data || []);
      const key = ['reservations-date', companyId, selectedDate] as const;
      queryClient.setQueryData(key, {
        date: selectedDate,
        reservations,
        lastUpdated: Date.now(),
        isToday: selectedDate === new Date().toISOString().split('T')[0],
      });

      const ava = reservations.find((r: any) => r.customer_name?.toLowerCase?.().includes('ava lee'));
      if (ava) {
        console.log('✅ Direct fetch shows Ava row after optimization:', {
          id: ava.id,
          customer_name: ava.customer_name,
          party_size: ava.party_size,
          table_number: ava.table_number,
          table_numbers: ava.table_numbers,
          time: ava.time
        });
        
        // Cross-check with table data
        const assignedTable = ava.table_numbers?.[0];
        if (assignedTable) {
          console.log(`📊 DIAGNOSTIC: Ava assigned to table ${assignedTable}, checking table capacity...`);
          // This will help us verify if the assignment makes sense
        }
      }
    } catch (err) {
      console.error('Force date reload error:', err);
    }
  }, [companyId, selectedDate, queryClient]);

  // Handle optimization completion
  const handleOptimizationComplete = useCallback((result: { success: boolean; movesCount: number }) => {
    console.log('✨ Optimization complete:', result);
    
    // Optimization happens silently in the background (no toast)
    
    // Always force refresh to ensure UI is in sync, regardless of movesCount
    console.log(`✨ Forcing date reload after optimization (moves: ${result.movesCount})`);
    setTimeout(() => {
      console.log(`🔄 Post-optimization: Running forceDateReload for ${selectedDate}`);
      forceDateReload();
    }, 1200); // Slightly shorter delay since we have backup reloads now
  }, [forceDateReload, toast, selectedDate]);

  // Initialize real-time continuous optimization
  const { isRealtimeActive, triggerOptimization } = useRealtimeOptimization({
    enabled: true,
    debounceMs: 2000, // 2 second debounce for batching rapid changes
    contextDate: selectedDate, // Pass selected date for targeted optimization
    onOptimizationComplete: handleOptimizationComplete
  });

  // Handle table unavailability (out_of_service or temporarily_removed)
  const handleTableUnavailable = useCallback(async (
    tableNumber: number,
    serviceStatus: 'out_of_service' | 'temporarily_removed',
    scheduledEnd?: string | null
  ) => {
    if (!companyId) return;

    try {
      // Determine date range for affected reservations
      const startDate = new Date().toISOString().split('T')[0];
      let endDate: string | undefined;

      if (serviceStatus === 'out_of_service' && scheduledEnd) {
        endDate = new Date(scheduledEnd).toISOString().split('T')[0];
        console.log(`🔍 Checking reservations on Table ${tableNumber} from ${startDate} to ${endDate} (out of service period)`);
      } else {
        console.log(`🔍 Checking reservations on Table ${tableNumber} from ${startDate} onwards`);
      }

      // Query reservations in the affected date range
      const query = supabase
        .from('reservations')
        .select('id, customer_name, date, time, party_size, table_numbers, table_number, status')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .in('status', ['confirmed', 'pending'])
        .or(`table_number.eq.${tableNumber},table_numbers.cs.{${tableNumber}}`);

      if (endDate) {
        query.lte('date', endDate);
      }

      const { data: affectedReservations, error } = await query;

      if (error) {
        console.error('Error finding affected reservations:', error);
        return;
      }

      if (!affectedReservations || affectedReservations.length === 0) {
        console.log(`✅ No reservations found on Table ${tableNumber}`);
        return;
      }

      console.log(`🎯 Found ${affectedReservations.length} reservation(s) on unavailable Table ${tableNumber}`);

      if (serviceStatus === 'temporarily_removed') {
        console.log('🔄 Table temporarily removed - unassigning reservations immediately');

        for (const reservation of affectedReservations) {
          await supabase
            .from('reservations')
            .update({
              table_numbers: null,
              table_number: null
            })
            .eq('id', reservation.id);

          console.log(`📍 Unassigned ${reservation.customer_name} from Table ${tableNumber}`);
        }

        toast({
          title: 'Reservations Unassigned',
          description: `${affectedReservations.length} reservation(s) removed from Table ${tableNumber}. Please reassign them manually.`,
        });

        queryClient.invalidateQueries({ queryKey: ['reservations'] });
        return;
      }

      console.log('🔧 Table out of service - triggering forced re-optimization');

      const reservationIds = affectedReservations.map(r => r.id);

      const response = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId,
          mode: 'immediate',
          forceMoveReservationIds: reservationIds,
          overrideImminentProtection: true,
          allowStartedMoves: true,
          automated: false
        }
      });

      if (response.data?.success && response.data?.movesCount > 0) {
        console.log(`✅ Successfully moved ${response.data.movesCount} reservation(s) from Table ${tableNumber}`);

        const endDateMsg = endDate ? ` until ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ' indefinitely';
        toast({
          title: 'Reservations Reassigned',
          description: `${response.data.movesCount} reservation(s) automatically moved from Table ${tableNumber} (out of service${endDateMsg})`,
        });

        queryClient.invalidateQueries({ queryKey: ['reservations'] });
      } else {
        console.warn('⚠️ Could not automatically reassign reservations:', response.data);

        toast({
          title: 'Manual Reassignment Needed',
          description: `Could not automatically reassign reservations from Table ${tableNumber}. Please reassign manually.`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Error handling table unavailable:', error);
      toast({
        title: 'Error',
        description: 'Failed to reassign reservations. Please check manually.',
        variant: 'destructive'
      });
    }
  }, [companyId, toast, queryClient]);

  // Real-time updates are handled by useUltraFastReservationsQuery hook
  // Removed duplicate subscription to improve performance

  // Fetch active schedules for all tables
  useEffect(() => {
    if (!companyId || safeTables.length === 0) return;
    
    const fetchSchedules = async () => {
      const { data, error } = await supabase
        .from('table_service_schedules')
        .select('*')
        .eq('company_id', companyId)
        .is('resolved_at', null)
        .in('table_id', safeTables.map(t => t.id));
      
      if (error) {
        console.error('Error fetching table schedules:', error);
        return;
      }
      
      const scheduleMap = new Map<string, TableServiceSchedule>();
      data?.forEach(schedule => {
        scheduleMap.set(schedule.table_id, schedule as TableServiceSchedule);
      });
      
      setTableSchedules(scheduleMap);
    };
    
    fetchSchedules();
  }, [companyId, safeTables.length]);

  // Real-time subscription for schedule changes
  useEffect(() => {
    if (!companyId) return;
    
    const channel = supabase
      .channel('timeline-schedules-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'table_service_schedules' },
        () => {
          console.log('=== SCHEDULE CHANGE DETECTED - REFETCHING ===');
          setTableSchedules(new Map());
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Real-time subscription for table group updates
  useEffect(() => {
    const channel = supabase
      .channel('table_groups_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'table_groups' },
        () => {
          console.log('=== TABLE GROUPS CHANGE DETECTED - REFRESHING ===');
          fetchTableGroups();
          forceDateReload();
          triggerOptimization();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'table_group_memberships' },
        () => {
          console.log('=== TABLE GROUP MEMBERSHIPS CHANGE DETECTED - REFRESHING ===');
          fetchTableGroups();
          forceDateReload();
          triggerOptimization();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTableGroups, forceDateReload, triggerOptimization]);

  // Calculate dynamic opening/closing hours based on selected date
  const { openingHour: dynamicOpeningHour, closingHour: dynamicClosingHour } = useMemo(() => {
    // Use configured operating hours or fallback to defaults
    const operatingHours = location?.hours?.operating || DEFAULT_OPERATING_HOURS;
    
    const dayOfWeek = getDayOfWeekFromDate(selectedDate);
    const dayHours = operatingHours[dayOfWeek];

    if (dayHours.closed) {
      // Return default if closed
      return { openingHour: 9, closingHour: 23 };
    }

    const [openHour] = dayHours.open.split(':').map(Number);
    let [closeHour] = dayHours.close.split(':').map(Number);

    // Handle past-midnight closing (e.g., "01:00" means 25:00 in 24+ hour format)
    if (closeHour < openHour) {
      closeHour += 24;
    }

    // Calculate food service end + 2 hour buffer
    let foodServiceBufferClose = closeHour;
    if (location?.hours?.foodService) {
      const foodServiceHours = location.hours.foodService[dayOfWeek as DayOfWeek];
      
      if (foodServiceHours && foodServiceHours.length > 0) {
        // Find the latest end time across all food service periods
        const latestEndMinutes = foodServiceHours.reduce((latest, period) => {
          const [endHours, endMinutes] = period.end.split(':').map(Number);
          const endTimeMinutes = endHours * 60 + endMinutes;
          return Math.max(latest, endTimeMinutes);
        }, 0);
        
        // Add 2 hour buffer (120 minutes) for dining duration
        const bufferedMinutes = latestEndMinutes + 120;
        const bufferedHour = Math.ceil(bufferedMinutes / 60);
        foodServiceBufferClose = bufferedHour;
      }
    }

    // Use the later of operating close or food service + buffer
    const finalClose = Math.max(closeHour, foodServiceBufferClose);

    return { openingHour: openHour, closingHour: finalClose };
  }, [selectedDate, location?.hours, openingHour, closingHour]);

  // Allow past-midnight slots (cap at 26 = 2am next day)
  const clampedClosingHour = Math.min(dynamicClosingHour, 26);

  // Time slots using dynamic hours with clamped closing
  const TIME_SLOTS = useMemo(() => 
    generateTimeSlots(dynamicOpeningHour, clampedClosingHour), 
    [dynamicOpeningHour, clampedClosingHour]
  );
  
  // Use pre-filtered reservations (already filtered by date in parent)
  const selectedDateReservations = useMemo(() => {
    // Reservations are already date-filtered and optimized - minimal processing needed
    startTimer('filterReservations');
    
    const filtered = reservations.filter(r => {
      if (!r?.date) return false;
      if (r.status === 'cancelled' || r.status === 'no-show') return false;
      return r.date === selectedDate;
    });
    
    const duration = endTimer('filterReservations', { 
      totalReservations: reservations.length, 
      filteredCount: filtered.length 
    });
    
    console.log(`📊 DIAGNOSTIC: Rendering ${filtered.length} reservations for ${selectedDate}`);
    
    // Log Ava Lee specifically to track UI state
    const ava = filtered.find((r: any) => r.customer_name?.toLowerCase?.().includes('ava lee'));
    if (ava) {
      console.log(`🎯 DIAGNOSTIC: Ava Lee in UI render state:`, {
        id: ava.id,
        customer_name: ava.customer_name,
        party_size: ava.party_size,
        table_number: ava.table_number,  
        table_numbers: ava.table_numbers,
        time: ava.time
      });
    }
    
    return filtered;
  }, [reservations, selectedDate, startTimer, endTimer]);

  // Memoized operational tables to prevent recalculation
  const operationalTables = useMemo(() => {
    startTimer('filterTables');
    
    const operational = safeTables.filter(table => 
      table.is_active && 
      (!table.service_status || table.service_status === 'available' || table.service_status === 'out_of_service')
    );
    
    endTimer('filterTables', { 
      totalTables: safeTables.length, 
      operationalCount: operational.length 
    });
    
    return operational;
  }, [safeTables, startTimer, endTimer]);
  
  // Use optimized layout hook with operational tables
  const { layout, isReady: isLayoutReady } = useOptimizedTimelineLayout(operationalTables, TIME_SLOTS);
  

  // Memoize available table numbers from operational tables
  const availableTableNumbers = useMemo(() => operationalTables.map(t => t.table_number), [operationalTables]);
  
  // Enhanced reservation update handler with smart cache updates
  const handleReservationUpdateWithFeedback = useCallback((
    reservationId?: string, 
    oldTableNumbers?: number[] | null, 
    newTableNumbers?: number[]
  ) => {
    // Check if this is a table move that should trigger feedback
    if (reservationId && oldTableNumbers && newTableNumbers && 
        JSON.stringify(oldTableNumbers.sort()) !== JSON.stringify(newTableNumbers.sort())) {
      
      setFeedbackModal({
        isOpen: true,
        reservationId,
        oldTableNumbers,
        newTableNumbers
      });
    }
    
    // Use smart cache updates instead of full refetch
    onReservationUpdate();
  }, [onReservationUpdate]);

  // Initialize drag handlers with memoized values - pass layout and table groups
  const touchDragHandlers = useTouchDragDrop(
    handleReservationUpdateWithFeedback,
    operationalTables,
    selectedDateReservations,
    layout,
    selectedDate, // CRITICAL: Pass selectedDate to enable optimistic updates
    triggerOptimization, // Pass optimization trigger
    tableGroups, // Pass table groups for group-aware logic
    statusConfig // Pass status config for consistent colors
  );
  

  const enhancedMouseDragHandlers = useEnhancedMouseDragDrop(
    handleReservationUpdateWithFeedback,
    operationalTables,
    selectedDateReservations,
    isLayoutReady && operationalTables.length > 0 ? layout : undefined,
    selectedDate, // CRITICAL: Pass selectedDate to enable optimistic updates
    triggerOptimization, // Pass optimization trigger
    tableGroups, // Pass table groups for group-aware logic
    statusConfig, // Pass status config for consistent colors
    isRecentModalEdit // Check if reservation was recently edited via modal
  );

  // Optimize London time updates - only when visible and needed
  useEffect(() => {
    const updateLondonTime = () => {
      const londonTimeString = new Date().toLocaleString("en-US", {
        timeZone: "Europe/London"
      });
      setLondonTime(new Date(londonTimeString));
    };

    updateLondonTime();
    // Update every 10 minutes instead of 5 to reduce re-renders
    const timer = setInterval(updateLondonTime, 600000);
    return () => clearInterval(timer);
  }, []);

  const handleReservationClick = useCallback(async (reservation: Reservation, e?: React.MouseEvent) => {
    const shouldPreventMouseClick = enhancedMouseDragHandlers.dragTracker.shouldPreventClick();
    const shouldPreventTouchClick = touchDragHandlers.shouldPreventTouchClick(); // Phase 3: Check touch click prevention
    const isTouchDraggingThis = touchDragHandlers.touchDragState.isDragging && 
                                touchDragHandlers.touchDragState?.draggedReservation?.id === reservation.id;
    
    if (DEBUG) {
      console.log('=== RESERVATION CLICK HANDLER ===', {
        reservationId: reservation.id,
        shouldPreventMouseClick,
        shouldPreventTouchClick,
        isTouchDraggingThis,
        willAllow: !(shouldPreventMouseClick || shouldPreventTouchClick || isTouchDraggingThis)
      });
    }
    
    if (shouldPreventMouseClick || shouldPreventTouchClick || isTouchDraggingThis) {
      enhancedMouseDragHandlers.dragTracker.resetClickPrevention();
      return;
    }
    
    if (onEditReservation) {
      onEditReservation(reservation);
    }
  }, [enhancedMouseDragHandlers.dragTracker, touchDragHandlers, onEditReservation]);

  const handleTimeSlotClick = useCallback((tableNumber: number, timeSlot: string) => {
    setNewReservationDefaults({
      tableNumber,
      startTime: timeSlot,
      date: selectedDate
    });
    setShowNewReservationModal(true);
  }, [selectedDate]);

  const handleNewReservationSave = useCallback(async (reservationData: {
    customer_name: string;
    party_size: number;
    phone: string;
    email: string;
    date: string;
    time: string;
    table_number?: number;
    table_numbers?: number[];
    status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
    notes?: string;
    has_allergens?: boolean;
    allergens?: string[];
  }) => {
    try {
      // Use the same logic as useReservations for table handling
      const insertData = {
        customer_name: reservationData.customer_name,
        phone: reservationData.phone,
        email: reservationData.email,
        party_size: reservationData.party_size,
        date: reservationData.date,
        time: reservationData.time,
        notes: reservationData.notes,
        status: reservationData.status,
        locked: false,
        has_allergens: reservationData.has_allergens || false,
        allergens: reservationData.allergens || [],
        table_number: null as number | null,
        table_numbers: null as number[] | null,
      };

      // Set the appropriate table field based on configuration
      if (reservationData.table_numbers && reservationData.table_numbers.length > 1) {
        insertData.table_numbers = reservationData.table_numbers;
      } else if (reservationData.table_numbers && reservationData.table_numbers.length === 1) {
        insertData.table_number = reservationData.table_numbers[0];
      } else if (reservationData.table_number) {
        insertData.table_number = reservationData.table_number;
      }

      const { data: insertedData, error } = await supabase
        .from('reservations')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      // Immediately update the cache with the new reservation for instant UI update
      if (companyId && selectedDate && insertedData) {
        const queryKey = ['reservations-date', companyId, selectedDate];
        let currentCache = queryClient.getQueryData<{
          date: string;
          reservations: Reservation[];
          lastUpdated: number;
          isToday: boolean;
        }>(queryKey);
        
        // Create cache structure if it doesn't exist
        if (!currentCache) {
          const isToday = selectedDate === new Date().toISOString().split('T')[0];
          currentCache = {
            date: selectedDate,
            reservations: [],
            lastUpdated: Date.now(),
            isToday
          };
        }
        
        // Normalize table numbers to ensure consistency (matching transformRows)
        const { table_number, table_numbers } = normalizeReservationTableNumbers(insertedData);
        
        // Transform the inserted data to match Reservation type
        const transformedReservation: Reservation = {
          id: insertedData.id,
          customer_name: insertedData.customer_name,
          phone: insertedData.phone || '',
          email: insertedData.email || '',
          party_size: insertedData.party_size,
          date: insertedData.date,
          time: insertedData.time || '19:00',
          end_time: insertedData.end_time || null,
          table_number,
          table_numbers,
          notes: insertedData.notes || '',
          status: (insertedData.status as Reservation['status']) || 'confirmed',
          locked: Boolean(insertedData.locked) || false,
          locked_until: insertedData.locked_until || null,
          has_allergens: Boolean(insertedData.has_allergens) || false,
          allergens: insertedData.allergens || [],
        };
        
        console.log('[Timeline] New reservation added to cache:', {
          id: transformedReservation.id,
          table_number,
          table_numbers,
          queryKey
        });
        
      // Update cache with new reservation
      queryClient.setQueryData(queryKey, {
        ...currentCache,
        reservations: [...currentCache.reservations, transformedReservation],
        lastUpdated: Date.now()
      });
      
      // Nudge React Query watchers to guarantee re-render
      queryClient.invalidateQueries({ queryKey, exact: true });
      
      console.log('✅ Timeline: New reservation added to cache, triggering parent refetch');
    }
    
    // Close modal immediately for better UX
    setShowNewReservationModal(false);
    setNewReservationDefaults(undefined);
    
    // Force parent refetch after small delay to ensure DB trigger completes
    setTimeout(() => {
      console.log('🔄 Timeline: Forcing parent component refetch');
      onReservationUpdate();
    }, 150);
    } catch (error: any) {
      console.error('Error saving reservation:', error);
      toast({ 
        title: "Error saving reservation", 
        description: error.message,
        variant: "destructive" 
      });
    }
  }, [toast, onReservationUpdate, companyId, selectedDate, queryClient]);

  const handleNewReservationClose = useCallback(() => {
    setShowNewReservationModal(false);
    setNewReservationDefaults(undefined);
  }, []);

  // Render immediately with cached data - no loading states that block UI
  const hasOperationalTables = operationalTables.length > 0;

  // Show empty state only if no tables after loading completes
  if (!hasOperationalTables && !loadingTables) {
    return (
      <>
        <div className="h-full overflow-hidden">
        <ResponsiveTimelineContainer
          onRefreshTables={() => {}}
          isRefreshing={false}
          showRefreshButton={false}
        >
            <TimelineEmptyState
              title="No tables configured"
              description="Tables must be configured before creating reservations. Please add tables in the restaurant settings or contact your administrator."
              primaryAction={checkPermission('/settings/table-assignment', 'admin') ? {
                label: "Go to Settings",
                onClick: () => navigate('/settings/table-assignment')
              } : undefined}
              secondaryAction={{
                label: "Retry Loading Tables",
                onClick: () => window.location.reload()
              }}
            />
          </ResponsiveTimelineContainer>
        </div>
      </>
    );
  }

  // Main timeline view
  return (
    <>
      
      <div className="h-full w-full max-w-full flex flex-col overflow-x-hidden overflow-y-auto">
        
        <ResponsiveTimelineContainer
          onRefreshTables={() => {}}
          isRefreshing={loadingTables}
          showRefreshButton={false}
        >
          <TimelineGrid
            tables={operationalTables}
            reservations={selectedDateReservations}
            timeSlots={TIME_SLOTS}
            layout={layout}
            openingHour={dynamicOpeningHour}
            closingHour={clampedClosingHour}
            selectedDate={selectedDate}
            tableSchedules={tableSchedules}
            londonTime={londonTime}
            tableGroups={tableGroups}
            dragOverInfo={enhancedMouseDragHandlers.dropZoneRef.current ? {
              tableId: enhancedMouseDragHandlers.dropZoneRef.current.tableId,
              timeSlot: enhancedMouseDragHandlers.dropZoneRef.current.timeSlot,
              cursorTimeSlot: enhancedMouseDragHandlers.dropZoneRef.current.cursorTimeSlot
            } : null}
            draggedReservation={enhancedMouseDragHandlers.mouseDragState.draggedReservation}
            onTableDragOver={() => {}}
            onTimeSlotDragOver={() => {}}
            onDragLeave={() => {}}
            onDrop={() => {}}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            onReservationClick={handleReservationClick}
            onTimeSlotClick={handleTimeSlotClick}
            hasTableConflict={enhancedMouseDragHandlers.hasTableConflict}
            enhancedMouseDragState={enhancedMouseDragHandlers.mouseDragState}
            onEnhancedMouseDragStart={enhancedMouseDragHandlers.handleMouseDragStart}
            touchDragState={touchDragHandlers.touchDragState}
            onTouchStart={touchDragHandlers.handleTouchStart}
          />
        </ResponsiveTimelineContainer>
      </div>


      <NewReservationModal
        isOpen={showNewReservationModal}
        onClose={handleNewReservationClose}
        onSave={handleNewReservationSave}
        defaults={newReservationDefaults}
      />

      <TableMoveFeedbackModal
        isOpen={feedbackModal.isOpen}
        onClose={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}
        reservationId={feedbackModal.reservationId}
        oldTableNumbers={feedbackModal.oldTableNumbers}
        newTableNumbers={feedbackModal.newTableNumbers}
        companyId={currentUser?.company_id || ''}
      />

      {/* Time Change Confirmation Dialog - works for both touch and mouse */}
      {(touchDragHandlers.pendingDrop || enhancedMouseDragHandlers.pendingDrop) && (
        <TimeChangeConfirmationDialog
          open={true}
          customerName={
            touchDragHandlers.pendingDrop?.reservation.customer_name ||
            enhancedMouseDragHandlers.pendingDrop?.reservation.customer_name ||
            ''
          }
          originalTime={
            touchDragHandlers.pendingDrop?.originalTime ||
            enhancedMouseDragHandlers.pendingDrop?.originalTime ||
            ''
          }
          newTime={
            touchDragHandlers.pendingDrop?.newTime ||
            enhancedMouseDragHandlers.pendingDrop?.newTime ||
            ''
          }
          onConfirm={() => {
            if (touchDragHandlers.pendingDrop) {
              touchDragHandlers.confirmTimeChange();
            } else if (enhancedMouseDragHandlers.pendingDrop) {
              enhancedMouseDragHandlers.confirmTimeChange();
            }
          }}
          onCancel={() => {
            if (touchDragHandlers.pendingDrop) {
              touchDragHandlers.cancelTimeChange();
            } else if (enhancedMouseDragHandlers.pendingDrop) {
              enhancedMouseDragHandlers.cancelTimeChange();
            }
          }}
        />
      )}
    </>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const ReservationTimeline = memo(ReservationTimelineComponent, (prevProps, nextProps) => {
  // Fast checks first
  if (prevProps.selectedDate !== nextProps.selectedDate) return false;
  if (prevProps.reservations.length !== nextProps.reservations.length) return false;
  if (prevProps.openingHour !== nextProps.openingHour) return false;
  if (prevProps.closingHour !== nextProps.closingHour) return false;
  
  // Deep compare reservations for the selected date only
  const prevFiltered = prevProps.reservations.filter(r => r?.date === prevProps.selectedDate);
  const nextFiltered = nextProps.reservations.filter(r => r?.date === nextProps.selectedDate);
  
  if (prevFiltered.length !== nextFiltered.length) return false;
  
  // Create ID-based lookup to avoid order dependency
  const prevById = new Map(prevFiltered.map(r => [r.id, r]));
  
  // Compare each reservation by ID (order-independent)
  for (const nextRes of nextFiltered) {
    const prevRes = prevById.get(nextRes.id);
    
    // If reservation doesn't exist in prev, re-render
    if (!prevRes) return false;
    
    // Compare all fields that affect visual display
    if (prevRes.time !== nextRes.time) return false;
    if (prevRes.table_number !== nextRes.table_number) return false;
    if (JSON.stringify(prevRes.table_numbers) !== JSON.stringify(nextRes.table_numbers)) return false;
    if (prevRes.status !== nextRes.status) return false;
    if (prevRes.customer_name !== nextRes.customer_name) return false;
    if (prevRes.party_size !== nextRes.party_size) return false;
  }
  
  return true; // No changes detected, block re-render
});
