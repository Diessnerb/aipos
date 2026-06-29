
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { findOptimalPartialGroupAssignment, findTableGroupsContaining } from '@/utils/tableGroupUtils';
import { useQueryClient } from '@tanstack/react-query';

const DEBUG_DRAG_DROP = false; // Set to true for detailed logging

interface LayoutConfig {
  TABLE_COLUMN_WIDTH: number;
  SEATS_COLUMN_WIDTH: number;
  COLUMN_WIDTH: number;
  timelineWidth: number;
  ROW_HEIGHT: number;
  totalWidth: number;
}

export const useTimelineDragDrop = (
  onReservationUpdate: () => void, 
  tables?: Array<{ table_number: number; seats: number; accessibility_friendly?: boolean }>, 
  existingReservations?: Reservation[],
  layout?: LayoutConfig,
  tableGroups?: any[],
  companyId?: string,
  selectedDate?: string
) => {
  const availableTables = tables?.map(t => t.table_number) || [];

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draggedReservation, setDraggedReservation] = useState<Reservation | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{tableId: string, timeSlot?: string, cursorTimeSlot?: string} | null>(null);
  const [draggedTableNumber, setDraggedTableNumber] = useState<number | null>(null);
  const [grabOffset, setGrabOffset] = useState<{ x: number; timeSlots: number } | null>(null);
  
  // Helper functions for table group management
  const isValidTableGroupAssignment = useCallback((tablesToCheck: number[]) => {
    if (!tableGroups || tableGroups.length === 0) return tablesToCheck.length <= 1;
    
    // Check if all tables belong to the same group
    for (const group of tableGroups) {
      const groupTables = group.table_numbers || [];
      const allTablesInGroup = tablesToCheck.every(table => groupTables.includes(table));
      if (allTablesInGroup) return true;
    }
    
    return tablesToCheck.length <= 1; // Allow single table assignments
  }, [tableGroups]);

  // Optimized conflict detection with minimal logging
  const hasTableConflict = useCallback((targetTables: number[], requestedTime: string): boolean => {
    if (!existingReservations || !requestedTime || !targetTables.length) return false;
    
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const requestedStartMinutes = timeToMinutes(requestedTime);
    const requestedEndMinutes = requestedStartMinutes + 120;
    
    return existingReservations.some(reservation => {
      // Skip the reservation being moved
      if (reservation.id === draggedReservation?.id) return false;
      
      const reservationTables = reservation.table_numbers || (reservation.table_number ? [reservation.table_number] : []);
      const hasTableOverlap = targetTables.some(table => reservationTables.includes(table));
      
      if (!hasTableOverlap || !reservation.time) return false;
      
      const resStartMinutes = timeToMinutes(reservation.time);
      const resEndMinutes = resStartMinutes + 120;
      
      return (requestedStartMinutes < resEndMinutes && requestedEndMinutes > resStartMinutes);
    });
  }, [existingReservations, draggedReservation?.id]);

  const handleDragStart = (reservation: Reservation, e: React.DragEvent, tableNumber?: number) => {
    if (reservation.locked) {
      e.preventDefault();
      toast({
        title: "Reservation is locked",
        description: "This reservation cannot be moved. Edit the reservation to unlock it first.",
        variant: "destructive"
      });
      return;
    }

    // Calculate grab offset with minimal calculations
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    const grabOffsetX = e.clientX - rect.left;
    const COLUMN_WIDTH = layout?.COLUMN_WIDTH || 19;
    const grabOffsetSlots = Math.floor(grabOffsetX / COLUMN_WIDTH);
    
    setDraggedReservation(reservation);
    setDraggedTableNumber(tableNumber || null);
    setGrabOffset({ x: grabOffsetX, timeSlots: grabOffsetSlots });
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', reservation.id);
    e.dataTransfer.setData('application/reservation', JSON.stringify({
      id: reservation.id,
      customer_name: reservation.customer_name,
      table_numbers: reservation.table_numbers,
      table_number: reservation.table_number,
      time: reservation.time
    }));
    e.dataTransfer.setData('application/grab-offset', JSON.stringify({
      x: grabOffsetX,
      timeSlots: grabOffsetSlots
    }));
    
    const isMultiTable = reservation.table_numbers && reservation.table_numbers.length > 1;
    const isConsecutive = isMultiTable ? isValidTableGroupAssignment(reservation.table_numbers!) : false;
    
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: reservation.id,
      isMultiTable,
      isConsecutive,
      draggedTableNumber: tableNumber,
      grabOffsetSlots
    }));
    
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedReservation(null);
    setDragOverInfo(null);
    setDraggedTableNumber(null);
    setGrabOffset(null);
    e.currentTarget.classList.remove('opacity-50');
  };

  // Simplified drag over handlers with reduced state updates
  const handleTableDragOver = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Only update state if it's different
    if (!dragOverInfo || dragOverInfo.tableId !== tableId) {
      setDragOverInfo({ tableId });
    }
  };

  const handleTimeSlotDragOver = (e: React.DragEvent, tableId: string, timeSlot: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    let currentGrabOffset = grabOffset;
    if (!currentGrabOffset) {
      try {
        const grabOffsetData = e.dataTransfer.getData('application/grab-offset');
        if (grabOffsetData) {
          currentGrabOffset = JSON.parse(grabOffsetData);
          setGrabOffset(currentGrabOffset);
        }
      } catch (error) {
        currentGrabOffset = { x: 0, timeSlots: 0 };
      }
    }
    
    if (!currentGrabOffset) {
      currentGrabOffset = { x: 0, timeSlots: 0 };
    }
    
    // Calculate adjusted time slot
    let adjustedTimeSlot = timeSlot;
    if (currentGrabOffset && currentGrabOffset.timeSlots > 0) {
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const minutesToTime = (totalMinutes: number) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      };
      
      const dropMinutes = timeToMinutes(timeSlot);
      const offsetMinutes = currentGrabOffset.timeSlots * 15;
      const adjustedMinutes = dropMinutes - offsetMinutes;
      
      if (adjustedMinutes >= 540) { // Don't go before 9:00 AM
        adjustedTimeSlot = minutesToTime(adjustedMinutes);
      }
    }
    
    // Only update if the drag over info has changed
    const newDragOverInfo = { 
      tableId, 
      timeSlot: adjustedTimeSlot,
      cursorTimeSlot: timeSlot
    };
    
    if (!dragOverInfo || 
        dragOverInfo.tableId !== newDragOverInfo.tableId || 
        dragOverInfo.timeSlot !== newDragOverInfo.timeSlot) {
      setDragOverInfo(newDragOverInfo);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
      return;
    }
    
    setDragOverInfo(null);
  };

  // Optimistic update helper - apply changes to cache immediately with per-reservation tracking
  const applyOptimisticUpdate = useCallback((reservation: Reservation, updates: any) => {
    if (!companyId || !selectedDate) return null;
    
    const queryKey = ['reservations-date', companyId, selectedDate];
    const previousData = queryClient.getQueryData(queryKey);
    const timestamp = Date.now();
    
    // Update cache immediately with per-reservation optimistic tracking
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      
      const updatedReservations = old.reservations.map((r: Reservation) =>
        r.id === reservation.id ? { ...r, ...updates, _optimisticState: 'updating' } : r
      );
      
      // Update per-reservation optimistic tracking
      const optimisticUpdates = new Map(old.optimisticUpdates || new Map());
      optimisticUpdates.set(reservation.id, timestamp);
      
      return {
        ...old,
        reservations: updatedReservations,
        lastUpdated: Date.now(),
        optimisticUpdates, // Per-reservation timestamps for smart protection
      };
    });
    
    // ALSO update the main device cache when deviceLive is active
    const mainQueryKey = ['reservations', companyId];
    queryClient.setQueryData(mainQueryKey, (old: any) => {
      if (!old || !Array.isArray(old)) return old;
      
      return old.map((r: any) => 
        r.id === reservation.id && r.date === selectedDate ? { ...r, ...updates, _optimisticState: 'updating' } : r
      );
    });
    
    if (DEBUG_DRAG_DROP) {
      console.log('⚡ Optimistic update applied:', { reservationId: reservation.id, updates, timestamp });
    }
    
    return previousData; // For rollback if needed
  }, [queryClient, companyId, selectedDate]);

  const handleDrop = async (e: React.DragEvent, targetTableNumber: number, targetTimeSlot?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    let reservationToMove = draggedReservation;
    
    // Recovery logic for lost drag state
    if (!reservationToMove) {
      try {
        const reservationData = e.dataTransfer.getData('application/reservation');
        if (reservationData) {
          reservationToMove = JSON.parse(reservationData);
        }
      } catch (error) {
        const reservationId = e.dataTransfer.getData('text/plain');
        if (reservationId && existingReservations) {
          reservationToMove = existingReservations.find(r => r.id === reservationId) || null;
        }
      }
      
      if (reservationToMove) {
        setDraggedReservation(reservationToMove);
      }
    }
    
    if (!reservationToMove) return;

    if (reservationToMove.locked) {
      toast({
        title: "Reservation is locked",
        description: "This reservation cannot be moved.",
        variant: "destructive"
      });
      return;
    }

    try {
      const finalTimeSlot = dragOverInfo?.timeSlot || targetTimeSlot;
      
      // Conflict check - only if we have a specific time slot
      if (finalTimeSlot) {
        const targetTables = reservationToMove.table_numbers || [targetTableNumber];
        
        const timeToMinutes = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };
        
        const requestedStartMinutes = timeToMinutes(finalTimeSlot);
        const requestedEndMinutes = requestedStartMinutes + 120;
        
        let hasConflict = false;
        let conflictDetails = null;
        
        if (existingReservations && existingReservations.length > 0) {
          for (const existingReservation of existingReservations) {
            const isSameReservation = (
              existingReservation.id === reservationToMove.id ||
              existingReservation.customer_name === reservationToMove.customer_name ||
              (existingReservation.time === reservationToMove.time && 
               JSON.stringify(existingReservation.table_numbers || [existingReservation.table_number]) === 
               JSON.stringify(reservationToMove.table_numbers || [reservationToMove.table_number]))
            );
            
            if (isSameReservation) continue;
            
            const existingTables = existingReservation.table_numbers || 
              (existingReservation.table_number ? [existingReservation.table_number] : []);
            const hasTableOverlap = targetTables.some(table => existingTables.includes(table));
            
            if (hasTableOverlap && existingReservation.time) {
              const existingStartMinutes = timeToMinutes(existingReservation.time);
              const existingEndMinutes = existingStartMinutes + 120;
              
              const hasTimeOverlap = (requestedStartMinutes < existingEndMinutes && requestedEndMinutes > existingStartMinutes);
              
              if (hasTimeOverlap) {
                hasConflict = true;
                conflictDetails = {
                  conflictingReservation: existingReservation.customer_name,
                  conflictingTime: existingReservation.time,
                  conflictingTables: existingTables
                };
                break;
              }
            }
          }
        }
        
        if (hasConflict) {
          toast({
            title: "Cannot move reservation",
            description: `This time slot conflicts with ${conflictDetails?.conflictingReservation}'s reservation at ${conflictDetails?.conflictingTime}. Please choose a different time.`,
            variant: "destructive"
          });
          
          setDraggedReservation(null);
          setDragOverInfo(null);
          setDraggedTableNumber(null);
          return;
        }
      }
      
      const updateData: any = {};
      
      // Smart table group assignment
      const isMultiTable = reservationToMove.table_numbers && reservationToMove.table_numbers.length > 1;
      
      if (isMultiTable) {
        const currentTableNumbers = reservationToMove.table_numbers!;
        const isCurrentlyValidGroup = isValidTableGroupAssignment(currentTableNumbers);
        
        if (isCurrentlyValidGroup) {
          // Use partial group assignment for optimal table usage
          const groupAssignment = findOptimalPartialGroupAssignment(
            targetTableNumber,
            reservationToMove.party_size,
            tableGroups || [],
            tables || [],
            true // Must include the anchor/target table
          );
          
          if (groupAssignment.tables.length > 1 && isValidTableGroupAssignment(groupAssignment.tables)) {
            updateData.table_numbers = groupAssignment.tables;
            updateData.table_number = null;
            
            // Show toast explaining the group assignment
            const partialIndicator = groupAssignment.isPartial ? " (partial)" : " (full)";
            toast({
              title: "Table Group Assignment",
              description: `${groupAssignment.reason}${partialIndicator}`,
            });
          } else {
            updateData.table_number = targetTableNumber;
            updateData.table_numbers = null;
            
            if (!groupAssignment.reason.includes('not in any group')) {
              toast({
                title: "Single Table Assignment",
                description: groupAssignment.reason,
              });
            }
          }
        } else {
          // Handle individual table moves within non-group multi-table reservations
          if (draggedTableNumber && draggedTableNumber !== targetTableNumber) {
            const updatedTableNumbers = currentTableNumbers.map(tableNum => 
              tableNum === draggedTableNumber ? targetTableNumber : tableNum
            );
            
            // Validate the new combination
            if (isValidTableGroupAssignment(updatedTableNumbers)) {
              updateData.table_numbers = updatedTableNumbers;
              updateData.table_number = null;
            } else {
              toast({
                title: "Invalid Table Combination",
                description: "These tables cannot be combined - they are not in the same table group.",
                variant: "destructive"
              });
              setDraggedReservation(null);
              setDragOverInfo(null);
              setDraggedTableNumber(null);
              return;
            }
          } else {
            updateData.table_number = targetTableNumber;
            updateData.table_numbers = null;
          }
        }
      } else {
        // Single table reservation - check if we should assign a group
        const groupAssignment = findOptimalPartialGroupAssignment(
          targetTableNumber,
          reservationToMove.party_size,
          tableGroups || [],
          tables || [],
          true // Must include the anchor/target table
        );
        
        if (groupAssignment.tables.length > 1 && reservationToMove.party_size > 1) {
          // Offer partial or full group assignment for larger parties
          const partialText = groupAssignment.isPartial ? "partial " : "";
          const useGroup = confirm(
            `This reservation (${reservationToMove.party_size} guests) could use ${partialText}${groupAssignment.groupName || "table group"} with ${groupAssignment.tables.length} tables (${groupAssignment.actualCapacity} seats). Assign these tables?`
          );
          
          if (useGroup) {
            updateData.table_numbers = groupAssignment.tables;
            updateData.table_number = null;
            
            toast({
              title: "Table Group Assigned",
              description: groupAssignment.reason,
            });
          } else {
            updateData.table_number = targetTableNumber;
            updateData.table_numbers = null;
          }
        } else {
          updateData.table_number = targetTableNumber;
          updateData.table_numbers = null;
        }
      }
      
      // Handle time update
      if (finalTimeSlot && finalTimeSlot !== reservationToMove.time) {
        const formattedTime = finalTimeSlot.includes(':') && finalTimeSlot.split(':').length === 2 
          ? `${finalTimeSlot}:00` 
          : finalTimeSlot;
        
        updateData.time = formattedTime;
      }

      // Only proceed if we have changes
      if (Object.keys(updateData).length === 0) {
        setDraggedReservation(null);
        setDragOverInfo(null);
        setDraggedTableNumber(null);
        return;
      }

      // INSTANT UI UPDATE - Apply optimistic changes immediately
      const previousData = applyOptimisticUpdate(reservationToMove, updateData);
      
      // Clear drag state immediately for smooth UX
      setDraggedReservation(null);
      setDragOverInfo(null);
      setDraggedTableNumber(null);

      // Process validation and database update in background
      Promise.resolve().then(async () => {
        try {
          const { error } = await supabase
            .from('reservations')
            .update(updateData)
            .eq('id', reservationToMove.id);

          if (error) throw error;

          // Log manual table move for AI learning
          const oldTableNumbers = reservationToMove.table_numbers || (reservationToMove.table_number ? [reservationToMove.table_number] : []);
          const newTableNumbers = updateData.table_numbers || (updateData.table_number ? [updateData.table_number] : []);
          
          // Get company ID from auth context or pass it as a parameter to this hook
          const currentCompanyId = companyId || localStorage.getItem('currentCompanyId') || 'unknown';
          
          // Import ReservationAnalyticsService dynamically to avoid circular imports
          try {
            const { ReservationAnalyticsService } = await import('@/services/reservationAnalyticsService');
            await ReservationAnalyticsService.logManualTableMove(
              currentCompanyId,
              reservationToMove.id,
              oldTableNumbers.length > 0 ? oldTableNumbers : null,
              newTableNumbers,
              null, // staff user ID - we could get this from auth if needed
              ['drag_and_drop'], // feedback reasons
              'Moved via timeline drag and drop'
            );
          } catch (analyticsError) {
            if (DEBUG_DRAG_DROP) {
              console.error('Error logging analytics:', analyticsError);
            }
          }

          // Success message
          let title = `${reservationToMove.customer_name}'s reservation has been moved`;
          if (updateData.time && updateData.table_number) {
            title = `${reservationToMove.customer_name}'s reservation has been moved to table ${updateData.table_number} at ${updateData.time}`;
          } else if (updateData.time) {
            title = `${reservationToMove.customer_name}'s reservation has been moved to ${updateData.time}`;
          } else if (updateData.table_number || updateData.table_numbers) {
            title = `${reservationToMove.customer_name}'s reservation has been moved to table ${updateData.table_number || targetTableNumber}`;
          }
          
          if (DEBUG_DRAG_DROP) {
            console.log('⚡ Drag-drop: Manual move completed successfully');
          }
          
          toast({
            title,
          });
          
          // Mark as confirmed and clear optimistic flag faster (400ms)
          queryClient.setQueryData(['reservations-date', companyId, selectedDate], (old: any) => {
            if (!old) return old;
            
            // Clear the per-reservation optimistic timestamp
            const optimisticUpdates = new Map(old.optimisticUpdates || new Map());
            optimisticUpdates.delete(reservationToMove.id);
            
            return {
              ...old,
              reservations: old.reservations.map((r: Reservation) =>
                r.id === reservationToMove.id ? { ...r, _optimisticState: 'confirmed' } : r
              ),
              optimisticUpdates,
            };
          });
          
          // Clear confirmed state faster (400ms instead of longer delay)
          setTimeout(() => {
            queryClient.setQueryData(['reservations-date', companyId, selectedDate], (old: any) => {
              if (!old) return old;
              return {
                ...old,
                reservations: old.reservations.map((r: Reservation) =>
                  r.id === reservationToMove.id ? { ...r, _optimisticState: undefined } : r
                ),
              };
            });
          }, 400);
          
          // Skip full refetch - trust optimistic update and real-time sync
          if (DEBUG_DRAG_DROP) {
            console.log('⚡ Drag-drop: Database updated, relying on real-time sync');
          }
          
        } catch (error: any) {
          // Rollback optimistic update on error
          if (previousData && companyId && selectedDate) {
            const queryKey = ['reservations-date', companyId, selectedDate];
            queryClient.setQueryData(queryKey, previousData);
          }
          
          console.error('Error moving reservation:', error);
          toast({
            title: "Error moving reservation",
            description: error.message || 'Failed to move reservation. Please try again.',
            variant: "destructive"
          });
        }
      });
      
    } catch (error: any) {
      console.error('Error in drag-drop operation:', error);
      toast({
        title: "Error",
        description: error.message || 'An error occurred during the drag operation.',
        variant: "destructive"
      });
    }
  };

  return {
    draggedReservation,
    dragOverInfo,
    handleDragStart,
    handleDragEnd,
    handleTableDragOver,
    handleTimeSlotDragOver,
    handleDragLeave,
    handleDrop,
    hasTableConflict
  };
};
