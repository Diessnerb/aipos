import React, { useCallback, useEffect, useState } from 'react';
import { ReservationHeader } from '@/components/reservations/ReservationHeader';
import { ReservationTimeline } from '@/components/reservations/ReservationTimeline';
import { EnhancedReservationTable } from '@/components/reservations/EnhancedReservationTable';
import { useUltraFastReservationsQuery } from '@/hooks/useUltraFastReservationsQuery';
import { useUltraFastDataPrefetch } from '@/hooks/useUltraFastDataPrefetch';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { PageShell } from '@/components/ui/page-shell';
import { InlineSkeleton } from '@/components/ui/inline-skeleton';
import { ReservationCacheMonitor } from '@/components/debug/ReservationCacheMonitor';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { getBoundCompany } from '@/utils/deviceBinding';
import { Reservation } from '@/types/reservation';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTimelineOptimization } from '@/hooks/useTimelineOptimization';
import { useRealtimeOptimization } from '@/hooks/useRealtimeOptimization';
import { useTableGroups } from '@/hooks/useTableGroups';
import { useCourseTimerMonitor } from '@/hooks/useCourseTimerMonitor';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { offlineAwareUpdate } from '@/utils/offlineAwareSupabase';

type ViewMode = 'list' | 'timeline';

export const UnifiedReservationsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    reservation: Reservation | null;
  }>({ isOpen: false, reservation: null });
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  
  // Track recently modal-edited reservations to bypass drag-drop confirmation
  const recentModalEditsRef = React.useRef<Map<string, number>>(new Map());
  
  // Check if device live layer is active (eliminates loading states)
  const deviceLive = useDeviceLiveLayer();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const { toast } = useToast();
  
  // Ultra-fast data prefetching
  const { prefetchTodayInstant } = useUltraFastDataPrefetch();
  
  // Pre-fetch table groups for instant modal opening (Phase 1)
  const { tableGroups } = useTableGroups();
  
  // Ultra-fast date-specific reservations query - shared by both views
  const { reservations, loading, error, refetch, isCacheHit, isToday } = useUltraFastReservationsQuery(selectedDate);

  // Continuous optimization - runs every minute
  const { isRunning: isOptimizing, triggerOptimization: manualOptimizeTrigger } = useTimelineOptimization({
    enabled: viewMode === 'timeline',
    interval: 5, // Every 5 minutes for background optimization
    strategicInterval: 60, // Deep optimization every hour
    onOptimizationComplete: (result) => {
      if (result.success && result.movesCount > 0) {
        refetch(); // Refresh data silently
      }
    }
  });

  // Real-time optimization on reservation changes
  useRealtimeOptimization({
    enabled: viewMode === 'timeline',
    debounceMs: 2000,
    contextDate: selectedDate,
    onOptimizationComplete: (result) => {
      if (result.success && result.movesCount > 0) {
        refetch();
      }
    }
  });

  // Monitor course timers for automatic status transitions
  useCourseTimerMonitor(reservations || []);

  // Prefetch today's data instantly on mount + one-shot repair check
  useEffect(() => {
    prefetchTodayInstant();
    
    // One-shot repair check on mount
    const bound = getBoundCompany();
    const effectiveCompanyId = companyId || bound?.company_id;
    if (effectiveCompanyId) {
      DeviceDataManager.ensureCriticalCaches(effectiveCompanyId);
    }
  }, [companyId]);

  // Performance monitoring
  useEffect(() => {
    if (reservations.length > 0) {
      const loadType = isCacheHit ? 'CACHE' : 'NETWORK';
      const priority = isToday ? 'TODAY' : 'OTHER_DATE';
      console.log(`⚡ Unified Page - Reservations loaded: ${loadType} | ${priority} | Count: ${reservations.length}`);
    }
  }, [reservations, isCacheHit, isToday]);

  // Memoize the refetch callback to prevent re-renders
  const handleReservationUpdate = useCallback(async () => {
    console.log('🔄 UnifiedPage: handleReservationUpdate called for', selectedDate);
    const key = ['reservations-date', companyId, selectedDate] as const;
    
    // Force next fetch to bypass the 30s ultra-fast cache guard
    queryClient.setQueryData(key, (prev: any) => prev ? { ...prev, lastUpdated: 0 } : prev);
    
    // Invalidate to mark as stale
    queryClient.invalidateQueries({ queryKey: key });
    
    // Force immediate refetch and wait for completion
    await queryClient.refetchQueries({ queryKey: key, exact: true });
    
    // Also refetch the main query
    await refetch();
    
    console.log('✅ UnifiedPage: Refetch completed');
  }, [refetch, queryClient, companyId, selectedDate]);

  // Shared reservation action handlers
  const handleEdit = useCallback((reservation: Reservation) => {
    setModalState({ isOpen: true, reservation });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reservation deleted successfully",
      });

      // Explicit cache invalidation and refetch for instant UI update
      if (companyId && selectedDate) {
        const queryKey = ['reservations-date', companyId, selectedDate];
        queryClient.invalidateQueries({ queryKey });
        queryClient.refetchQueries({ queryKey, exact: true });
      }

      handleReservationUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [handleReservationUpdate, toast, companyId, selectedDate, queryClient]);

  // Cleanup utility: Remove table assignments from no-show/cancelled reservations
  const fixNoShowAssignments = useCallback(async () => {
    try {
      // Find no-show or cancelled reservations on selected date with table assignments
      const { data: problematicReservations, error: fetchError } = await supabase
        .from('reservations')
        .select('id, customer_name, status, table_number, table_numbers')
        .eq('date', selectedDate)
        .in('status', ['no-show', 'cancelled'])
        .or('table_number.not.is.null,table_numbers.not.is.null');

      if (fetchError) throw fetchError;
      
      if (!problematicReservations || problematicReservations.length === 0) {
        toast({
          title: "No cleanup needed",
          description: "All no-show/cancelled reservations are already unassigned",
        });
        return;
      }

      // Clear table assignments using offlineAware
      const updates = problematicReservations.map(r => 
        offlineAwareUpdate('reservations', r.id, { 
          table_number: null, 
          table_numbers: null 
        })
      );

      await Promise.all(updates);
      
      toast({
        title: "Cleanup complete",
        description: `Cleaned up ${problematicReservations.length} no-show/cancelled reservation(s)`,
      });
      
      // Refetch data to update UI
      handleReservationUpdate();
    } catch (err) {
      console.error('Cleanup error:', err);
      toast({
        title: "Cleanup failed",
        description: "Failed to clean up reservations",
        variant: "destructive",
      });
    }
  }, [selectedDate, toast, handleReservationUpdate]);

  const handleStatusChange = useCallback(async (id: string, status: Reservation['status']) => {
    try {
      // Get the reservation details first
      const { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const updateData: Partial<Reservation> = { status };
      
      // Set timestamp when guests are seated
      if (status === 'seated') {
        updateData.seated_at = new Date().toISOString();
      }
      
      // Set timestamp when courses are served
      if (status === 'starters-served') {
        updateData.starters_served_at = new Date().toISOString();
      } else if (status === 'mains-served') {
        updateData.mains_served_at = new Date().toISOString();
      } else if (status === 'desserts-served') {
        updateData.desserts_served_at = new Date().toISOString();
      }
      
      // Clear seated timestamp if moving away from seated status
      if (status !== 'seated' && reservation.status === 'seated') {
        updateData.seated_at = null;
      }
      
      // Clear timestamps if moving backwards in the flow
      if (status === 'waiting-for-starters' || status === 'starters-ready-in-kitchen') {
        updateData.starters_served_at = null;
      }
      if (status === 'waiting-for-mains' || status === 'mains-ready-in-kitchen') {
        updateData.mains_served_at = null;
      }
      if (status === 'waiting-for-desserts' || status === 'desserts-ready-in-kitchen') {
        updateData.desserts_served_at = null;
      }
      
      // Clear table assignments for cancelled/no-show reservations
      if (status === 'cancelled' || status === 'no-show') {
        updateData.table_number = null;
        updateData.table_numbers = null;
      }
      
      // Set end_time for completed reservations (keeps table assignment)
      if (status === 'completed') {
        const { roundToLast15Minutes } = await import('@/utils/timeUtils');
        updateData.end_time = roundToLast15Minutes();
        
        // Increment customer visit count if phone number exists
        if (reservation.phone && companyId) {
          const { CustomerVisitService } = await import('@/services/customerVisitService');
          const result = await CustomerVisitService.incrementVisitCount(
            companyId,
            reservation.phone,
            reservation.date
          );
          
          if (!result.success) {
            console.warn('Failed to increment visit count:', result.error);
          }
        }
      }

      const { error } = await offlineAwareUpdate('reservations', id, updateData);

      if (error) throw error;

      toast({
        title: "Success",
        description: status === 'completed' 
          ? "Reservation completed and visit recorded" 
          : status === 'cancelled' || status === 'no-show'
          ? `Reservation ${status} - table cleared`
          : "Reservation status updated",
      });

      handleReservationUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [handleReservationUpdate, toast, companyId]);

  const isReservationInPast = useCallback((date: string) => {
    return new Date(date) < new Date();
  }, []);

  const shouldShowPastDateAlert = useCallback((reservation: Reservation) => {
    return isReservationInPast(reservation.date) && reservation.status !== 'completed';
  }, [isReservationInPast]);

  const getTableDisplay = useCallback((reservation: Reservation) => {
    if (reservation.table_numbers?.length > 0) {
      return `Tables ${reservation.table_numbers.join(', ')}`;
    }
    if (reservation.table_number) {
      return `Table ${reservation.table_number}`;
    }
    return 'Unassigned';
  }, []);

  // Check if a reservation was recently edited via modal (within last 2 seconds)
  const isRecentModalEdit = useCallback((reservationId: string): boolean => {
    const editTime = recentModalEditsRef.current.get(reservationId);
    if (!editTime) return false;
    
    const now = Date.now();
    const isRecent = (now - editTime) < 2000; // 2 seconds
    
    // Clean up old entries
    if (!isRecent) {
      recentModalEditsRef.current.delete(reservationId);
    }
    
    return isRecent;
  }, []);

  const handleSaveReservation = useCallback(async (reservation: Reservation): Promise<boolean> => {
    try {
      // Remove temporary client-side fields before database write
      const { _updateSource, _foundCustomerId, ...cleanReservation } = reservation as any;
      
      // Sync customer data BEFORE saving reservation
      if (companyId && cleanReservation.phone && cleanReservation.customer_name) {
        const { CustomerSyncService } = await import('@/services/customerSyncService');
        const syncResult = await CustomerSyncService.syncCustomerFromReservation(
          companyId,
          cleanReservation.customer_name,
          cleanReservation.phone,
          cleanReservation.email || undefined,
          cleanReservation.date
        );
        
        if (syncResult.success) {
          console.log('✅ Customer synced:', syncResult.customerId);
        } else {
          console.warn('⚠️ Customer sync failed:', syncResult.error);
          // Don't fail reservation save if customer sync fails
        }
      }
      
      // If this is a modal update, set last_manual_move_time to prove user initiated it
      // This allows the database trigger to distinguish user changes from optimizer changes
      if (_updateSource === 'modal') {
        cleanReservation.last_manual_move_time = new Date().toISOString();
        // Track this as a recent modal edit to bypass drag-drop confirmation
        recentModalEditsRef.current.set(reservation.id, Date.now());
      }
      
      const { error } = await supabase
        .from('reservations')
        .upsert(cleanReservation);

      if (error) throw error;

      // Toast removed - specific success messages are shown in EditReservationModal
      // This prevents duplicate notifications for status updates and other operations

      // Explicit cache invalidation and refetch for instant UI update
      if (companyId && selectedDate) {
        const queryKey = ['reservations-date', companyId, selectedDate];
        queryClient.invalidateQueries({ queryKey });
        queryClient.refetchQueries({ queryKey, exact: true });
        
        // Also invalidate customers cache if new customer might have been created
        queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      }

      handleReservationUpdate();
      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  }, [handleReservationUpdate, toast, companyId, selectedDate, queryClient]);

  // Ultra-fast loading with performance monitoring
  const isConnecting = !deviceLive && loading && (reservations?.length ?? 0) === 0;

  if (error && !deviceLive) {
    return (
      <PageShell>
        <div className="p-4">
          <div className="text-destructive">Error: {error}</div>
          <button 
            onClick={() => refetch()} 
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Retry
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className={viewMode === 'timeline' ? 'h-full overflow-hidden p-1.5 space-y-0' : undefined}>
      <div className={viewMode === 'timeline' ? 'relative flex h-full flex-col gap-0' : 'space-y-4'}>
        {/* Cache Monitor - Absolute Overlay (no layout impact) */}
        {viewMode === 'timeline' && (
          <div className="absolute top-1 right-2 z-10 pointer-events-none hidden md:block">
            <ReservationCacheMonitor selectedDate={selectedDate} />
          </div>
        )}
        
        {/* Cache Monitor - List View (in-flow) */}
        {viewMode === 'list' && (
          <div className="flex items-center justify-between gap-2">
            <ReservationCacheMonitor selectedDate={selectedDate} />
          </div>
        )}
        
        {/* Single Header - stable across view switches */}
        <ReservationHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isDialogOpen={modalState.isOpen}
          onDialogOpenChange={(isOpen) => setModalState(prev => ({ ...prev, isOpen }))}
          editingReservation={modalState.reservation}
          onEditingReservationChange={(reservation) => setModalState(prev => ({ ...prev, reservation }))}
          onSaveReservation={handleSaveReservation}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          isTimelineView={viewMode === 'timeline'}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          onOptimizeTrigger={manualOptimizeTrigger}
          isOptimizing={isOptimizing}
          onCleanupNoShows={viewMode === 'timeline' ? fixNoShowAssignments : undefined}
        />
        
        {/* Show connecting indicator only if truly loading and device not live */}
        {isConnecting && !deviceLive && (
          <div className="text-sm text-muted-foreground px-2">
            <InlineSkeleton lines={1} width="w-48" height="h-4" />
            <span className="ml-2 text-xs">Loading {isToday ? 'today\'s' : 'date'} reservations...</span>
          </div>
        )}
        
        {/* Unified View Container - both views always mounted */}
        <div className={viewMode === 'timeline' ? 'relative w-full flex-1 min-h-0' : 'relative w-full'}>
          {/* Timeline View */}
          <div 
            className={`w-full transition-opacity duration-200 ${
              viewMode === 'timeline' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
            }`}
          >
            <ReservationTimeline
              reservations={reservations || []}
              onReservationUpdate={handleReservationUpdate}
              selectedDate={selectedDate}
              onSelectedDateChange={setSelectedDate}
              onEditReservation={handleEdit}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              isRecentModalEdit={isRecentModalEdit}
            />
          </div>
          
          {/* List View */}
          <div 
            className={`w-full transition-opacity duration-200 ${
              viewMode === 'list' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
            }`}
          >
            <EnhancedReservationTable
              reservations={reservations || []}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              isReservationInPast={isReservationInPast}
              shouldShowPastDateAlert={shouldShowPastDateAlert}
              getTableDisplay={getTableDisplay}
              onReservationUpdate={handleReservationUpdate}
              emptyTitle={`No reservations for ${selectedDate}`}
              emptyDescription="Try selecting a different date or create a new reservation"
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
};