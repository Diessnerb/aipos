import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ReservationTimeline } from '@/components/reservations/ReservationTimeline';
import { ReservationHeader } from '@/components/reservations/ReservationHeader';
import { ReservationFilters } from '@/components/reservations/ReservationFilters';
import { EnhancedReservationTable } from '@/components/reservations/EnhancedReservationTable';
import { ReservationSearchAndFilters } from '@/components/reservations/ReservationSearchAndFilters';
import { ConflictAlertBanner } from '@/components/reservations/ConflictAlertBanner';


import { useReservations } from '@/hooks/useReservations';
import { useUltraFastReservationsQuery } from '@/hooks/useUltraFastReservationsQuery';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useDoubleBookingDetection } from '@/hooks/useDoubleBookingDetection';
import { useTimelineOptimization } from '@/hooks/useTimelineOptimization';
import { useRealtimeOptimization } from '@/hooks/useRealtimeOptimization';
import { useCourseTimerMonitor } from '@/hooks/useCourseTimerMonitor';
// Layout is now handled by MainLayout - no need to import
import TimelineLayout from '@/components/layout/TimelineLayout';
import { 
  filterReservations, 
  sortReservations, 
  isReservationInPast, 
  shouldShowPastDateAlert, 
  getTableDisplay 
} from '@/utils/reservationUtils';
import { Reservation } from '@/types/reservation';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/ui/page-header';

const ReservationLogs = () => {
  const { userRole, companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('upcoming');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Get view mode from URL params, default to 'timeline'
  const viewMode = (searchParams.get('view') as 'list' | 'timeline') || 'timeline';
  const deviceLive = useDeviceLiveLayer();
  
  const setViewMode = (mode: 'list' | 'timeline') => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('view', mode);
    setSearchParams(newSearchParams);
  };
  
  // Enhanced features state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Company settings for auto-assignment
  const { settings } = useCompanySettings();

  // Defer non-critical features for faster initial render
  const [enableOptimizations, setEnableOptimizations] = useState(false);
  
  useEffect(() => {
    // Enable optimizations after first render
    const timer = setTimeout(() => setEnableOptimizations(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Double booking detection (deferred)
  const { conflicts, hasActiveConflicts } = useDoubleBookingDetection(
    true, 
    30000, 
    enableOptimizations
  );

  // Use different hooks based on view mode and device binding
  const timelineData = useUltraFastReservationsQuery(selectedDate);
  const legacyData = useReservations(settings?.auto_assign_tables || false);
  
  // Choose data source based on view mode and device binding
  const {
    reservations,
    loading,
    fetchError,
    fetchReservations,
    handleSaveReservation,
    handleDeleteReservation,
    handleStatusChange,
    handleManualAssign,
    autoAssignTables,
    lastUpdateTimestamp,
  } = viewMode === 'timeline' && deviceLive ? {
    reservations: timelineData.reservations,
    loading: timelineData.loading,
    fetchError: timelineData.error,
    fetchReservations: timelineData.refetch,
    handleSaveReservation: legacyData.handleSaveReservation,
    handleDeleteReservation: legacyData.handleDeleteReservation,
    handleStatusChange: legacyData.handleStatusChange,
    handleManualAssign: legacyData.handleManualAssign,
    autoAssignTables: legacyData.autoAssignTables,
    lastUpdateTimestamp: 0,
  } : legacyData;

  // Continuous optimization - runs every 5 minutes (deferred)
  const { isRunning: isOptimizing, triggerOptimization: manualOptimizeTrigger } = useTimelineOptimization({
    enabled: enableOptimizations && viewMode === 'timeline',
    interval: 5, // Every 5 minutes for background optimization
    strategicInterval: 60, // Deep optimization every hour
    onOptimizationComplete: (result) => {
      if (result.success && result.movesCount > 0) {
        fetchReservations(); // Refresh data silently
      }
    }
  });

  // Real-time optimization on reservation changes (deferred)
  useRealtimeOptimization({
    enabled: enableOptimizations && viewMode === 'timeline',
    debounceMs: 2000,
    contextDate: selectedDate,
    onOptimizationComplete: (result) => {
      if (result.success && result.movesCount > 0) {
        fetchReservations();
      }
    }
  });

  // Monitor course timers for automatic status transitions
  useCourseTimerMonitor(reservations || []);

  const handleFilterStatusChange = (status: string) => {
    setFilterStatus(status);
  };


  const handleEditFromTimeline = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setIsDialogOpen(true);
  };

  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setIsDialogOpen(true);
  };

  const handleSave = async (reservation: Reservation) => {
    // Optimistic close - close modal immediately for instant feedback
    setIsDialogOpen(false);
    setEditingReservation(null);
    
    // Optimistic update for timeline + device live mode
    if (viewMode === 'timeline' && deviceLive && companyId) {
      const queryKey = ['reservations-date', companyId, reservation.date];
      queryClient.setQueryData(queryKey, (prev: any) => {
        if (!prev?.reservations) return prev;
        
        const updatedReservations = prev.reservations.map((r: Reservation) =>
          r.id === reservation.id ? reservation : r
        );
        
        return {
          ...prev,
          reservations: updatedReservations,
          lastUpdated: 0 // Reset to bypass cache guard
        };
      });
    }
    
    // Perform save in background
    const success = await handleSaveReservation(reservation);
    
    if (success) {
      // Defer unified refetch to prevent re-render interference with modal close
      requestAnimationFrame(() => {
        fetchReservations();
      });
    } else {
      // If save failed, reopen the modal
      setIsDialogOpen(true);
      setEditingReservation(reservation);
    }
    
    return success;
  };

  const filteredReservations = useMemo(() => {
    // Ensure reservations is always an array
    const safeReservations = Array.isArray(reservations) ? reservations : [];
    let filtered = filterReservations(safeReservations, filterStatus);
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.customer_name.toLowerCase().includes(searchLower) ||
        r.phone?.toLowerCase().includes(searchLower) ||
        r.email?.toLowerCase().includes(searchLower)
      );
    }
    
    if (dateRange.from) {
      filtered = filtered.filter(r => {
        const reservationDate = new Date(r.date);
        const fromDate = dateRange.from!;
        const toDate = dateRange.to || dateRange.from!;
        
        return reservationDate >= fromDate && reservationDate <= toDate;
      });
    }
    
    return filtered;
  }, [reservations, filterStatus, searchTerm, dateRange]);

  // MUST be after filteredReservations to maintain consistent hook order
  const sortedReservations = useMemo(() => 
    sortReservations(filteredReservations), 
    [filteredReservations]
  );

  // Count unassigned reservations for the filter badge
  const getUnassignedCount = (reservationsList: Reservation[]) => {
    return reservationsList.filter(reservation =>
      !reservation.table_number &&
      (!reservation.table_numbers || reservation.table_numbers.length === 0) &&
      reservation.status !== 'cancelled' &&
      reservation.status !== 'no-show' &&
      reservation.status !== 'completed'
    ).length;
  };

  // Generate contextual empty state messages
  const getEmptyStateMessages = () => {
    const hasSearch = searchTerm.trim().length > 0;
    const hasDateFilter = dateRange.from;
    
    if (hasSearch && hasDateFilter) {
      return {
        title: "No matching reservations found",
        description: `No reservations match your search "${searchTerm}" for the selected date range.`
      };
    }
    
    if (hasSearch) {
      return {
        title: "No matching reservations found", 
        description: `No reservations match your search "${searchTerm}". Try a different search term.`
      };
    }
    
    if (hasDateFilter) {
      return {
        title: "No reservations for selected dates",
        description: "No reservations found for the selected date range. Try expanding your date selection."
      };
    }
    
    switch (filterStatus) {
      case 'upcoming':
        return {
          title: "No upcoming reservations at this time",
          description: "All quiet on the reservation front! New bookings will appear here."
        };
      case 'seated':
        return {
          title: "No seated reservations at this time", 
          description: "No guests are currently seated. Seated reservations will appear here."
        };
      case 'cancelled':
        return {
          title: "No cancelled reservations",
          description: "No reservations have been cancelled. Cancelled bookings will appear here."
        };
      case 'completed':
        return {
          title: "No completed reservations at this time",
          description: "No reservations have been completed yet. Finished bookings will appear here."
        };
      case 'no-show':
        return {
          title: "No no-show reservations",
          description: "Great news! No guests have missed their reservations. No-shows will appear here."
        };
      case 'unassigned':
        return {
          title: "No unassigned reservations",
          description: "All reservations have tables assigned. Unassigned bookings will appear here."
        };
      default:
        return {
          title: "No reservations found",
          description: "No reservations match your current filters. Try adjusting them or create a new reservation."
        };
    }
  };

  const handleExportCSV = () => {
    const csvContent = [
      ['Guest Name', 'Date', 'Time', 'Party Size', 'Table', 'Phone', 'Email', 'Status', 'Notes'],
      ...filteredReservations.map(r => [
        r.customer_name,
        r.date,
        r.time,
        r.party_size.toString(),
        getTableDisplay(r),
        r.phone || '',
        r.email || '',
        r.status,
        r.notes || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Timeline view - with instant render for device-bound scenarios
  if (viewMode === 'timeline') {
    // Check for cached data to enable instant render
    const hasCachedData = deviceLive && reservations && reservations.length > 0;
    
    return (
      <TimelineLayout>
        <div className="flex flex-col h-screen">
          <div className="flex-shrink-0 bg-card border-b border-card">
            <ReservationHeader
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isDialogOpen={isDialogOpen}
              onDialogOpenChange={setIsDialogOpen}
              editingReservation={editingReservation}
              onEditingReservationChange={setEditingReservation}
              onSaveReservation={handleSave}
              isTimelineView={true}
              selectedDate={selectedDate}
              onSelectedDateChange={setSelectedDate}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onOptimizeTrigger={manualOptimizeTrigger}
              isOptimizing={isOptimizing}
            />
          </div>

          <div className="flex-1 min-h-0">
            {loading && !hasCachedData ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">Loading reservations...</div>
              </div>
            ) : (
              <ReservationTimeline
                reservations={reservations}
                onReservationUpdate={fetchReservations}
                selectedDate={selectedDate}
                onSelectedDateChange={setSelectedDate}
                openingHour={9}
                closingHour={23}
                onEditReservation={handleEditFromTimeline}
              />
            )}
          </div>
        </div>
      </TimelineLayout>
    );
  }

  // List view - with instant shell and inline data loading
  return (
    <div className="flex flex-col h-screen overflow-hidden">
        <div className="flex-shrink-0 space-y-4">
          {hasActiveConflicts && (
            <ConflictAlertBanner 
              conflicts={conflicts} 
              className="mb-4"
            />
          )}
          
          <ReservationHeader
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isDialogOpen={isDialogOpen}
            onDialogOpenChange={setIsDialogOpen}
            editingReservation={editingReservation}
            onEditingReservationChange={setEditingReservation}
            onSaveReservation={handleSave}
            isTimelineView={false}
            onOptimizeTrigger={manualOptimizeTrigger}
            isOptimizing={isOptimizing}
          />

          <ReservationSearchAndFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <ReservationFilters
              filterStatus={filterStatus}
              onFilterStatusChange={handleFilterStatusChange}
              unassignedCount={getUnassignedCount(reservations || [])}
            />
            
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : (
            <EnhancedReservationTable
              reservations={sortedReservations}
              onEdit={handleEdit}
              onDelete={handleDeleteReservation}
              onStatusChange={handleStatusChange}
              onManualAssign={handleManualAssign}
              onReservationUpdate={fetchReservations}
              isReservationInPast={isReservationInPast}
              shouldShowPastDateAlert={(reservation) => shouldShowPastDateAlert(reservation, filterStatus)}
              getTableDisplay={getTableDisplay}
              emptyTitle={getEmptyStateMessages().title}
              emptyDescription={getEmptyStateMessages().description}
            />
          )}
        </div>
      </div>
    );

  };

  export default ReservationLogs;
