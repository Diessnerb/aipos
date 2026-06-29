import React, { useCallback } from 'react';
import { Table, TableGroupWithTables, TableServiceSchedule } from '@/types/table';
import { Reservation } from '@/types/reservation';
import { ReservationBlock } from './ReservationBlock';
import { useToast } from '@/hooks/use-toast';
import { shouldShowReservationBlock, calculateSegmentSpan } from '@/utils/reservationSegmentUtils';
import { format } from 'date-fns';

interface TouchDragState {
  isDragging: boolean;
  draggedReservation: Reservation | null;
  dragOffset: { x: number; y: number };
  currentPosition: { x: number; y: number };
  draggedElement: HTMLElement | null;
  dropZone: { tableId: string; timeSlot?: string; cursorTimeSlot?: string } | null;
  grabOffset: { x: number; y: number; timeSlots: number } | null;
}

interface MouseDragState {
  isDragging: boolean;
  draggedReservation: Reservation | null;
  dragOffset: { x: number; y: number };
  draggedElement: HTMLElement | null;
  grabOffset: { x: number; y: number; timeSlots: number } | null;
}

interface TableRowProps {
  table: Table;
  schedule?: TableServiceSchedule;
  selectedDate: Date;
  index: number;
  tablesLength: number;
  reservations: Reservation[];
  timeSlots: Array<{ hour: number; minute: number; time: string; label: string; isMainHour: boolean }>;
  layout: {
    TABLE_COLUMN_WIDTH: number;
    SEATS_COLUMN_WIDTH: number;
    COLUMN_WIDTH: number;
    timelineWidth: number;
    ROW_HEIGHT: number;
    ROW_REMAINDER: number;
  };
  openingHour: number;
  closingHour: number;
  dragOverInfo: {tableId: string, timeSlot?: string, cursorTimeSlot?: string} | null;
  draggedReservation: Reservation | null;
  onTableDragOver: (e: React.DragEvent, tableId: string) => void;
  onTimeSlotDragOver: (e: React.DragEvent, tableId: string, timeSlot: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetTableNumber: number, targetTimeSlot?: string) => void;
  onDragStart: (reservation: Reservation, e: React.DragEvent, tableNumber?: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onReservationClick: (reservation: Reservation, e?: React.MouseEvent) => void;
  onTimeSlotClick: (tableNumber: number, timeSlot: string) => void;
  allTables: Table[];
  hasTableConflict?: (targetTables: number[], requestedTime: string) => boolean;
  tableGroups?: TableGroupWithTables[];
  // Enhanced mouse handlers
  enhancedMouseDragState?: MouseDragState;
  onEnhancedMouseDragStart?: (reservation: Reservation, e: React.MouseEvent, tableNumber?: number) => void;
  // Touch handlers
  touchDragState: TouchDragState;
  onTouchStart: (reservation: Reservation, e: React.TouchEvent, tableNumber?: number) => void;
}

export const TableRow: React.FC<TableRowProps> = ({
  table,
  schedule,
  selectedDate,
  index,
  tablesLength,
  reservations,
  timeSlots,
  layout,
  openingHour,
  closingHour,
  dragOverInfo,
  draggedReservation,
  onTableDragOver,
  onTimeSlotDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onReservationClick,
  onTimeSlotClick,
  allTables,
  hasTableConflict,
  enhancedMouseDragState,
  onEnhancedMouseDragStart,
  touchDragState,
  onTouchStart,
  tableGroups
}) => {
  const { toast } = useToast();

  // Helper to get first name from customer name
  const getFirstName = (name?: string) => name?.trim().split(/\s+/)[0] || "this guest";
  
  // Helper to check if the selected date falls within the service outage period
  const isDateInServicePeriod = useCallback((): boolean => {
    if (!schedule || table.service_status !== 'out_of_service') {
      return false;
    }
    
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const scheduledAtDate = format(new Date(schedule.scheduled_at), 'yyyy-MM-dd');
    
    // Check if before service period starts
    if (selectedDateStr < scheduledAtDate) {
      return false;
    }
    
    // If no end date, it's indefinite - all future dates are affected
    if (!schedule.scheduled_end) {
      return true;
    }
    
    const scheduledEndDate = format(new Date(schedule.scheduled_end), 'yyyy-MM-dd');
    
    // Check if within service period
    return selectedDateStr >= scheduledAtDate && selectedDateStr <= scheduledEndDate;
  }, [schedule, selectedDate, table.service_status]);
  // Get reservations for this specific table
  const tableReservations = reservations.filter(r => {
    if (!r) return false;
    
    // Skip cancelled and no-show reservations
    if (r.status === 'cancelled' || r.status === 'no-show') return false;
    
    // Check if this reservation is assigned to this table (single or multi-table)
    // Explicitly coerce to numbers to handle any type mismatches
    if (r.table_numbers && r.table_numbers.length > 0) {
      const tableNumbers = r.table_numbers.map(Number);
      const result = tableNumbers.includes(Number(table.table_number));
      if (!result) {
        console.log('[TableRow] Reservation skipped (table_numbers mismatch):', {
          reservationId: r.id,
          reservationTableNumbers: tableNumbers,
          currentTableNumber: Number(table.table_number)
        });
      }
      return result;
    }
    
    // Fallback to single table_number, also coerce to number
    return Number(r.table_number) === Number(table.table_number);
  });
  
  
  const isTableDropTarget = dragOverInfo?.tableId === `${table.id}-${table.table_number}` && !dragOverInfo?.timeSlot;

  // Enhanced slot availability check - uses comprehensive conflict detection
  const hasReservationAtSlot = (timeSlot: string): boolean => {
    // Check both regular drag and enhanced mouse drag states
    const currentDraggedReservation = draggedReservation || enhancedMouseDragState?.draggedReservation;
    
    if (!currentDraggedReservation) {
      return false;
    }
    
    // Use the comprehensive conflict checking from the drag-drop hook if available
    if (hasTableConflict) {
      const targetTables = currentDraggedReservation.table_numbers || [table.table_number];
      const wouldConflict = hasTableConflict(targetTables, timeSlot);
      
      console.log('=== hasReservationAtSlot CHECK ===', {
        timeSlot,
        table: table.table_number,
        draggedReservation: currentDraggedReservation.customer_name,
        draggedReservationId: currentDraggedReservation.id,
        targetTables,
        wouldConflict
      });
      
      return wouldConflict;
    }
    
    return false;
  };

  // Helper function to check if a drop would cause conflicts
  const wouldDropCauseConflict = (timeSlot: string): boolean => {
    const currentDraggedReservation = draggedReservation || enhancedMouseDragState?.draggedReservation;
    
    if (!hasTableConflict || !currentDraggedReservation) {
      console.log('=== NO CONFLICT CHECK CONTEXT - ALLOWING DROP ===', {
        hasTableConflict: !!hasTableConflict,
        draggedReservation: !!currentDraggedReservation
      });
      return false;
    }
    
    const targetTables = currentDraggedReservation.table_numbers || [table.table_number];
    const wouldConflict = hasTableConflict(targetTables, timeSlot);
    
    console.log('=== wouldDropCauseConflict CHECK ===', {
      timeSlot,
      table: table.table_number,
      draggedReservation: currentDraggedReservation.customer_name,
      draggedReservationId: currentDraggedReservation.id,
      targetTables,
      wouldConflict
    });
    
    return wouldConflict;
  };

  const handleTimeSlotClick = (timeSlot: string, e: React.MouseEvent) => {
    // Don't open modal if there's already a reservation at this slot
    if (hasReservationAtSlot(timeSlot)) {
      return;
    }
    
    // Prevent event bubbling
    e.stopPropagation();
    
    onTimeSlotClick(table.table_number, timeSlot);
  };

  // Helper to check if table assignment is valid according to table groups
  const isValidTableGroupAssignment = useCallback((tableNumbers: number[]): boolean => {
    if (!tableNumbers || tableNumbers.length <= 1) return true;
    if (!tableGroups || tableGroups.length === 0) return tableNumbers.length <= 1;
    
    // Check if all tables belong to the same group
    for (const group of tableGroups) {
      const groupTableNumbers = group.table_numbers || [];
      const allTablesInGroup = tableNumbers.every(num => groupTableNumbers.includes(num));
      if (allTablesInGroup) return true;
    }
    
    return false;
  }, [tableGroups]);

  // Helper function to get table display for reservations
  const getTableDisplay = useCallback((reservation: Reservation): string => {
    if (!reservation.table_numbers || reservation.table_numbers.length <= 1) {
      return `T${reservation.table_number}`;
    }
    
    // Multi-table reservation - check if it's a valid table group
    const isValidGroup = isValidTableGroupAssignment(reservation.table_numbers);
    
    if (isValidGroup && tableGroups) {
      // Find the group name
      for (const group of tableGroups) {
        const groupTableNumbers = group.table_numbers || [];
        const allTablesInGroup = reservation.table_numbers.every(num => groupTableNumbers.includes(num));
        if (allTablesInGroup && reservation.table_numbers.length === groupTableNumbers.length) {
          return `${group.group_name} (Full)`;
        } else if (allTablesInGroup) {
          const sortedTables = [...reservation.table_numbers].sort((a, b) => a - b);
          return `${group.group_name} (T${sortedTables.join(',')})`;
        }
      }
    }
    
    // Fallback to individual table display
    const sortedTables = [...reservation.table_numbers].sort((a, b) => a - b);
    return `T${sortedTables.join(',')}`;
  }, [tableGroups, isValidTableGroupAssignment]);

  // Helper function to check if tables are consecutive (accounting for missing tables) - LEGACY
  const areTablesConsecutive = (tableNumbers: number[]) => {
    if (tableNumbers.length <= 1) return true;
    
    // Get the actual table numbers that exist in the system
    const existingTableNumbers = allTables.map(t => t.table_number).sort((a, b) => a - b);
    
    // Filter reservation tables to only include existing ones and sort them
    const sortedReservationTables = tableNumbers
      .filter(num => existingTableNumbers.includes(num))
      .sort((a, b) => a - b);
    
    if (sortedReservationTables.length !== tableNumbers.length) {
      return false;
    }
    
    // Check if they form a consecutive sequence within existing tables
    for (let i = 1; i < sortedReservationTables.length; i++) {
      const currentTable = sortedReservationTables[i];
      const prevTable = sortedReservationTables[i - 1];
      
      const currentIndex = existingTableNumbers.indexOf(currentTable);
      const prevIndex = existingTableNumbers.indexOf(prevTable);
      
      if (currentIndex - prevIndex !== 1) {
        return false;
      }
    }
    
    return true;
  };

  // Helper function to get the table span for table group reservations
  const getTableGroupSpan = (reservation: Reservation) => {
    if (!reservation.table_numbers || reservation.table_numbers.length <= 1) {
      return 1;
    }
    
    if (isValidTableGroupAssignment(reservation.table_numbers)) {
      return reservation.table_numbers.length;
    }
    
    return 1; // Invalid table groups show individual blocks
  };

  // Enhanced drop zone positioning that works with both drag systems
  const getDropZoneStyle = (tableId: string, timeSlot: string) => {
    // Check both regular drag and enhanced mouse drag (dropZone handled directly by hook now)
    const isMouseDrag = dragOverInfo?.tableId === tableId && dragOverInfo?.cursorTimeSlot === timeSlot;
    const isTouchDrag = touchDragState.dropZone?.tableId === tableId && touchDragState.dropZone?.timeSlot === timeSlot;
    
    const currentDraggedReservation = draggedReservation || enhancedMouseDragState?.draggedReservation || touchDragState.draggedReservation;
    
    if (!currentDraggedReservation) {
      return null;
    }
    
    if (!isMouseDrag && !isTouchDrag) {
      return null;
    }

    // Find the slot index for the target time slot
    const hoveredSlotIndex = timeSlots.findIndex(slot => slot.time === timeSlot);
    if (hoveredSlotIndex === -1) return null;

    // Fixed 2-hour (8-slot) reservation width
    const reservationWidthInSlots = 8;
    const remainingSlotsFromHover = timeSlots.length - hoveredSlotIndex;
    const actualWidthInSlots = Math.min(reservationWidthInSlots, remainingSlotsFromHover);
    
    // Position based on the hovered slot
    const leftPosition = hoveredSlotIndex * layout.COLUMN_WIDTH;
    const widthInPixels = actualWidthInSlots * layout.COLUMN_WIDTH;

    // Standard height for drop zone indicator
    const heightInPixels = layout.ROW_HEIGHT - 2;

    console.log('=== ENHANCED DROP ZONE POSITIONING ===', {
      targetTimeSlot: timeSlot,
      currentTable: table.table_number,
      hoveredSlotIndex,
      leftPosition,
      widthInPixels,
      heightInPixels,
      actualWidthInSlots
    });

    return {
      left: `${leftPosition}px`,
      width: `${widthInPixels}px`,
      height: `${heightInPixels}px`,
      position: 'absolute' as const
    };
  };

  // Enhanced reservation block display logic with segment-based merging
  const shouldShowBlock = (reservation: Reservation) => {
    return shouldShowReservationBlock(reservation, table.table_number, allTables);
  };

  const isFirstTableForReservation = (reservation: Reservation) => {
    if (!reservation.table_numbers || reservation.table_numbers.length <= 1) {
      return true;
    }
    
    const sortedTableNumbers = [...reservation.table_numbers].sort((a, b) => a - b);
    return sortedTableNumbers[0] === table.table_number;
  };

  // Check if table is out of service for styling
  const isOutOfService = table.service_status === 'out_of_service';
  const isAffectedByServicePeriod = isDateInServicePeriod();
  
  // Distribute ROW_REMAINDER evenly across all rows
  const extraPixelsPerRow = tablesLength > 0 ? Math.floor(layout.ROW_REMAINDER / tablesLength) : 0;
  const remainingPixels = layout.ROW_REMAINDER % tablesLength;
  // First 'remainingPixels' rows get one extra pixel
  const getsExtraPixel = index < remainingPixels ? 1 : 0;
  const effectiveRowHeight = layout.ROW_HEIGHT + extraPixelsPerRow + getsExtraPixel;

  return (
    <div 
      className={`flex hover:bg-gray-50 relative ${
        isTableDropTarget ? 'bg-blue-50' : ''
      } ${
        index < tablesLength - 1 ? 'border-b border-gray-100' : ''
      }`}
      style={{ width: '100%' }}
      data-table-id={`${table.id}-${table.table_number}`}
      onDragOver={(e) => onTableDragOver(e, `${table.id}-${table.table_number}`)}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        if (isAffectedByServicePeriod) {
          e.preventDefault();
          const currentDraggedReservation = draggedReservation || enhancedMouseDragState?.draggedReservation;
          if (currentDraggedReservation) {
            const firstName = getFirstName(currentDraggedReservation.customer_name);
            const scheduleEndMsg = schedule?.scheduled_end 
              ? ` until ${format(new Date(schedule.scheduled_end), 'MMM d')}` 
              : '';
            toast({
              title: "Cannot move reservation",
              description: `Table ${table.table_number} is out of service on this date${scheduleEndMsg}. Try a different date or table.`,
              variant: "destructive"
            });
          }
          return;
        }
        onDrop(e, table.table_number);
      }}
      title={isAffectedByServicePeriod 
        ? `Table is out of service on ${format(selectedDate, 'MMM d, yyyy')} - cannot assign bookings` 
        : ''
      }
    >
      {/* Out of Service Indicator - Only show on affected dates */}
      {isAffectedByServicePeriod && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 z-10"
          style={{ width: '4px' }}
        />
      )}
      {/* Table Name Column */}
      <div 
        className={`flex items-center justify-center border-r border-gray-300 py-1 box-border flex-shrink-0 ${
          isAffectedByServicePeriod 
            ? 'bg-yellow-100 text-yellow-800 font-semibold' 
            : 'bg-gray-50 text-gray-700'
        } text-xs font-medium`}
        style={{ width: `${layout.TABLE_COLUMN_WIDTH}px`, height: `${effectiveRowHeight}px` }}
      >
        <span className="truncate px-1">
          {table.table_name}
          {isAffectedByServicePeriod && <span className="ml-1 text-yellow-600">⚠</span>}
        </span>
      </div>
      
      {/* Seats Column */}
      <div 
        className={`flex items-center justify-center border-r border-gray-300 py-1 box-border flex-shrink-0 ${
          isAffectedByServicePeriod 
            ? 'bg-yellow-100 text-yellow-800 font-semibold' 
            : 'bg-gray-50 text-gray-700'
        } text-xs font-medium`}
        style={{ width: `${layout.SEATS_COLUMN_WIDTH}px`, height: `${effectiveRowHeight}px` }}
      >
        <span>{table.seats}</span>
      </div>
      
      {/* Time Grid and Reservations */}
      <div 
        className={`relative flex-shrink-0 ${
          isAffectedByServicePeriod ? 'bg-yellow-50' : ''
        }`}
        style={{ 
          height: `${effectiveRowHeight}px`, 
          width: `${layout.timelineWidth}px` 
        }}
      >
        {/* Time Slot Drop Zones */}
        {timeSlots.map((slot, colIndex) => {
          // Show border for all slots except the very last one
          const showBorder = colIndex < timeSlots.length - 1;
          const borderStyle = slot.isMainHour 
            ? 'border-l border-gray-400' 
            : 'border-l border-gray-200 border-dashed';
          
          const hasReservation = hasReservationAtSlot(slot.time);
          
          return (
            <div
              key={slot.time}
              data-time-slot={slot.time}
              className={`absolute top-0 bottom-0 ${
                // Disable transitions during active drag for performance
                (draggedReservation || enhancedMouseDragState?.isDragging || touchDragState.isDragging) 
                  ? '' 
                  : 'transition-all duration-75 ease-out'
              } ${
                hasReservation || isAffectedByServicePeriod
                  ? 'cursor-default' 
                  : 'cursor-pointer hover:bg-primary/5'
              } ${
                showBorder ? borderStyle : ''
              } ${
                // Show drag over indication at the ACTUAL drop position (not cursor position)
                (dragOverInfo?.tableId === `${table.id}-${table.table_number}` && 
                dragOverInfo?.timeSlot === slot.time)
                  ? "bg-primary/20 border border-primary/50 scale-[1.02] shadow-sm"
                  : ""
              }`}
              style={{ 
                left: `${colIndex * layout.COLUMN_WIDTH}px`,
                width: `${layout.COLUMN_WIDTH}px`
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                onTimeSlotDragOver(e, `${table.id}-${table.table_number}`, slot.time);
              }}
              onDragLeave={onDragLeave}
              onDrop={(e) => {
                console.log('=== TIME SLOT DROP ATTEMPT ===', {
                  tableNumber: table.table_number,
                  timeSlot: slot.time,
                  hasReservation,
                  isAffectedByServicePeriod,
                  draggedReservation: draggedReservation?.customer_name
                });
                
                if (!hasReservation && !isAffectedByServicePeriod) {
                  onDrop(e, table.table_number, slot.time);
                } else if (isAffectedByServicePeriod) {
                  console.log('=== DROP REJECTED - OUT OF SERVICE ON THIS DATE ===');
                  e.preventDefault();
                  const currentDraggedReservation = draggedReservation || enhancedMouseDragState?.draggedReservation;
                  if (currentDraggedReservation) {
                    const firstName = getFirstName(currentDraggedReservation.customer_name);
                    const scheduleEndMsg = schedule?.scheduled_end 
                      ? ` until ${format(new Date(schedule.scheduled_end), 'MMM d')}` 
                      : '';
                    toast({
                      title: "Cannot move reservation",
                      description: `Table ${table.table_number} is out of service on this date${scheduleEndMsg}. Try a different date or table.`,
                      variant: "destructive"
                    });
                  }
                } else {
                  console.log('=== DROP REJECTED - SLOT OCCUPIED ===');
                  e.preventDefault();
                }
              }}
              onClick={(e) => {
                if (!isAffectedByServicePeriod) {
                  handleTimeSlotClick(slot.time, e);
                }
              }}
              title={
                isAffectedByServicePeriod 
                  ? `Table is out of service on ${format(selectedDate, 'MMM d, yyyy')} - cannot assign bookings`
                  : hasReservation 
                  ? 'Time slot occupied' 
                  : 'Click to add reservation'
              }
            />
          );
        })}

        {/* Enhanced Drop Zone Shadow - Works with both drag systems */}
        {(() => {
          const isMouseDropZone = dragOverInfo?.tableId === `${table.id}-${table.table_number}` && dragOverInfo?.timeSlot;
        const isTouchDropZone = touchDragState.dropZone?.tableId === `${table.id}-${table.table_number}` && 
                               touchDragState.dropZone?.timeSlot;
          const shouldShowDropZone = isMouseDropZone || isTouchDropZone;
          
          console.log('=== ENHANCED DROP ZONE SHADOW CHECK ===', {
            tableId: `${table.id}-${table.table_number}`,
            dragOverInfo,
            isMouseDropZone,
            isTouchDropZone,
            shouldShowDropZone,
            draggedReservation: draggedReservation?.customer_name || null,
            enhancedMouseDraggedReservation: enhancedMouseDragState?.draggedReservation?.customer_name || null,
            touchDraggedReservation: touchDragState.draggedReservation?.customer_name || null
          });
          
          if (!shouldShowDropZone) return null;
          
          // Use cursor time slot for visualization
          const cursorTimeSlot = dragOverInfo?.cursorTimeSlot || 
                               touchDragState.dropZone?.cursorTimeSlot;
          if (!cursorTimeSlot) return null;
          
          const dropZoneStyle = getDropZoneStyle(`${table.id}-${table.table_number}`, cursorTimeSlot);
          if (!dropZoneStyle) return null;
          
          return (
            <div
              key={`drop-zone-${cursorTimeSlot}`}
              className="pointer-events-none z-20 bg-transparent border-transparent rounded-sm transition-all duration-150 ease-out"
              style={dropZoneStyle}
            >
              <div className="w-full h-full flex items-center justify-center text-xs font-medium text-transparent">
                2h Block
              </div>
            </div>
          );
        })()}
        
        {/* Reservations - Handle both drag systems */}
        {tableReservations.map((reservation) => {
          if (!reservation) return null;
          
          // Extra safety: skip cancelled and no-show reservations
          if (reservation.status === 'cancelled' || reservation.status === 'no-show') return null;
          
          // Only show reservation block if this table should display it
          if (!shouldShowBlock(reservation)) {
            return null;
          }
          
          const { height: segmentHeight, tablesInSegment } = calculateSegmentSpan(
            reservation, 
            table.table_number, 
            allTables, 
            layout.ROW_HEIGHT
          );
          
          return (
            <ReservationBlock
              key={`${reservation.id}-${table.table_number}`}
              reservation={reservation}
              layout={layout}
              timeSlots={timeSlots}
              openingHour={openingHour}
              closingHour={closingHour}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={onReservationClick}
              draggedReservation={draggedReservation || enhancedMouseDragState?.draggedReservation}
              isFirstTable={true}
              tableSpanCount={tablesInSegment.length}
              currentTableNumber={table.table_number}
              tables={allTables}
              tableGroups={tableGroups}
              onTouchStart={onTouchStart}
              onEnhancedMouseStart={onEnhancedMouseDragStart}
              touchDragState={touchDragState}
              enhancedMouseDragState={enhancedMouseDragState}
              segmentTables={tablesInSegment}
            />
          );
        })}
      </div>
    </div>
  );
};
