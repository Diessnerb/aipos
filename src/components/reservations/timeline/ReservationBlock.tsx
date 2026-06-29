import React from 'react';
import { Lock, Armchair, TriangleAlert, Accessibility } from 'lucide-react';
import { Reservation } from '@/types/reservation';
import { Table } from '@/types/table';
import { getStatusColor, getStatusLeftBorderColor, timeToMinutes } from './utils/timelineUtils';
import { formatCustomerName } from '@/utils/nameUtils';
import { getReservationTextContent } from './utils/reservationDisplay';
import { detectAccessibilityNeeds } from '@/utils/accessibilityDetection';
import { ReservationLockIndicator } from './ReservationLockIndicator';
import { isValidTableCombination, findTableGroupsContaining } from '@/utils/tableGroupUtils';
import { TableGroupWithTables } from '@/types/table';
import { isReservationInPast, isReservationStartTimePast, isReservationEndTimePast } from '@/utils/reservationUtils';
import { useStatusConfig } from '@/contexts/StatusConfigContext';

// Debug flag for console logging (Phase 4)
const DEBUG = typeof window !== 'undefined' && (window as any).__DEBUG_TIMELINE_CLICKS__;

interface ReservationBlockProps {
  reservation: Reservation;
  layout: {
    COLUMN_WIDTH: number;
    ROW_HEIGHT: number;
  };
  timeSlots: Array<{ hour: number; minute: number; time: string; label: string; isMainHour: boolean }>;
  openingHour: number;
  closingHour: number;
  onDragStart: (reservation: Reservation, e: React.DragEvent, tableNumber?: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onClick: (reservation: Reservation, e?: React.MouseEvent) => void;
  draggedReservation: Reservation | null;
  isFirstTable?: boolean;
  tableSpanCount?: number;
  currentTableNumber?: number;
  tables?: Table[];
  tableGroups?: TableGroupWithTables[];
  onTouchStart?: (reservation: Reservation, e: React.TouchEvent, tableNumber?: number) => void;
  onEnhancedMouseStart?: (reservation: Reservation, e: React.MouseEvent, tableNumber?: number) => void;
  touchDragState?: { 
    isDragging: boolean; 
    draggedReservation: Reservation | null;
    dragOffset: { x: number; y: number };
    currentPosition: { x: number; y: number };
    draggedElement: HTMLElement | null;
    dropZone: { tableId: string; timeSlot?: string; cursorTimeSlot?: string } | null;
    grabOffset: { x: number; y: number; timeSlots: number } | null;
  };
  enhancedMouseDragState?: { isDragging: boolean; draggedReservation: Reservation | null };
  segmentTables?: number[]; // Tables that are part of this visual segment
}

export const ReservationBlock: React.FC<ReservationBlockProps> = ({
  reservation,
  layout,
  timeSlots,
  openingHour,
  closingHour,
  onDragStart,
  onDragEnd,
  onClick,
  draggedReservation,
  isFirstTable = true,
  tableSpanCount = 1,
  currentTableNumber,
  tables = [],
  tableGroups = [],
  onTouchStart,
  onEnhancedMouseStart,
  touchDragState,
  enhancedMouseDragState,
  segmentTables
}) => {
  const { statusConfig } = useStatusConfig();
  const getReservationPosition = (reservation: Reservation) => {
    if (!reservation || !reservation.time) {
      console.log('Invalid reservation for positioning:', reservation);
      return { left: '0px', width: `${layout.COLUMN_WIDTH * 8}px` };
    }

    const reservationMinutes = timeToMinutes(reservation.time);
    
    // Find the closest time slot index
    let closestSlotIndex = 0;
    let minDifference = Infinity;
    
    timeSlots.forEach((slot, index) => {
      const slotMinutes = slot.hour * 60 + slot.minute;
      const difference = Math.abs(slotMinutes - reservationMinutes);
      if (difference < minDifference) {
        minDifference = difference;
        closestSlotIndex = index;
      }
    });
    
    // Calculate position based on slot index
    const leftPosition = closestSlotIndex * layout.COLUMN_WIDTH;
    
    // Calculate dynamic width based on end_time if present (for completed reservations)
    let reservationWidthInSlots = 8; // Default: 2 hours (8 slots of 15 minutes)
    
    if (reservation.end_time) {
      const endMinutes = timeToMinutes(reservation.end_time);
      const durationMinutes = endMinutes - reservationMinutes;
      // Convert duration to number of 15-minute slots
      reservationWidthInSlots = Math.ceil(durationMinutes / 15);
      // Minimum width: 2 slots (30 min) to prevent text cutoff
      reservationWidthInSlots = Math.max(2, reservationWidthInSlots);
    }
    
    const widthInPixels = reservationWidthInSlots * layout.COLUMN_WIDTH;
    
    console.log('=== RESERVATION POSITIONING DEBUG ===');
    console.log('Reservation:', reservation.customer_name, 'Time:', reservation.time);
    console.log('End time:', reservation.end_time);
    console.log('Reservation minutes:', reservationMinutes);
    console.log('Width in slots:', reservationWidthInSlots);
    console.log('Closest slot index:', closestSlotIndex);
    console.log('Left position:', leftPosition);
    console.log('Width:', widthInPixels);
    
    return {
      left: `${leftPosition}px`,
      width: `${widthInPixels}px`
    };
  };

  const formatTimeWithoutSeconds = (time: string) => {
    if (!time) return '';
    // Split time by colon and take only hours and minutes
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const calculateEndTime = (startTime: string) => {
    if (!startTime) return '';
    const parts = startTime.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const endHours = hours + 2;
      const endMinutes = minutes;
      
      // Format with leading zeros
      const formattedEndHours = endHours.toString().padStart(2, '0');
      const formattedEndMinutes = endMinutes.toString().padStart(2, '0');
      
      return `${formattedEndHours}:${formattedEndMinutes}`;
    }
    return startTime;
  };

  const getTableDisplay = () => {
    // Use segment tables if provided for display
    const tablesToDisplay = segmentTables && segmentTables.length > 0 ? segmentTables : reservation.table_numbers;
    const isMultiTable = tablesToDisplay && tablesToDisplay.length > 1;
    
    if (isMultiTable) {
      // For multi-table segments, format as a range if consecutive
      const sortedTables = [...tablesToDisplay].sort((a, b) => a - b);
      
      if (sortedTables.length > 2) {
        // Check if all tables in the segment are consecutive
        let consecutive = true;
        for (let i = 1; i < sortedTables.length; i++) {
          if (sortedTables[i] - sortedTables[i-1] !== 1) {
            consecutive = false;
            break;
          }
        }
        
        if (consecutive) {
          return `T${sortedTables[0]}-${sortedTables[sortedTables.length - 1]}`;
        }
      }
      
      // Check if tables form a valid table group combination
      const validation = isValidTableCombination(tablesToDisplay, tableGroups);
      
      if (validation.valid && validation.group) {
        // Valid table group - show group name with all table numbers
        return `${validation.group.group_name}: ${sortedTables.join(', ')}`;
      } else if (currentTableNumber && !segmentTables) {
        // Invalid combination - show current table with warning indicator (only if not using segments)
        const totalTables = tablesToDisplay.length;
        return `Table ${currentTableNumber} (${totalTables} tables)`;
      } else {
        // Show all table numbers
        return `T${sortedTables.join(',')}`;
      }
    }
    
    return `Table ${reservation.table_number}`;
  };

  // Helper function to check if tables form a valid table group assignment
  const isValidTableGroupAssignment = (tableNumbers: number[]) => {
    if (tableNumbers.length <= 1) return true;
    return isValidTableCombination(tableNumbers, tableGroups).valid;
  };

  // Calculate total seats for the reservation's tables
  const getTotalSeats = () => {
    if (!tables.length) return 0;
    
    let tableNumbers: number[] = [];
    if (reservation.table_numbers && reservation.table_numbers.length > 0) {
      tableNumbers = reservation.table_numbers;
    } else if (reservation.table_number) {
      tableNumbers = [reservation.table_number];
    }

    return tableNumbers.reduce((total, tableNum) => {
      const table = tables.find(t => t.table_number === tableNum);
      return total + (table?.seats || 0);
    }, 0);
  };

  // Check if party size exceeds available seats
  const exceedsCapacity = () => {
    const totalSeats = getTotalSeats();
    return totalSeats > 0 && reservation.party_size > totalSeats;
  };

  const handleDragStart = (e: React.DragEvent) => {

    if (reservation.locked) {
      e.preventDefault();
      return;
    }

    // For multi-table reservations, determine behavior based on table group validity
    const isMultiTable = reservation.table_numbers && reservation.table_numbers.length > 1;
    
    if (isMultiTable) {
      const isValidGroup = isValidTableGroupAssignment(reservation.table_numbers!);
      
      if (isValidGroup) {
        onDragStart(reservation, e);
      } else {
        onDragStart(reservation, e, currentTableNumber);
      }
    } else {
      onDragStart(reservation, e);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    console.log('=== RESERVATION BLOCK TOUCH START ===', {
      reservationName: reservation.customer_name,
      reservationId: reservation.id,
      isLocked: reservation.locked,
      hasOnTouchStart: !!onTouchStart,
      touchTarget: e.currentTarget
    });

    if (reservation.locked) {
      console.log('=== TOUCH BLOCKED - RESERVATION IS PERMANENTLY LOCKED ===');
      return;
    }

    if (!onTouchStart) {
      console.log('=== TOUCH BLOCKED - NO TOUCH HANDLER PROVIDED ===');
      return;
    }

    // For multi-table reservations, determine behavior based on table group validity
    const isMultiTable = reservation.table_numbers && reservation.table_numbers.length > 1;
    
    if (isMultiTable) {
      const isValidGroup = isValidTableGroupAssignment(reservation.table_numbers!);
      
      console.log('=== MULTI-TABLE TOUCH START ===', {
        isValidGroup,
        tableNumbers: reservation.table_numbers,
        currentTableNumber
      });
      
      if (isValidGroup) {
        // For valid table group reservations, move the entire block
        console.log('=== CALLING TOUCH START - VALID TABLE GROUP ===');
        onTouchStart(reservation, e);
      } else {
        // For invalid multi-table reservations, move only this specific table
        console.log('=== CALLING TOUCH START - INVALID MULTI-TABLE ===');
        onTouchStart(reservation, e, currentTableNumber);
      }
    } else {
      // Single table reservation
      console.log('=== CALLING TOUCH START - SINGLE TABLE ===');
      onTouchStart(reservation, e);
    }
  };

  const handleEnhancedMouseStart = (e: React.MouseEvent) => {
    if (reservation.locked || !onEnhancedMouseStart) {
      return;
    }

    console.log('=== RESERVATION BLOCK ENHANCED MOUSE START ===', {
      reservationName: reservation.customer_name,
      isMultiTable: reservation.table_numbers && reservation.table_numbers.length > 1,
      currentTableNumber
    });

    // For multi-table reservations, determine behavior based on table group validity
    const isMultiTable = reservation.table_numbers && reservation.table_numbers.length > 1;
    
    if (isMultiTable) {
      const isValidGroup = isValidTableGroupAssignment(reservation.table_numbers!);
      
      if (isValidGroup) {
        // For valid table group reservations, move the entire block
        onEnhancedMouseStart(reservation, e);
      } else {
        // For invalid multi-table reservations, move only this specific table
        onEnhancedMouseStart(reservation, e, currentTableNumber);
      }
    } else {
      // Single table reservation
      onEnhancedMouseStart(reservation, e);
    }
  };

  const position = getReservationPosition(reservation);
  const isDragging = draggedReservation?.id === reservation.id || 
                     touchDragState?.draggedReservation?.id === reservation.id ||
                     enhancedMouseDragState?.draggedReservation?.id === reservation.id;
  const isLocked = reservation.locked; // Only permanent locks prevent manual movements
  const isTemporarilyLocked = reservation.locked_until && new Date(reservation.locked_until) > new Date();
  
  // Optimistic state for visual feedback
  const optimisticState = (reservation as any)._optimisticState;
  const isUpdating = optimisticState === 'updating';
  const isConfirmed = optimisticState === 'confirmed';
  // Use segment tables if available, otherwise fall back to reservation table_numbers
  const effectiveTableNumbers = segmentTables && segmentTables.length > 0 ? segmentTables : reservation.table_numbers;
  const isMultiTable = effectiveTableNumbers && effectiveTableNumbers.length > 1;
  const isValidGroupMultiTable = isMultiTable && isValidTableGroupAssignment(effectiveTableNumbers);
  const isInvalidMultiTable = isMultiTable && !isValidGroupMultiTable;

  // Calculate height - for valid table group reservations or segments, span multiple rows
  const calculateHeight = () => {
    if (segmentTables && segmentTables.length > 1) {
      // Use segment table count for height calculation
      return `${(segmentTables.length * layout.ROW_HEIGHT) - 2}px`;
    } else if (isValidGroupMultiTable && tableSpanCount > 1) {
      // Original table group logic
      return `${(tableSpanCount * layout.ROW_HEIGHT) - 2}px`;
    }
    return `${layout.ROW_HEIGHT - 2}px`;
  };

  // Get block dimensions for calculations
  const blockWidthPx = parseInt(position.width);
  const blockHeight = calculateHeight();
  const blockHeightPx = parseInt(blockHeight);

  // Calculate optimal font size based on available space with guaranteed line fit and tablet optimization
  const calculateFontSize = () => {
    // Responsive font size based on viewport width
    const viewportWidth = window.innerWidth;
    
    // Tablet and mobile devices: 11px to prevent text overflow
    // Desktop devices: 12px for better readability
    if (viewportWidth < 1025) {
      return 11; // Tablets (768-1024px) and mobile (<768px)
    }
    
    return 12; // Desktop (1025px+)
  };

  // Better line height for readability
  const calculateLineHeight = () => {
    return 1.3; // Prevent ascender clipping
  };

  // Better padding for proper text display
  const calculatePadding = () => {
    const isSingleTable = !isMultiTable;
    const hasMultiRowSpacing = (segmentTables && segmentTables.length > 1) || (isValidGroupMultiTable && tableSpanCount > 1);
    let horizontalPadding, verticalPadding;
    
    if (isSingleTable) {
      // Single-table reservations get reduced vertical padding
      horizontalPadding = 5;
      verticalPadding = 4;
    } else if (isInvalidMultiTable) {
      horizontalPadding = 4;
      verticalPadding = 6;
    } else if (hasMultiRowSpacing) {
      horizontalPadding = 6;
      verticalPadding = 8;
    } else {
      horizontalPadding = 5;
      verticalPadding = 6;
    }
    
    return `${verticalPadding}px ${horizontalPadding}px`;
  };

  // Generate content based on single-table vs multi-table rules using shared utility
  const getTextContent = () => {
    const customerName = formatCustomerName(reservation.customer_name);
    const partySize = reservation.party_size;
    const isSingleTable = !isMultiTable;
    
    const lines = [];
    const lineData = [];
    
    // Use shared utility for text generation
    const availableTables = tables?.map(t => t.table_number) || [];
    const sharedTextContent = getReservationTextContent(reservation, availableTables, isMultiTable);
    
    if (isSingleTable) {
      // Single-table: exactly 1 line with name and guest count
      const guestCount = `${partySize} ${partySize === 1 ? 'guest' : 'guests'}`;
      const maxNameLength = blockWidthPx < 150 ? 20 : blockWidthPx < 200 ? 25 : 30;
      const truncatedName = customerName.length > maxNameLength ? customerName.substring(0, maxNameLength - 3) + '...' : customerName;
      
      lines.push('FLEX_LAYOUT');
      lineData.push({ 
        text: 'FLEX_LAYOUT', 
        isBold: true, 
        isFlexLayout: true,
        leftText: truncatedName,
        rightText: guestCount
      });
      
      return { lines, lineData };
    } else {
      // Multi-table: exactly 3 lines
      const guestCount = `${partySize} ${partySize === 1 ? 'guest' : 'guests'}`;
      const maxNameLength = blockWidthPx < 150 ? 20 : blockWidthPx < 200 ? 25 : 30;
      const truncatedName = customerName.length > maxNameLength ? customerName.substring(0, maxNameLength - 3) + '...' : customerName;
      
      // Line 1: Customer name and guest count
      lines.push('FLEX_LAYOUT');
      lineData.push({ 
        text: 'FLEX_LAYOUT', 
        isBold: true, 
        isFlexLayout: true,
        leftText: truncatedName,
        rightText: guestCount
      });
      
      // Line 2: Time range
      lines.push(sharedTextContent.timeText || '');
      lineData.push({ text: sharedTextContent.timeText || '', isBold: false });
      
      // Line 3: Table display
      let tableText;
      if (isInvalidMultiTable && currentTableNumber) {
        // Invalid multi-table: show only current table number
        tableText = `Table ${currentTableNumber}`;
      } else {
        // Use table text from utility or calculated display
        tableText = sharedTextContent.tableText || getTableDisplay();
      }
      
      lines.push(tableText);
      lineData.push({ text: tableText, isBold: false });
      
      return { lines, lineData };
    }
  };

  // Check if reservation needs accessibility
  const accessibilityNeeds = detectAccessibilityNeeds(reservation);
  const needsAccessible = accessibilityNeeds.needsAccessible;

  const textContent = getTextContent();
  const fontSize = calculateFontSize();
  const lineHeight = calculateLineHeight();
  const padding = calculatePadding();
  
  // Check if reservation start time has passed (for visual feedback)
  const isPastReservation = isReservationStartTimePast(reservation.date, reservation.time);
  
  // Determine if reservation needs status update (overdue confirmed reservation)
  const needsStatusUpdate = isPastReservation && reservation.status === 'confirmed';
  
  // Determine if seated reservation needs completion (overdue seated reservation)
  const needsCompletionUpdate = isReservationEndTimePast(reservation.date, reservation.time, reservation.end_time) && reservation.status === 'seated';
  
  // Get glow color from status config for pulsing effect
  const getGlowColor = (status: string) => {
    const config = statusConfig?.[status];
    if (!config?.color) {
      return 'ring-green-400/70 shadow-green-400/50';
    }
    
    // Extract color name from config (e.g., "bg-green-500" -> "green")
    const colorMatch = config.color.match(/(?:bg|border|text)-(\w+)-/);
    const colorName = colorMatch ? colorMatch[1] : 'green';
    
    return `ring-${colorName}-400/70 shadow-${colorName}-400/50`;
  };

  return (
    <div
      className={`absolute ${getStatusColor(reservation.status, statusConfig)} border rounded text-xs cursor-pointer transition-all duration-200 ease-out flex flex-col justify-center group ${
        isDragging ? 'opacity-70 scale-105 shadow-2xl z-50' : 'hover:scale-[1.02] hover:shadow-md z-20'
      } ${isLocked ? 'border border-amber-500 bg-amber-50' : ''} ${
        isUpdating ? 'ring-2 ring-primary/50 animate-pulse' : ''
      } ${isConfirmed ? 'ring-2 ring-green-500' : ''} ${
        needsStatusUpdate ? `animate-glow-pulse ring-2 ${getGlowColor('confirmed')}` : ''
      } ${
        needsCompletionUpdate ? `animate-glow-pulse ring-2 ${getGlowColor('seated')}` : ''
      } ${
        isValidGroupMultiTable ? 'border-l-4 border-blue-600' : !isMultiTable ? `border-l-4 ${getStatusLeftBorderColor(reservation.status, statusConfig)}` : ''
      } ${isLocked ? 'cursor-not-allowed' : 'cursor-grab'} ${reservation.status === 'completed' ? 'opacity-40' : ''}`}
      style={{
        left: position.left,
        width: position.width,
        minWidth: `${layout.COLUMN_WIDTH * 6}px`,
        top: isDragging ? '3px' : '2px',
        height: calculateHeight(),
        fontSize: `${fontSize}px`,
        padding: padding,
        lineHeight: lineHeight.toString(),
        transform: (touchDragState?.isDragging && touchDragState?.draggedReservation?.id === reservation.id && touchDragState?.currentPosition)
          ? `translate(${touchDragState.currentPosition.x - touchDragState.dragOffset.x - parseInt(position.left)}px, ${touchDragState.currentPosition.y - touchDragState.dragOffset.y - 50}px) scale(1.05)` 
          : isDragging ? 'translate(4px, 4px) scale(1.05)' : 'translateZ(0)',
        willChange: isDragging ? 'transform, opacity' : 'auto',
        zIndex: isDragging ? 50 : (isMultiTable ? 25 : 20),
        boxShadow: isDragging ? '0 12px 24px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
        touchAction: 'none',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'all 0.1s ease-out'
      }}
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={handleTouchStart}
      onMouseDown={handleEnhancedMouseStart}
      onClick={(e) => {
        // Check both drag states
        const isDragState = touchDragState?.isDragging || enhancedMouseDragState?.isDragging;
        
        if (DEBUG) {
          console.log('=== RESERVATION BLOCK CLICK ===', {
            reservationId: reservation.id,
            customerName: reservation.customer_name,
            touchDragging: touchDragState?.isDragging,
            mouseDragging: enhancedMouseDragState?.isDragging,
            isDragState,
            willAllow: !isDragState
          });
        }
        
        if (!isDragState) {
          e.stopPropagation();
          onClick(reservation, e);
        }
      }}
      data-reservation-id={reservation.id}
      data-touchable="true"
      onMouseEnter={(e) => {
        if (isInvalidMultiTable) {
          e.currentTarget.style.borderLeft = '2px solid #f97316';
        }
      }}
      onMouseLeave={(e) => {
        if (isInvalidMultiTable) {
          e.currentTarget.style.borderLeft = '';
        }
      }}
      title={`Click to edit: ${formatCustomerName(reservation.customer_name)} - ${formatTimeWithoutSeconds(reservation.time)} - ${calculateEndTime(reservation.time)} (2 hours) - ${getTableDisplay()} - ${reservation.status}${isLocked ? ' (Locked)' : ''}${isTemporarilyLocked ? ' (Optimizing)' : ''}${isMultiTable ? ' (Multi-table)' : ''}${reservation.has_allergens && reservation.allergens && reservation.allergens.length > 0 ? ` - ⚠️ Allergies: ${reservation.allergens.join(', ')}` : ''}`}
    >
      <div className="flex items-center gap-1 w-full h-full">
        {isLocked && <Lock className="h-2.5 w-2.5 flex-shrink-0 text-amber-600" />}
        <div className="flex-1 flex flex-col justify-center h-full min-h-0 overflow-visible">
          {textContent.lineData ? textContent.lineData.map((lineItem, index) => (
            <div 
              key={index} 
              className={`${lineItem.isBold ? 'font-semibold' : 'font-normal'} text-left`}
              style={{ 
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight.toString(),
                marginBottom: '0',
                paddingTop: index === 0 ? '0' : '0'
              }}
            >
              {lineItem.isFlexLayout ? (
                <div className="flex justify-between items-center w-full" style={{ 
                  paddingRight: `${(() => {
                    // Calculate additional padding needed for icons
                    let iconCount = 0;
                    const accessibility = detectAccessibilityNeeds(reservation);
                    if (accessibility.needsAccessible) iconCount++;
                    if (exceedsCapacity()) iconCount++;
                    if (reservation.has_allergens) iconCount++;
                    
                    // Each icon is 12px + 4px gap + 4px buffer
                    return iconCount > 0 ? iconCount * 16 + 4 : 0;
                  })()}px` 
                }}>
                  <span className="truncate flex-1 mr-1">{lineItem.leftText}</span>
                  <span className="flex-shrink-0">{lineItem.rightText}</span>
                </div>
              ) : (
                <span className="truncate">{lineItem.text}</span>
              )}
            </div>
          )) : textContent.lines.map((line, index) => (
            <div 
              key={index} 
              className={`${index === 0 ? 'font-medium' : 'font-normal'} text-left truncate`}
              style={{ 
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight.toString(),
                marginBottom: '0'
              }}
            >
              {line}
            </div>
          ))}
          {isValidGroupMultiTable && tableSpanCount > 2 && (
            <div className="opacity-60 text-xs mt-1" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>
              {tableSpanCount} tables
            </div>
          )}
        </div>
      </div>
      
      {/* Lock status indicator */}
      <ReservationLockIndicator reservation={reservation} />
      
      {/* Icons for warnings */}
      <div className="absolute bottom-1 right-1 flex items-center gap-1">
        {/* Accessibility icon */}
        {needsAccessible && (
          <div 
            title="Requires wheelchair accessible table"
          >
            <Accessibility className="h-3 w-3 text-blue-500" />
          </div>
        )}

        {/* Chair icon when party size exceeds table capacity */}
        {exceedsCapacity() && (
          <div 
            title={`Party size (${reservation.party_size}) exceeds table capacity (${getTotalSeats()} seats)`}
          >
            <Armchair className="h-3 w-3 text-red-500" />
          </div>
        )}
        
        {/* Allergen warning icon */}
        {reservation.has_allergens && (
          <div 
            title="Contains allergens - Check reservation details"
          >
            <TriangleAlert className="h-3 w-3 text-amber-500" />
          </div>
        )}
      </div>
    </div>
  );
};
