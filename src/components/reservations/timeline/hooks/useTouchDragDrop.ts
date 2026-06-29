import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { formatCustomerName } from '@/utils/nameUtils';
import { getStatusColor } from '../utils/timelineUtils';
import { createReservationDragElement } from '../utils/reservationDisplay';
import { hasTableConflict } from '../utils/conflictDetection';
import { detectAccessibilityNeeds } from '@/utils/accessibilityDetection';
import { useUpdateSequencer } from '@/hooks/useUpdateSequencer';
import { isValidTableCombination, evaluateAllGroupsForTable } from '@/utils/tableGroupUtils';
import { UniversalTableOptimizationService } from '@/services/universalTableOptimizationService';
import { getDayOfWeekFromDate, isWithinFoodServiceHours } from '@/utils/foodServiceValidation';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';

// Debug flag for console logging (Phase 4)
const DEBUG = typeof window !== 'undefined' && (window as any).__DEBUG_TIMELINE_CLICKS__;


interface TableForTouchDragDrop {
  table_number: number;
  accessibility_friendly?: boolean;
  seats: number;
  is_active?: boolean;
  service_status?: string;
}

interface TouchDragState {
  isDragging: boolean;
  draggedReservation: Reservation | null;
  dragOffset: { x: number; y: number };
  currentPosition: { x: number; y: number };
  draggedElement: HTMLElement | null;
  dropZone: { tableId: string; timeSlot?: string; cursorTimeSlot?: string } | null;
  grabOffset: { x: number; y: number; timeSlots: number } | null;
}

interface LayoutConfig {
  TABLE_COLUMN_WIDTH: number;
  SEATS_COLUMN_WIDTH: number;
  COLUMN_WIDTH: number;
  timelineWidth: number;
  ROW_HEIGHT: number;
  totalWidth: number;
}

// Enhanced table configuration with accessibility validation
const getTargetTableConfiguration = (
  currentReservation: { table_numbers?: number[] | null; table_number?: number | null },
  targetTableNumber: number,
  tables: TableForTouchDragDrop[],
  reservation?: Reservation,
  tableGroups?: any[]
): { tables: number[]; error?: string } => {
  const availableTableNumbers = tables.map(t => t.table_number);
  const sortedTables = availableTableNumbers.sort((a, b) => a - b);
  
  // Check accessibility requirements first
  if (reservation) {
    const accessibilityNeeds = detectAccessibilityNeeds(reservation);
    if (accessibilityNeeds.needsAccessible) {
      const targetTable = tables.find(t => t.table_number === targetTableNumber);
      if (targetTable && !targetTable.accessibility_friendly) {
        // Find nearest accessible table with adequate capacity
        const accessibleTables = tables.filter(t => 
          t.accessibility_friendly && 
          t.seats >= (reservation.party_size || 1)
        ).sort((a, b) => Math.abs(a.table_number - targetTableNumber) - Math.abs(b.table_number - targetTableNumber));
        
        if (accessibleTables.length > 0) {
          return { tables: [accessibleTables[0].table_number] };
        } else {
          return { 
            tables: [], 
            error: 'This reservation requires an accessible table, but none are available with sufficient capacity.' 
          };
        }
      }
    }
    
    // Check capacity for target table
    const targetTable = tables.find(t => t.table_number === targetTableNumber);
    if (targetTable && targetTable.seats < (reservation.party_size || 1)) {
      // Find table with adequate capacity, preferring accessible if needed
      const suitableTables = tables.filter(t => 
        t.seats >= (reservation.party_size || 1) &&
        (!accessibilityNeeds.needsAccessible || t.accessibility_friendly)
      ).sort((a, b) => Math.abs(a.table_number - targetTableNumber) - Math.abs(b.table_number - targetTableNumber));
      
      if (suitableTables.length > 0) {
        return { tables: [suitableTables[0].table_number] };
      } else {
        return { 
          tables: [], 
          error: `No tables available with sufficient capacity for ${reservation.party_size} guests${accessibilityNeeds.needsAccessible ? ' that are also accessible' : ''}.` 
        };
      }
    }
  }
  
  // If it's currently a single table, keep it single
  if (!currentReservation.table_numbers || currentReservation.table_numbers.length <= 1) {
    return { tables: [targetTableNumber] };
  }
  
  const currentSpan = currentReservation.table_numbers.length;
  const targetIndex = sortedTables.indexOf(targetTableNumber);
  
  let targetTables: number[] = [];
  if (targetIndex >= 0 && targetIndex + currentSpan <= sortedTables.length) {
    targetTables = sortedTables.slice(targetIndex, targetIndex + currentSpan);
  } else {
    // Fallback to single table
    targetTables = [targetTableNumber];
  }
  
  // Validate table combination for contiguity within groups (if more than one table)
  if (tableGroups && targetTables.length > 1) {
    const validation = isValidTableCombination(targetTables, tableGroups);
    if (!validation.valid) {
      return { 
        tables: [], 
        error: validation.reason 
      };
    }
  }
  
  return { tables: targetTables };
};

export const useTouchDragDrop = (
  onReservationUpdate: (reservationId?: string, oldTableNumbers?: number[] | null, newTableNumbers?: number[]) => void,
  tables: TableForTouchDragDrop[] = [],
  existingReservations: Reservation[] = [],
  layout?: LayoutConfig,
  selectedDate?: string,
  triggerOptimization?: () => void,
  tableGroups?: any[],
  statusConfig?: Record<string, { label: string; color: string }>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const { queueUpdate } = useUpdateSequencer();
  const { location } = useCompanyLocation();
  
  // Phase 3: Instant click prevention ref for touch events
  const shouldPreventClickRef = useRef(false);
  
  const [touchDragState, setTouchDragState] = useState<TouchDragState>({
    isDragging: false,
    draggedReservation: null,
    dragOffset: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    draggedElement: null,
    dropZone: null,
    grabOffset: null
  });

  // State for time change confirmation
  const [pendingDrop, setPendingDrop] = useState<{
    reservation: Reservation;
    updateData: any;
    originalTime: string;
    newTime: string;
    dropZone: any;
    targetTableConfig: any;
    isSameRowShift: boolean;
  } | null>(null);

  // Refs for immediate access to drag data without state delays
  const isActivelyDragging = useRef(false);
  const draggedReservationRef = useRef<Reservation | null>(null);
  const grabOffsetRef = useRef<{ x: number; y: number; timeSlots: number } | null>(null);
  const dragElementRef = useRef<HTMLElement | null>(null);
  const originalElementRef = useRef<HTMLElement | null>(null);
  const timelineBounds = useRef<DOMRect | null>(null);
  const postLockTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);
  const dropInProgressRef = useRef(false);

  const hasTableConflictWrapper = useCallback((targetTables: number[], requestedTime: string): boolean => {
    return hasTableConflict(
      targetTables, 
      requestedTime, 
      existingReservations, 
      draggedReservationRef.current?.id
    );
  }, [existingReservations]);

  const availableTableNumbers = useMemo(() => tables.map(t => t.table_number), [tables]);

  // Helper: force reload selected date cache via direct fetch (post-lock fallback)
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
      console.log('🔄 TOUCH Post-lock force reload complete for date', selectedDate);
    } catch (e) {
      console.error('TOUCH Post-lock force reload error:', e);
    }
  }, [companyId, selectedDate, queryClient]);

  // Schedule post-lock optimization when temporary lock expires
  const schedulePostLockOptimization = useCallback((reservationId: string, lockedUntil: string) => {
    // Clear any existing timer for this reservation
    const existingTimer = postLockTimers.current.get(reservationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const lockExpireTime = new Date(lockedUntil).getTime();
    const now = Date.now();
    const timeUntilExpiry = lockExpireTime - now;

    if (timeUntilExpiry > 0) {
      const timer = setTimeout(() => {
        console.log('=== TOUCH POST-LOCK OPTIMIZATION TRIGGERED ===', {
          reservationId,
          lockExpiredAt: new Date().toISOString()
        });
        
        // Trigger immediate optimization if function provided
        if (triggerOptimization) {
          triggerOptimization();
        }
        
        // Fallback UI refresh in case optimizer returns 0 moves (async background)
        setTimeout(() => {
          console.log('=== TOUCH POST-LOCK FALLBACK REFRESH ===', { reservationId, ts: new Date().toISOString() });
          onReservationUpdate();
          // Force cache to reflect DB state even if optimizer returns 0 moves
          forceDateReload();
        }, 2000);
        
        // Clean up timer reference
        postLockTimers.current.delete(reservationId);
      }, timeUntilExpiry);

      postLockTimers.current.set(reservationId, timer);
      
      console.log('=== TOUCH POST-LOCK TIMER SCHEDULED ===', {
        reservationId,
        lockedUntil,
        timeUntilExpiryMs: timeUntilExpiry
      });
    }
  }, [triggerOptimization]);

  const createDragElement = useCallback((reservation: Reservation, originalElement: HTMLElement) => {
    const statusClasses = getStatusColor(reservation.status, statusConfig);
    const tablesForDisplay = tables.map(t => ({ number: t.table_number, seats: t.seats }));
    return createReservationDragElement(reservation, originalElement, statusClasses, availableTableNumbers, tablesForDisplay);
  }, [availableTableNumbers, tables, statusConfig]);

  const calculateDropZone = useCallback((clientX: number, clientY: number) => {
    if (tables.length === 0) return null;

    // Use native DOM element detection - no manual calculations needed!
    // This matches exactly how desktop drag-and-drop works
    const elementUnderTouch = document.elementFromPoint(clientX, clientY);
    
    if (!elementUnderTouch) {
      console.log('=== NO ELEMENT UNDER TOUCH ===', { clientX, clientY });
      return null;
    }
    
    // Walk up the DOM tree to find the time slot element
    const timeSlotElement = elementUnderTouch.closest('[data-time-slot]') as HTMLElement;
    const tableRowElement = elementUnderTouch.closest('[data-table-id]') as HTMLElement;
    
    if (!tableRowElement) {
      console.log('=== NO TABLE ROW FOUND ===');
      return null;
    }
    
    const tableId = tableRowElement.getAttribute('data-table-id');
    if (!tableId) return null;
    
    // If we're over a time slot, get its time
    let timeSlot: string | undefined;
    let cursorTimeSlot: string | undefined;
    
    if (timeSlotElement) {
      const rawTimeSlot = timeSlotElement.getAttribute('data-time-slot');
      if (rawTimeSlot) {
        cursorTimeSlot = rawTimeSlot;
        
        // Apply grab offset to calculate intended drop time (matching mouse logic)
        if (grabOffsetRef.current && grabOffsetRef.current.timeSlots > 0) {
          const timeToMinutes = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
          };
          
          const minutesToTime = (totalMinutes: number) => {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
          };
          
          const cursorMinutes = timeToMinutes(rawTimeSlot);
          const offsetMinutes = grabOffsetRef.current.timeSlots * 15;
          const intendedMinutes = cursorMinutes - offsetMinutes;
          
          if (intendedMinutes >= 540) { // Don't go before 9:00 AM
            timeSlot = minutesToTime(intendedMinutes);
          } else {
            timeSlot = rawTimeSlot;
          }
          
          console.log('=== NATIVE DOM DETECTION WITH GRAB OFFSET ===', {
            cursorTimeSlot: rawTimeSlot,
            grabOffsetSlots: grabOffsetRef.current.timeSlots,
            intendedTimeSlot: timeSlot,
            tableId
          });
        } else {
          timeSlot = rawTimeSlot;
        }
      }
    }
    
    console.log('=== NATIVE DOM DROP ZONE ===', {
      tableId,
      timeSlot,
      cursorTimeSlot,
      elementType: elementUnderTouch.tagName,
      hasTimeSlot: !!timeSlotElement
    });
    
    return { tableId, timeSlot, cursorTimeSlot };
  }, [tables.length]);

  const updateDropZoneHighlight = useCallback((dropZone: typeof touchDragState.dropZone) => {
    // Remove existing highlights
    document.querySelectorAll('.drop-zone-highlight').forEach(el => el.remove());
    document.querySelectorAll('.green-line-indicator').forEach(el => el.remove());
    
    // Disable visual indicators - drop where you hover
    return;

    // Use the actual drop position (timeSlot) for perfect alignment
    const visualTimeSlot = dropZone.timeSlot || dropZone.cursorTimeSlot;
    if (!visualTimeSlot) return;

    // CRITICAL FIX: Use dragged element's actual visual position for horizontal green line
    const draggedElement = document.querySelector('.reservation-drag-element') as HTMLElement;
    if (!draggedElement) return;
    
    const draggedElementRect = draggedElement.getBoundingClientRect();
    const timelineElement = document.querySelector('[data-timeline-grid]') as HTMLElement;
    if (!timelineElement) return;
    
    const timelineRect = timelineElement.getBoundingClientRect();
    const HEADER_HEIGHT = 45;
    
    // Calculate which table row the dragged element is visually over
    const draggedElementY = draggedElementRect.top + (draggedElementRect.height / 2);
    const relativeY = draggedElementY - timelineRect.top;
    const visualRowIndex = Math.floor((relativeY - HEADER_HEIGHT) / layout.ROW_HEIGHT);
    
    const tableElements = document.querySelectorAll('[data-table-id]');
    if (visualRowIndex < 0 || visualRowIndex >= tableElements.length) return;
    
    const visualTableElement = tableElements[visualRowIndex] as HTMLElement;
    if (!visualTableElement) return;

    const tableElement = document.querySelector(`[data-table-id="${dropZone.tableId}"]`);
    if (!tableElement) return;

    const tableNumberMatch = dropZone.tableId.match(/-(\d+)$/);
    if (!tableNumberMatch) return;

    const targetTableNumber = parseInt(tableNumberMatch[1]);
    let targetTables = [targetTableNumber];

    // Handle multi-table reservations and accessibility validation
    let tableConfigError: string | undefined;
    if (draggedReservationRef.current) {
      const tableConfig = getTargetTableConfiguration(
        {
          table_numbers: draggedReservationRef.current.table_numbers,
          table_number: draggedReservationRef.current.table_number
        },
        targetTableNumber,
        tables,
        draggedReservationRef.current,
        tableGroups
      );
      targetTables = tableConfig.tables;
      tableConfigError = tableConfig.error;
    }
    
    const isConflict = dropZone.timeSlot ? hasTableConflictWrapper(targetTables, dropZone.timeSlot) : false;
    const hasError = tableConfigError || targetTables.length === 0;

    // FIXED: Use visual table element position so green line follows the dragged slot
    const highlight = document.createElement('div');
    const visualTableRect = visualTableElement.getBoundingClientRect();
    
    highlight.className = 'drop-zone-highlight';
    highlight.style.cssText = `
      position: fixed;
      left: ${visualTableRect.left}px;
      top: ${visualTableRect.top}px;
      width: ${visualTableRect.width}px;
      height: ${visualTableRect.height}px;
      pointer-events: none;
      z-index: 5;
      border: 2px solid ${hasError ? 'rgba(239, 68, 68, 0.8)' : isConflict ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'};
      background: ${hasError ? 'rgba(239, 68, 68, 0.1)' : isConflict ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'};
      border-radius: 4px;
      will-change: transform;
      transform: translateZ(0);
    `;
    
    console.log('=== TOUCH: GREEN LINE FOLLOWS SLOT ===', {
      draggedElementY,
      visualRowIndex,
      visualTableId: visualTableElement.getAttribute('data-table-id'),
      actualDropTableId: dropZone.tableId,
      followsSlot: true,
      hasError,
      errorReason: tableConfigError
    });
    
    document.body.appendChild(highlight);
    
    // Add error message overlay if validation failed
    if (hasError && tableConfigError) {
      const errorOverlay = document.createElement('div');
      errorOverlay.className = 'drop-zone-error-message';
      errorOverlay.textContent = tableConfigError;
      errorOverlay.style.cssText = `
        position: fixed;
        left: ${visualTableRect.left + 10}px;
        top: ${visualTableRect.top + 10}px;
        background: rgba(239, 68, 68, 0.95);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        z-index: 9999;
        pointer-events: none;
        max-width: 300px;
      `;
      document.body.appendChild(errorOverlay);
    }

    // Add green vertical line indicator for precise time slot targeting (exactly like mouse)
    // Check if we have a valid time slot to display
    if (visualTimeSlot) {
      // CRITICAL: Recalculate timeline bounds for accurate positioning
      const timelineElement = document.querySelector('[data-timeline-grid]') as HTMLElement;
      if (timelineElement) {
        const timelineRect = timelineElement.getBoundingClientRect();
        
        // Find the time slot elements to calculate position (same logic as mouse)
        const timeSlotElements = tableElement.querySelectorAll('[data-time-slot]');
        let targetSlotElement: HTMLElement | null = null;
        
        for (let i = 0; i < timeSlotElements.length; i++) {
          const slotElement = timeSlotElements[i] as HTMLElement;
          const slotTime = slotElement.getAttribute('data-time-slot');
          // Use actual drop position (timeSlot) for perfect alignment
          if (slotTime === visualTimeSlot) {
            targetSlotElement = slotElement;
            break;
          }
        }
        
        if (targetSlotElement) {
          const HEADER_HEIGHT = 45;
          const slotRect = targetSlotElement.getBoundingClientRect();
          
          // Position the green line at the START edge of the slot (where reservation actually lands)
          const greenLine = document.createElement('div');
          greenLine.className = 'green-line-indicator';
          greenLine.style.cssText = `
            position: absolute;
            left: ${slotRect.left - timelineRect.left}px;
            top: ${HEADER_HEIGHT}px;
            width: 2px;
            height: ${timelineElement.clientHeight - HEADER_HEIGHT}px;
            background: ${isConflict ? '#ef4444' : '#22c55e'};
            pointer-events: none;
            z-index: 30;
            box-shadow: 0 0 4px ${isConflict ? '#ef4444' : '#22c55e'};
            will-change: transform, opacity;
            transform: translateZ(0);
          `;
          
          // Append to timeline grid for consistent coordinate system
          timelineElement.appendChild(greenLine);
          
          console.log('=== TOUCH: GREEN LINE ALIGNED TO DROP POSITION ===', {
            visualTimeSlot,
            actualDropSlot: dropZone.timeSlot,
            cursorTimeSlot: dropZone.cursorTimeSlot,
            usingTimeSlot: dropZone.timeSlot ? 'YES - using actual drop position' : 'NO - fallback to cursor',
            leftPosition: slotRect.left - timelineRect.left,
            slotTime: targetSlotElement.getAttribute('data-time-slot')
          });
        }
      }
    }
  }, [layout, hasTableConflictWrapper, tables]);

  const cleanup = useCallback(() => {
    // Cancel auto-scroll animation
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
    
    // Remove visual elements
    document.querySelectorAll('.drop-zone-highlight').forEach(el => el.remove());
    document.querySelectorAll('.green-line-indicator').forEach(el => el.remove());
    document.querySelectorAll('.drop-zone-error-message').forEach(el => el.remove());
    
    // Remove drag element
    if (dragElementRef.current) {
      if (dragElementRef.current.parentNode) {
        dragElementRef.current.parentNode.removeChild(dragElementRef.current);
      }
      dragElementRef.current = null;
    }
    
    // Restore original element using ref for precision
    if (originalElementRef.current) {
      originalElementRef.current.style.opacity = '';
      originalElementRef.current.style.pointerEvents = '';
      originalElementRef.current = null;
    }
    
    // Reset drag state
    setTouchDragState({
      isDragging: false,
      draggedReservation: null,
      dragOffset: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 },
      draggedElement: null,
      dropZone: null,
      grabOffset: null
    });
    
    // Clear refs
    isActivelyDragging.current = false;
    draggedReservationRef.current = null;
    grabOffsetRef.current = null;
  }, []);

  const performDrop = useCallback(async (dropZone: typeof touchDragState.dropZone, reservation: Reservation) => {
    if (!dropZone || !dropZone.timeSlot) {
      console.log('=== DROP CANCELLED - MISSING DATA ===');
      return;
    }

    console.log('=== STARTING TOUCH DROP ===', {
      reservationId: reservation.id,
      from: { 
        time: reservation.time,
        tables: reservation.table_numbers || [reservation.table_number]
      },
      to: {
        time: dropZone.timeSlot,
        tableId: dropZone.tableId
      }
    });

    // Get target table number
    const tableMatch = dropZone.tableId.match(/-(\d+)$/);
    if (!tableMatch) {
      console.error('=== INVALID TABLE ID ===', dropZone.tableId);
      return;
    }
    
    const targetTableNumber = parseInt(tableMatch[1]);

    // Get current tables from reservation
    const currentTables = reservation.table_numbers && reservation.table_numbers.length > 0
      ? reservation.table_numbers
      : reservation.table_number ? [reservation.table_number] : [];

    // Check if this is a time-only move (dropped on one of the current tables)
    const isSameRowShift = currentTables.includes(targetTableNumber);

    console.log('=== TOUCH DROP ANALYSIS ===', {
      reservationId: reservation.id,
      currentTables,
      targetTableNumber,
      isSameRowShift,
      targetTimeSlot: dropZone.timeSlot
    });

    let targetTableConfig: { tables: number[]; error?: string };

    if (isSameRowShift && currentTables.length > 0) {
      // TIME-ONLY MOVE: Preserve exact same tables
      console.log('=== TOUCH TIME-ONLY MOVE - PRESERVING TABLES ===', {
        preservedTables: currentTables,
        newTime: dropZone.timeSlot
      });

      // Check if current tables are available at new time
      if (dropZone.timeSlot) {
        const formattedTime = dropZone.timeSlot.includes(':') && dropZone.timeSlot.split(':').length === 2 
          ? `${dropZone.timeSlot}:00` 
          : dropZone.timeSlot;

        const hasConflict = hasTableConflict(
          currentTables,
          formattedTime,
          existingReservations,
          reservation.id
        );
        
        if (hasConflict) {
          console.log('=== TOUCH TIME-ONLY MOVE BLOCKED: CONFLICT ===', {
            tables: currentTables,
            requestedTime: formattedTime
          });
          
          toast({
            title: "Time not available",
            description: `Tables ${currentTables.join(', ')} are not available at ${dropZone.timeSlot}. Reservation stays at original time.`,
            variant: "destructive"
          });
          return;
        }
      }

      // Preserve current table configuration
      targetTableConfig = { tables: currentTables };
    } else {
      // ROW BOUNDARY CROSSED: Use universal optimization with multi-group support
      console.log('=== TOUCH ROW BOUNDARY CROSSED - FINDING OPTIMAL ASSIGNMENT ===', {
        anchorTable: targetTableNumber,
        partySize: reservation.party_size
      });

      // Format time with seconds for the API
      const formattedTime = dropZone.timeSlot.includes(':') && dropZone.timeSlot.split(':').length === 2 
        ? `${dropZone.timeSlot}:00` 
        : dropZone.timeSlot;

      // Try universal optimization service first
      const optimizationResult = await UniversalTableOptimizationService.findOptimalAssignment(
        companyId,
        reservation.party_size,
        selectedDate,
        formattedTime,
        reservation.id,
        reservation,
        false, // manual user action
        reservation.notes,
        targetTableNumber // preferred anchor table
      );

      if (optimizationResult.success && optimizationResult.tables.includes(targetTableNumber)) {
        // Service found optimal assignment that includes dropped-on table
        targetTableConfig = { tables: optimizationResult.tables };
        console.log('✅ OPTIMIZATION SERVICE SUCCESS (includes anchor)', {
          tables: optimizationResult.tables,
          strategy: optimizationResult.strategy
        });
      } else {
        // Handle multi-group scenario manually
        console.log('⚠️ CHECKING MULTI-GROUP OPTIONS');
        
        const evaluations = evaluateAllGroupsForTable(
          targetTableNumber,
          reservation.party_size,
          tableGroups,
          tables.map(t => ({ table_number: t.table_number, seats: t.seats }))
        );

        if (evaluations.length > 0) {
          const bestOption = evaluations[0];
          targetTableConfig = { tables: bestOption.assignment.tables };
          
          console.log('✅ MULTI-GROUP ASSIGNMENT SELECTED', {
            group: bestOption.group.group_name,
            tables: bestOption.assignment.tables,
            score: bestOption.score,
            strategy: bestOption.strategy
          });
          
          toast({
            title: "Multi-Group Assignment",
            description: `Using "${bestOption.group.group_name}" (${bestOption.strategy}, ${bestOption.assignment.capacity} seats)`,
          });
        } else {
          // Fallback to single table
          targetTableConfig = { tables: [targetTableNumber] };
          console.log('⚠️ FALLBACK TO SINGLE TABLE');
        }
      }

      if (targetTableConfig.error || targetTableConfig.tables.length === 0) {
        toast({
          title: "Invalid Table Assignment",
          description: targetTableConfig.error || "No suitable table configuration found",
          variant: "destructive"
        });
        return;
      }
    }

    console.log('=== TOUCH DROP ALLOWED ===', {
      reservationId: reservation.id,
      targetTables: targetTableConfig.tables,
      timeSlot: dropZone.timeSlot,
      isSameRowShift
    });

    const updateData: any = {
      _updateSource: 'drag', // Mark as drag-initiated update
      anchor_table: targetTableNumber // Store the table user dropped on
    };
    
    // Set table data
    if (targetTableConfig.tables.length > 1) {
      updateData.table_numbers = targetTableConfig.tables;
      updateData.table_number = null;
    } else {
      updateData.table_number = targetTableConfig.tables[0];
      updateData.table_numbers = null;
    }
    
    // Calculate original duration to preserve visual width
    let originalDurationMinutes = 120; // Default 2 hours
    if (reservation.time && reservation.end_time) {
      const [startHours, startMinutes] = reservation.time.split(':').map(Number);
      const [endHours, endMinutes] = reservation.end_time.split(':').map(Number);
      originalDurationMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    }
    
    // Check if time has changed - normalize both times to HH:MM format for accurate comparison
    const normalizedReservationTime = reservation.time.substring(0, 5); // "14:00:00" → "14:00"
    const normalizedDropZoneTime = dropZone.timeSlot?.substring(0, 5); // "14:00" → "14:00"
    const hasTimeChange = normalizedDropZoneTime && normalizedDropZoneTime !== normalizedReservationTime;
    
    // Only show confirmation for drag-initiated changes, not modal edits
    if (hasTimeChange && reservation._updateSource !== 'modal') {
      const formattedTime = dropZone.timeSlot.includes(':') && dropZone.timeSlot.split(':').length === 2 
        ? `${dropZone.timeSlot}:00` 
        : dropZone.timeSlot;
      
      // Store pending drop for confirmation
      setPendingDrop({
        reservation,
        updateData: { ...updateData, time: formattedTime },
        originalTime: reservation.time,
        newTime: formattedTime,
        dropZone,
        targetTableConfig,
        isSameRowShift
      });
      
      console.log('⏸️ TOUCH: Time change detected - waiting for user confirmation');
      return;
    }

    // Add temporary lock (consistent with mouse drag)
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + 10 * 1000).toISOString();
    updateData.locked_until = lockedUntil;
    updateData.last_manual_move_time = now.toISOString();

    // Global hold: pause all optimizations until lock expires
    try {
      (window as any).__OPTIMIZATION_HOLD_UNTIL = new Date(lockedUntil).getTime();
      localStorage.setItem('optimization_hold_until', lockedUntil);
      console.log('🔒 DROP_LOCK (Touch): Optimization hold until', lockedUntil);
    } catch {}

    console.log('=== TOUCH UPDATE DATA ===', updateData);

    if (Object.keys(updateData).length > 1) { // More than just locked_until
        // Validate food service hours if time changed
        if (updateData.time && selectedDate && location?.hours) {
          const timeToCheck = updateData.time.substring(0, 5); // Extract HH:MM
          const dayOfWeek = getDayOfWeekFromDate(selectedDate);
          const foodServiceCheck = isWithinFoodServiceHours(
            timeToCheck,
            dayOfWeek,
            location.hours
          );
          
          if (!foodServiceCheck.isWithin) {
            toast({
              title: "Cannot move reservation",
              description: foodServiceCheck.reason || "Kitchen is closed at this time",
              variant: "destructive"
            });
            return;
          }
        }
        
        // Use correct cache key format that matches useUltraFastReservationsQuery
        const reservationsCacheKey = ['reservations-date', companyId, selectedDate];
        console.log('=== TOUCH OPTIMISTIC UPDATE CACHE KEY ===', reservationsCacheKey);
        
        queryClient.setQueryData(
          reservationsCacheKey,
          (oldData: any) => {
            if (!oldData) return oldData;
            
            // Handle both flat array and nested object structure
            const reservations = Array.isArray(oldData) ? oldData : oldData.reservations || [];
            
            const updatedReservations = reservations.map((r: Reservation) => {
              if (r.id === reservation.id) {
                return {
                  ...r,
                  ...updateData,
                  updated_at: new Date().toISOString()
                };
              }
              return r;
            });
            
            // Maintain sorting by time then table number
            const sortedReservations = updatedReservations.sort((a: Reservation, b: Reservation) => {
              if (a.time !== b.time) return a.time.localeCompare(b.time);
              const aTable = a.table_numbers?.[0] || a.table_number || 0;
              const bTable = b.table_numbers?.[0] || b.table_number || 0;
              return aTable - bTable;
            });
            
            // Return in same structure as input
            return Array.isArray(oldData) ? sortedReservations : {
              ...oldData,
              reservations: sortedReservations
            };
          }
        );
      
      // Apply group-wide locks if this is a multi-table assignment
      const isGroupAssignment = targetTableConfig.tables.length > 1;
      const lockPromises: Promise<any>[] = [];
      
      if (isGroupAssignment) {
        console.log('🔒 APPLYING GROUP-WIDE LOCK (Touch)', {
          anchorTable: targetTableNumber,
          allTables: targetTableConfig.tables,
          lockDuration: '10 seconds'
        });

        // Apply lock to other reservations on these tables
        for (const tableNum of targetTableConfig.tables) {
          if (tableNum !== targetTableNumber) {
            const otherReservations = existingReservations.filter(r =>
              r.id !== reservation.id &&
              r.date === selectedDate &&
              (r.table_number === tableNum || r.table_numbers?.includes(tableNum))
            );

            for (const res of otherReservations) {
              lockPromises.push(
                (async () => {
                  await supabase
                    .from('reservations')
                    .update({
                      locked_until: updateData.locked_until,
                      last_manual_move_time: updateData.last_manual_move_time
                    })
                    .eq('id', res.id);
                })()
              );
            }
          }
        }
      }

      // Queue database update with sequencer
      queueUpdate(`reservation:${reservation.id}`, async () => {
        try {
          // Remove client-side fields before database write
          const { _updateSource, ...cleanUpdateData } = updateData;
          
          const { error } = await supabase
            .from('reservations')
            .update(cleanUpdateData)
            .eq('id', reservation.id);

          if (error) throw error;

          // Apply group-wide locks
          if (lockPromises.length > 0) {
            await Promise.all(lockPromises);
            console.log('🔒 GROUP-WIDE LOCKS APPLIED (Touch)', { count: lockPromises.length });
          }

          console.log('=== TOUCH UPDATE SUCCESS ===', {
            reservationId: reservation.id,
            customerName: reservation.customer_name,
            newTime: dropZone.timeSlot,
            anchorTable: targetTableNumber,
            assignedTables: targetTableConfig.tables,
            isGroupAssignment,
            updateData
          });

          // Schedule post-lock optimization
          schedulePostLockOptimization(reservation.id, updateData.locked_until);

          const assignedDisplay = isGroupAssignment
            ? `tables ${targetTableConfig.tables.join(', ')}`
            : `table ${targetTableConfig.tables[0]}`;
          
          const baseTitle = `${reservation.customer_name} moved to ${assignedDisplay}`;
          
          const description = isSameRowShift
            ? `Time changed to ${dropZone.timeSlot}. Same tables preserved for 10 seconds.`
            : isGroupAssignment
              ? "Group assignment from your drop point. All tables locked for 10 seconds."
              : "Move completed successfully";
          
          toast({
            title: "Table moved successfully",
            duration: 2000
          });

          // Trigger callback for any additional updates (no feedback modal)
          onReservationUpdate();
        } catch (error: any) {
          console.error('=== TOUCH UPDATE ERROR ===', error);
          
          // Rollback optimistic update on error
          if (companyId && selectedDate) {
            const dateCacheKey = ['reservations-date', companyId, selectedDate];
            const currentCache = queryClient.getQueryData<any>(dateCacheKey);
            
            if (currentCache) {
              // Handle both flat array and nested object structure
              const reservations = Array.isArray(currentCache) ? currentCache : currentCache.reservations || [];
              const rolledBackReservations = reservations.map((r: Reservation) =>
                r.id === reservation.id ? reservation : r
              );
              
              // Restore in same structure as cached
              const restoredData = Array.isArray(currentCache) ? rolledBackReservations : {
                ...currentCache,
                reservations: rolledBackReservations
              };
              
              queryClient.setQueryData(dateCacheKey, restoredData);
              console.log('=== TOUCH ROLLBACK APPLIED ===', { reservationId: reservation.id });
            }
          }
          
          toast({
            title: "Table move unsuccessful",
            variant: "destructive",
            duration: 2000
          });
        }
      });
    }
  }, [toast, tables, hasTableConflict, existingReservations, onReservationUpdate, companyId, selectedDate, queryClient, queueUpdate, schedulePostLockOptimization]);

  // Touch event handlers - INSTANT response (Phase 3)
  const handleTouchStart = useCallback((reservation: Reservation, e: React.TouchEvent, tableNumber?: number) => {
    if (DEBUG) {
      console.log('=== TOUCH START ===', {
        reservationId: reservation.id,
        customer: reservation.customer_name,
        isLocked: reservation.locked,
        timestamp: new Date().toISOString()
      });
    }

    // Reset click prevention immediately
    shouldPreventClickRef.current = false;

    // Block if drop is in progress or already dragging
    if (dropInProgressRef.current || isActivelyDragging.current) {
      if (DEBUG) {
        console.log('=== TOUCH BLOCKED ===', {
          reason: dropInProgressRef.current ? 'drop_in_progress' : 'already_dragging',
        });
      }
      return;
    }

    const isLocked = reservation.locked;
    if (isLocked) {
      if (DEBUG) {
        console.log('=== TOUCH BLOCKED ===', {
          reason: 'permanently_locked',
        });
      }
      return;
    }

    // Log temporary lock but DO NOT BLOCK manual moves
    if (reservation.locked_until) {
      const lockedUntil = new Date(reservation.locked_until);
      const now = new Date();
      
      if (now < lockedUntil && DEBUG) {
        const remainingSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
        console.log('=== MANUAL OVERRIDE: Moving temporarily locked reservation ===', {
          remainingSeconds,
          reservationId: reservation.id
        });
      }
    }

    const touch = e.touches[0];
    const element = e.currentTarget as HTMLElement;
    const startPosition = { x: touch.clientX, y: touch.clientY };
    let dragInitiated = false;
    
    const initiateDrag = () => {
      if (dragInitiated) return;
      dragInitiated = true;
      shouldPreventClickRef.current = true; // Prevent click immediately when drag starts
      
      if (DEBUG) {
        console.log('=== DRAG INITIATED (movement detected) ===', { customer: reservation.customer_name });
      }
      
      // Find timeline element
      const timelineElement = document.querySelector('[data-timeline-grid]') as HTMLElement;
      if (!timelineElement) return;

      // Calculate grab offset
      const elementRect = element.getBoundingClientRect();
      const grabOffsetX = startPosition.x - elementRect.left;
      const grabOffsetY = startPosition.y - elementRect.top;
      const grabOffsetSlots = layout ? Math.floor(grabOffsetX / layout.COLUMN_WIDTH) : 0;
      
      // Store in refs
      draggedReservationRef.current = reservation;
      originalElementRef.current = element;
      grabOffsetRef.current = { 
        x: grabOffsetX, 
        y: grabOffsetY, 
        timeSlots: grabOffsetSlots
      };

      // Create drag element
      dragElementRef.current = createDragElement(reservation, element);
      
      // Hide original
      element.style.opacity = '0.3';
      element.style.pointerEvents = 'none';
      
      // Set initial position
      dragElementRef.current.style.left = `${startPosition.x - grabOffsetX}px`;
      dragElementRef.current.style.top = `${startPosition.y - grabOffsetY}px`;
      
      isActivelyDragging.current = true;
      
      // Update state
      setTouchDragState({
        isDragging: true,
        draggedReservation: reservation,
        dragOffset: { x: grabOffsetX, y: grabOffsetY },
        currentPosition: startPosition,
        draggedElement: dragElementRef.current,
        dropZone: null,
        grabOffset: grabOffsetRef.current
      });
    };
    
    const handleTouchMoveForDrag = (moveEvent: TouchEvent) => {
      if (dragInitiated) {
        moveEvent.preventDefault();
        return;
      }
      
      // Check if moved significantly - if so, initiate drag immediately and prevent click
      const moveTouch = moveEvent.touches[0];
      const distance = Math.sqrt(
        Math.pow(moveTouch.clientX - startPosition.x, 2) + 
        Math.pow(moveTouch.clientY - startPosition.y, 2)
      );
      
      // If moved more than 5px, this is a drag - initiate and prevent click
      if (distance > 5) {
        shouldPreventClickRef.current = true; // CRITICAL: Prevent click BEFORE initiating drag
        initiateDrag();
        moveEvent.preventDefault();
      }
    };
    
    const handleTouchEndForDrag = (endEvent: TouchEvent) => {
      // Cleanup listeners
      document.removeEventListener('touchmove', handleTouchMoveForDrag);
      document.removeEventListener('touchend', handleTouchEndForDrag);
      
      // If drag was initiated, handleTouchEnd will handle it
      if (dragInitiated) {
        return;
      }
      
      // This was a tap - click event will fire naturally
      if (DEBUG) {
        console.log('=== TAP DETECTED (no movement) ===', {
          customer: reservation.customer_name,
          allowClick: !shouldPreventClickRef.current
        });
      }
    };
    
    // Listen for movement immediately (no timer!)
    document.addEventListener('touchmove', handleTouchMoveForDrag, { passive: false });
    document.addEventListener('touchend', handleTouchEndForDrag, { passive: false });
  }, [createDragElement, layout, toast]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isActivelyDragging.current || !dragElementRef.current || !draggedReservationRef.current) return;
    
    const touch = e.touches[0];
    const grabOffset = grabOffsetRef.current;
    
    if (!grabOffset) return;
    
    // Find the scrollable container
    const scrollContainer = document.querySelector('[data-timeline-scroll-container]') as HTMLElement;
    
    // Calculate auto-scroll
    const viewportHeight = window.innerHeight;
    const touchY = touch.clientY;
    const edgeThreshold = 100; // pixels from edge to trigger scroll
    const maxScrollSpeed = 15; // pixels per frame
    
    let shouldScroll = false;
    let scrollSpeed = 0;
    
    // Check if near bottom edge (dragging down to reach lower tables)
    if (touchY > viewportHeight - edgeThreshold) {
      shouldScroll = true;
      const distanceFromEdge = viewportHeight - touchY;
      scrollSpeed = maxScrollSpeed * (1 - distanceFromEdge / edgeThreshold);
    }
    // Check if near top edge (dragging up)
    else if (touchY < edgeThreshold) {
      shouldScroll = true;
      const distanceFromEdge = touchY;
      scrollSpeed = -maxScrollSpeed * (1 - distanceFromEdge / edgeThreshold);
    }
    
    // Perform auto-scroll
    if (shouldScroll && scrollContainer) {
      scrollContainer.scrollBy({
        top: scrollSpeed,
        behavior: 'auto' // Use 'auto' for immediate response during drag
      });
      // Allow scroll, don't prevent default
    } else {
      // Only prevent default when not auto-scrolling
      e.preventDefault();
    }
    
    // Update drag element position
    dragElementRef.current.style.left = `${touch.clientX - grabOffset.x}px`;
    dragElementRef.current.style.top = `${touch.clientY - grabOffset.y}px`;
    
    // Calculate drop zone
    const dropZone = calculateDropZone(touch.clientX, touch.clientY);
    
    // Update visual feedback
    updateDropZoneHighlight(dropZone);
    
    // Update state
    setTouchDragState(prev => ({
      ...prev,
      currentPosition: { x: touch.clientX, y: touch.clientY },
      dropZone
    }));
  }, [calculateDropZone, updateDropZoneHighlight]);

  const handleTouchEnd = useCallback(async (e: TouchEvent) => {
    // Only handle if drag was actually initiated
    if (!isActivelyDragging.current || !draggedReservationRef.current) {
      return;
    }

    e.preventDefault();

    const touch = e.changedTouches[0];
    const dropZone = calculateDropZone(touch.clientX, touch.clientY);
    
    console.log('=== TOUCH DROP ===', {
      dropZone,
      customer: draggedReservationRef.current?.customer_name
    });

    const reservationToMove = draggedReservationRef.current;
    
    // Clear drag state immediately to allow next interaction
    cleanup();

    if (dropZone && dropZone.timeSlot && reservationToMove) {
      // Set drop in progress flag to prevent new drags during database update
      dropInProgressRef.current = true;
      
      try {
        await performDrop(dropZone, reservationToMove);
      } finally {
        // Clear flag after drop completes (success or error)
        // Use setTimeout to ensure React has processed state updates
        setTimeout(() => {
          dropInProgressRef.current = false;
        }, 0);
      }
    }
  }, [calculateDropZone, performDrop, cleanup]);

  // Event handler refs for immediate access
  const handleTouchMoveRef = useRef(handleTouchMove);
  const handleTouchEndRef = useRef(handleTouchEnd);
  
  // Update refs when handlers change
  useEffect(() => {
    handleTouchMoveRef.current = handleTouchMove;
    handleTouchEndRef.current = handleTouchEnd;
  }, [handleTouchMove, handleTouchEnd]);

  // Global event listeners - always available for immediate response
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isActivelyDragging.current) {
        handleTouchMoveRef.current(e);
      }
    };
    
    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (isActivelyDragging.current) {
        handleTouchEndRef.current(e);
      }
    };
    
    // Add listeners immediately on mount
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      
      // Clear all post-lock optimization timers
      postLockTimers.current.forEach((timer) => {
        clearTimeout(timer);
      });
      postLockTimers.current.clear();
    };
  }, []); // Empty deps - listeners persist for component lifetime

  // Confirmation handlers for time change dialog
  const confirmTimeChange = useCallback(async () => {
    if (!pendingDrop) return;
    
    const { reservation, updateData, dropZone, targetTableConfig, isSameRowShift } = pendingDrop;
    setPendingDrop(null);
    
    console.log('✅ TOUCH: User confirmed time change - executing full update with new time');
    
    // Complete the updateData with missing fields
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + 10 * 1000).toISOString();

    // Calculate end_time to preserve reservation duration
    let originalDurationMinutes = 120; // Default 2 hours
    if (reservation.time && reservation.end_time) {
      const [startHours, startMinutes] = reservation.time.split(':').map(Number);
      const [endHours, endMinutes] = reservation.end_time.split(':').map(Number);
      originalDurationMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    }

    const [newHours, newMinutes] = updateData.time.split(':').map(Number);
    const endMinutes = newHours * 60 + newMinutes + originalDurationMinutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;

    // Add missing fields to updateData
    const completeUpdateData = {
      ...updateData,
      end_time: calculatedEndTime,
      locked_until: lockedUntil,
      last_manual_move_time: now.toISOString()
    };

    // Set global optimization hold
    try {
      (window as any).__OPTIMIZATION_HOLD_UNTIL = new Date(lockedUntil).getTime();
      localStorage.setItem('optimization_hold_until', lockedUntil);
      console.log('🔒 CONFIRM_TIME_LOCK (Touch): Optimization hold until', lockedUntil);
    } catch {}
    
    // Validate food service hours
    if (completeUpdateData.time && selectedDate && location?.hours) {
      const timeToCheck = completeUpdateData.time.substring(0, 5);
      const dayOfWeek = getDayOfWeekFromDate(selectedDate);
      const foodServiceCheck = isWithinFoodServiceHours(timeToCheck, dayOfWeek, location.hours);
      
      if (!foodServiceCheck.isWithin) {
        toast({
          title: "Cannot move reservation",
          description: foodServiceCheck.reason || "Kitchen is closed at this time",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Use correct cache key format
    const reservationsCacheKey = ['reservations-date', companyId, selectedDate];
    
    // Optimistic update
    queryClient.setQueryData(reservationsCacheKey, (oldData: any) => {
      if (!oldData) return oldData;
      const reservations = Array.isArray(oldData) ? oldData : oldData.reservations || [];
      const updatedReservations = reservations.map((r: Reservation) =>
        r.id === reservation.id ? { ...r, ...completeUpdateData } : r
      );
      return Array.isArray(oldData) ? updatedReservations : { ...oldData, reservations: updatedReservations };
    });
    
    const isGroupAssignment = targetTableConfig.tables.length > 1;
    const lockPromises: Promise<void>[] = [];
    
    // Apply group-wide locks if needed
    if (isGroupAssignment && companyId && selectedDate) {
      const allReservations = queryClient.getQueryData<any>(reservationsCacheKey);
      const reservations = Array.isArray(allReservations) ? allReservations : allReservations?.reservations || [];
      
      for (const tableNum of targetTableConfig.tables) {
        const otherReservations = reservations.filter((r: Reservation) =>
          r.id !== reservation.id && (r.table_number === tableNum || r.table_numbers?.includes(tableNum))
        );
        
        for (const res of otherReservations) {
          lockPromises.push(
            (async () => {
              await supabase.from('reservations')
                .update({ locked_until: completeUpdateData.locked_until, last_manual_move_time: completeUpdateData.last_manual_move_time })
                .eq('id', res.id);
            })()
          );
        }
      }
    }
    
    // Database update
    queueUpdate(`reservation:${reservation.id}`, async () => {
      try {
        const { _updateSource, ...cleanUpdateData } = completeUpdateData;
        const { offlineAwareUpdate } = await import('@/utils/offlineAwareSupabase');
        const { error } = await offlineAwareUpdate('reservations', reservation.id, cleanUpdateData);
        if (error) throw error;
        
        await Promise.all(lockPromises);
        schedulePostLockOptimization(reservation.id, completeUpdateData.locked_until);
        
        toast({
          title: "Reservation moved",
          description: `Moved to table ${targetTableConfig.tables[0]} at ${completeUpdateData.time.substring(0, 5)}`
        });
        onReservationUpdate();
      } catch (error: any) {
        console.error('Update error:', error);
        queryClient.invalidateQueries({ queryKey: reservationsCacheKey });
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
      }
    });
  }, [pendingDrop, toast, companyId, selectedDate, location, queryClient, queueUpdate, schedulePostLockOptimization, onReservationUpdate]);

  const cancelTimeChange = useCallback(async () => {
    if (!pendingDrop) return;
    
    const { reservation, updateData, originalTime, dropZone, targetTableConfig } = pendingDrop;
    setPendingDrop(null);
    
    console.log('🔄 TOUCH: User declined time change - updating table only (keeping original time)');
    
    // Remove time from update, keep original time
    const { time, ...tableOnlyUpdate } = updateData;
    const finalUpdateData = { ...tableOnlyUpdate, time: originalTime };
    
    const reservationsCacheKey = ['reservations-date', companyId, selectedDate];
    
    // Optimistic update
    queryClient.setQueryData(reservationsCacheKey, (oldData: any) => {
      if (!oldData) return oldData;
      const reservations = Array.isArray(oldData) ? oldData : oldData.reservations || [];
      const updatedReservations = reservations.map((r: Reservation) =>
        r.id === reservation.id ? { ...r, ...finalUpdateData } : r
      );
      return Array.isArray(oldData) ? updatedReservations : { ...oldData, reservations: updatedReservations };
    });
    
    const isGroupAssignment = targetTableConfig.tables.length > 1;
    const lockPromises: Promise<void>[] = [];
    
    if (isGroupAssignment && companyId && selectedDate) {
      const allReservations = queryClient.getQueryData<any>(reservationsCacheKey);
      const reservations = Array.isArray(allReservations) ? allReservations : allReservations?.reservations || [];
      
      for (const tableNum of targetTableConfig.tables) {
        const otherReservations = reservations.filter((r: Reservation) =>
          r.id !== reservation.id && (r.table_number === tableNum || r.table_numbers?.includes(tableNum))
        );
        
        for (const res of otherReservations) {
          lockPromises.push(
            (async () => {
              await supabase.from('reservations')
                .update({ locked_until: finalUpdateData.locked_until, last_manual_move_time: finalUpdateData.last_manual_move_time })
                .eq('id', res.id);
            })()
          );
        }
      }
    }
    
    queueUpdate(`reservation:${reservation.id}`, async () => {
      try {
        const { _updateSource, ...cleanUpdateData } = finalUpdateData;
        const { offlineAwareUpdate } = await import('@/utils/offlineAwareSupabase');
        const { error } = await offlineAwareUpdate('reservations', reservation.id, cleanUpdateData);
        if (error) throw error;
        
        await Promise.all(lockPromises);
        schedulePostLockOptimization(reservation.id, finalUpdateData.locked_until);
        
        toast({
          title: "Table changed",
          description: `Moved to table ${targetTableConfig.tables[0]} (time unchanged)`
        });
        onReservationUpdate();
      } catch (error: any) {
        console.error('Update error:', error);
        queryClient.invalidateQueries({ queryKey: reservationsCacheKey });
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
      }
    });
  }, [pendingDrop, toast, companyId, selectedDate, queryClient, queueUpdate, schedulePostLockOptimization, onReservationUpdate]);

  return {
    touchDragState,
    handleTouchStart,
    hasTableConflict: hasTableConflictWrapper,
    shouldPreventTouchClick: () => shouldPreventClickRef.current, // Export for click handler (Phase 3)
    pendingDrop,
    confirmTimeChange,
    cancelTimeChange
  };
};
