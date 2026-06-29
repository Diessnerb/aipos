import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { getStatusColor } from '../utils/timelineUtils';
import { createReservationDragElement } from '../utils/reservationDisplay';
import { useDragTracker } from './useDragTracker';
import { hasTableConflict } from '../utils/conflictDetection';
import { detectAccessibilityNeeds } from '@/utils/accessibilityDetection';
import { useUpdateSequencer } from '@/hooks/useUpdateSequencer';
import { CapacityLogicService } from '@/services/capacityLogicService';
import { findTableGroupsContaining, findOptimalPartialGroupAssignment, isValidTableCombination } from '@/utils/tableGroupUtils';
import { useTableGroups } from '@/hooks/useTableGroups';
import { getDayOfWeekFromDate, isWithinFoodServiceHours } from '@/utils/foodServiceValidation';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';


interface TableForDragDrop {
  table_number: number;
  accessibility_friendly?: boolean;
  seats: number;
  is_active?: boolean;
  service_status?: string;
}

interface MouseDragState {
  isDragging: boolean;
  draggedReservation: Reservation | null;
  dragOffset: { x: number; y: number };
  draggedElement: HTMLElement | null;
  grabOffset: { x: number; y: number; timeSlots: number } | null;
}

interface CachedTableElement {
  element: HTMLElement;
  bounds: DOMRect;
  tableId: string;
}

// Enhanced table configuration with table group validation
const determineIntentionalTableConfiguration = (
  currentReservation: { table_numbers?: number[] | null; table_number?: number | null },
  intendedStartTable: number,
  tables: Array<{ table_number: number; accessibility_friendly?: boolean; seats: number }>,
  reservation?: Reservation,
  tableGroups?: any[]
): { tables: number[]; reason: string } => {
  console.log('=== DETERMINING INTENTIONAL TABLE CONFIGURATION ===', {
    currentReservation: {
      table_numbers: currentReservation.table_numbers,
      table_number: currentReservation.table_number
    },
    intendedStartTable,
    availableTablesCount: tables.length,
    tableGroupsAvailable: tableGroups?.length || 0
  });

  const availableTableNumbers = tables.map(t => t.table_number);
  const partySize = reservation?.party_size || 1;
  
  // Get current tables
  const currentTables = currentReservation.table_numbers && currentReservation.table_numbers.length > 0
    ? currentReservation.table_numbers
    : currentReservation.table_number ? [currentReservation.table_number] : [];

  // Check if this is a time-only move (dropped on one of current tables)
  const isSameRowShift = currentTables.includes(intendedStartTable);
  
  if (isSameRowShift && currentTables.length > 0) {
    // TIME-ONLY MOVE: Preserve current tables for visual feedback
    console.log('=== VISUAL: TIME-ONLY MOVE - PRESERVING TABLES ===', {
      preservedTables: currentTables
    });
    return {
      tables: currentTables,
      reason: `Preserving current tables ${currentTables.join(', ')} while shifting time`
    };
  }
  
  // Check accessibility requirements first
  if (reservation) {
    const accessibilityNeeds = detectAccessibilityNeeds(reservation);
    if (accessibilityNeeds.needsAccessible) {
      // For accessibility, first check if intended table is in a group that can accommodate
      if (tableGroups && tableGroups.length > 0) {
        const containingGroups = findTableGroupsContaining(intendedStartTable, tableGroups);
        const accessibleGroups = containingGroups.filter(group => 
          CapacityLogicService.canAccommodateFullGroup(partySize, group) &&
          group.table_numbers.some((tableNum: number) => {
            const table = tables.find(t => t.table_number === tableNum);
            return table?.accessibility_friendly;
          })
        );
        
        if (accessibleGroups.length > 0) {
          const bestGroup = accessibleGroups[0];
          return {
            tables: bestGroup.table_numbers,
            reason: `Using accessible table group "${bestGroup.group_name}" (${bestGroup.max_combined_capacity} seats)`
          };
        }
      }
      
      // Fallback to individual accessible table
      const intendedTable = tables.find(t => t.table_number === intendedStartTable);
      if (intendedTable && !intendedTable.accessibility_friendly) {
        const accessibleTables = tables.filter(t => 
          t.accessibility_friendly && 
          t.seats >= partySize
        ).sort((a, b) => Math.abs(a.table_number - intendedStartTable) - Math.abs(b.table_number - intendedStartTable));
        
        if (accessibleTables.length > 0) {
          return {
            tables: [accessibleTables[0].table_number],
            reason: `Redirected to accessible Table ${accessibleTables[0].table_number} (nearest suitable for accessibility needs)`
          };
        } else {
          return {
            tables: [],
            reason: 'No accessible tables available'
          };
        }
      }
    }
    
    // PRIORITY FOR MANUAL DROPS: Check if intended table has sufficient capacity FIRST
  const intendedTable = tables.find(t => t.table_number === intendedStartTable);
  
  // Check single table capacity
  if (intendedTable) {
    if (intendedTable.seats >= partySize) {
      return {
        tables: [intendedStartTable],
        reason: `Manual exact drop on table ${intendedStartTable} (${intendedTable.seats} seats available)`
      };
    }
    
    // Single table insufficient - must find group with capacity
    // Continue to group validation below
  } else {
    // Table not found - reject silently
    return { tables: [], reason: 'Table not found' };
  }
    
    // If single table insufficient, attempt table groups with mustIncludeTarget
    if (tableGroups && tableGroups.length > 0) {
      const tablesWithCapacity = tables.map(t => ({ table_number: t.table_number, seats: t.seats }));
      const optimalAssignment = findOptimalPartialGroupAssignment(
        intendedStartTable, 
        partySize, 
        tableGroups, 
        tablesWithCapacity,
        true // mustIncludeTarget - ensures dropped table is included
      );
      
      if (optimalAssignment.tables.length > 0 && optimalAssignment.actualCapacity >= partySize) {
        // Validate the optimal assignment for contiguity
        if (optimalAssignment.tables.length > 1) {
          const validation = isValidTableCombination(optimalAssignment.tables, tableGroups);
          if (!validation.valid) {
            return {
              tables: [],
              reason: validation.reason
            };
          }
        }
        
        return {
          tables: optimalAssignment.tables,
          reason: optimalAssignment.reason
        };
      }
      
      // If optimal assignment fails, check for capacity issues
      const containingGroups = findTableGroupsContaining(intendedStartTable, tableGroups);
      if (containingGroups.length > 0) {
        return {
          tables: [],
          reason: 'Table group insufficient capacity'
        };
      }
    }
  }

  const isCurrentlyMultiTable = currentReservation.table_numbers && currentReservation.table_numbers.length > 1;

  if (isCurrentlyMultiTable) {
    // For multi-table reservations, use smart partial assignment
    if (tableGroups && tableGroups.length > 0) {
      const tablesWithCapacity = tables.map(t => ({ table_number: t.table_number, seats: t.seats }));
      const optimalAssignment = findOptimalPartialGroupAssignment(
        intendedStartTable, 
        partySize, 
        tableGroups, 
        tablesWithCapacity
      );
      
      if (optimalAssignment.tables.length > 0 && optimalAssignment.actualCapacity >= partySize) {
        // Validate the optimal assignment for contiguity
        if (optimalAssignment.tables.length > 1) {
          const validation = isValidTableCombination(optimalAssignment.tables, tableGroups);
          if (!validation.valid) {
            return {
              tables: [],
              reason: validation.reason
            };
          }
        }
        
        return {
          tables: optimalAssignment.tables,
          reason: optimalAssignment.reason
        };
      }
    }

    // If no suitable group found and single table insufficient, reject silently
    return {
      tables: [],
      reason: 'Insufficient capacity (no suitable group found)'
    };
  }

  // Default single table scenario
  const finalTables = [intendedStartTable];
  
  // Validate table combination for contiguity within groups (if more than one table)
  // This is a fallback check - normally single table or validated groups reach here
  if (tableGroups && finalTables.length > 1) {
    const validation = isValidTableCombination(finalTables, tableGroups);
    if (!validation.valid) {
      return {
        tables: [],
        reason: validation.reason
      };
    }
  }
  
  return {
    tables: finalTables,
    reason: 'Single table configuration'
  };
};

interface LayoutConfig {
  TABLE_COLUMN_WIDTH: number;
  SEATS_COLUMN_WIDTH: number;
  COLUMN_WIDTH: number;
  timelineWidth: number;
  ROW_HEIGHT: number;
  totalWidth: number;
}

export const useEnhancedMouseDragDrop = (
  onReservationUpdate: () => void,
  tables: TableForDragDrop[] = [],
  existingReservations: Reservation[] = [],
  layout?: LayoutConfig,
  selectedDate?: string,
  triggerOptimization?: () => void,
  tableGroups?: any[],
  statusConfig?: Record<string, { label: string; color: string }>,
  isRecentModalEdit?: (reservationId: string) => boolean
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const dragTracker = useDragTracker();
  const { queueUpdate } = useUpdateSequencer();
  const { location } = useCompanyLocation();
  
  
  const [mouseDragState, setMouseDragState] = useState<MouseDragState>({
    isDragging: false,
    draggedReservation: null,
    dragOffset: { x: 0, y: 0 },
    draggedElement: null,
    grabOffset: null
  });

  // State for time change confirmation
  const [pendingDrop, setPendingDrop] = useState<{
    reservation: Reservation;
    updateData: any;
    originalTime: string;
    newTime: string;
    targetTableNumber: number;
    assignedTables: number[];
    isGroupAssignment: boolean;
    isSameRowShift: boolean;
  } | null>(null);

  // Performance optimization: Move frequently updated values to refs (eliminate re-renders)
  const currentPositionRef = useRef({ x: 0, y: 0 });
  const dropZoneRef = useRef<{ tableId: string; timeSlot?: string; cursorTimeSlot?: string; cursorSlotIndex?: number } | null>(null);
  const cachedTableElementsRef = useRef<CachedTableElement[]>([]);
  const rafRef = useRef<number | null>(null);
  const visualUpdateRafRef = useRef<number | null>(null);
  
  const timelineBounds = useRef<DOMRect | null>(null);
  const customDragElement = useRef<HTMLElement | null>(null);
  const ghostElement = useRef<HTMLElement | null>(null);
  const postLockTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);

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
      console.log('🔄 Post-lock force reload complete for date', selectedDate);
    } catch (e) {
      console.error('Post-lock force reload error:', e);
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
        console.log('=== POST-LOCK OPTIMIZATION TRIGGERED ===', {
          reservationId,
          lockExpiredAt: new Date().toISOString()
        });
        
        // Trigger immediate optimization if function provided
        if (triggerOptimization) {
          triggerOptimization();
        }
        
        // Fallback UI refresh in case optimizer returns 0 moves (async background)
        setTimeout(() => {
          console.log('=== POST-LOCK FALLBACK REFRESH ===', { reservationId, ts: new Date().toISOString() });
          onReservationUpdate();
          // Force cache to reflect DB state even if optimizer returns 0 moves
          forceDateReload();
        }, 2000);
        
        // Clean up timer reference
        postLockTimers.current.delete(reservationId);
      }, timeUntilExpiry);

      postLockTimers.current.set(reservationId, timer);
      
      console.log('=== POST-LOCK TIMER SCHEDULED ===', {
        reservationId,
        lockedUntil,
        timeUntilExpiryMs: timeUntilExpiry
      });
    }
  }, [triggerOptimization]);

  const hasTableConflictWrapper = useCallback((targetTables: number[], requestedTime: string): boolean => {
    return hasTableConflict(
      targetTables, 
      requestedTime, 
      existingReservations, 
      mouseDragState.draggedReservation?.id
    );
  }, [existingReservations, mouseDragState.draggedReservation?.id]);

  const createCustomDragElement = useCallback((reservation: Reservation, grabOffset: { x: number; timeSlots: number }, originalElement: HTMLElement) => {
    const statusClasses = getStatusColor(reservation.status, statusConfig);
    const tablesForDisplay = tables.map(t => ({ number: t.table_number, seats: t.seats }));
    return createReservationDragElement(reservation, originalElement, statusClasses, availableTableNumbers, tablesForDisplay);
  }, [availableTableNumbers, tables, statusConfig]);

  const createGhostElement = useCallback((originalElement: HTMLElement) => {
    const ghost = document.createElement('div');
    const rect = originalElement.getBoundingClientRect();
    
    ghost.className = originalElement.className;
    ghost.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      opacity: 0.3;
      border: 2px dashed rgba(59, 130, 246, 0.6);
      background: rgba(59, 130, 246, 0.1);
      pointer-events: none;
      z-index: 10;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(ghost);
    return ghost;
  }, []);

  const calculateDropZone = useCallback((clientX: number, clientY: number) => {
    if (!layout || tables.length === 0) return null;

    // OPTIMIZED: Use cached table elements instead of querying DOM every frame
    const cachedElements = cachedTableElementsRef.current;
    if (cachedElements.length === 0) return null;

    let targetTableElement: HTMLElement | null = null;
    let targetTableId: string | null = null;
    
    // Fast lookup using cached bounds
    for (const cached of cachedElements) {
      if (clientY >= cached.bounds.top && clientY < cached.bounds.bottom) {
        targetTableElement = cached.element;
        targetTableId = cached.tableId;
        break;
      }
    }
    if (!targetTableElement || !targetTableId) return null;

    // Determine the exact time slot under the cursor by DOM hit-test
    const timeSlotElements = Array.from(targetTableElement.querySelectorAll('[data-time-slot]')) as HTMLElement[];
    if (timeSlotElements.length === 0) return { tableId: targetTableId };

    let cursorSlotIndex = -1;
    let closestDistance = Infinity;
    for (let i = 0; i < timeSlotElements.length; i++) {
      const slot = timeSlotElements[i];
      const rect = slot.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) {
        cursorSlotIndex = i;
        break;
      }
      const centerX = rect.left + rect.width / 2;
      const d = Math.abs(clientX - centerX);
      if (d < closestDistance) {
        closestDistance = d;
        cursorSlotIndex = i;
      }
    }

    if (cursorSlotIndex < 0 || cursorSlotIndex >= timeSlotElements.length) return { tableId: targetTableId };

    const cursorTimeSlot = timeSlotElements[cursorSlotIndex].getAttribute('data-time-slot') || undefined;

    // "Exact drop" behavior: do NOT adjust by grab offset – use the slot under the cursor as the final time
    const intendedTimeSlot = cursorTimeSlot;

    return { tableId: targetTableId, timeSlot: intendedTimeSlot, cursorTimeSlot: intendedTimeSlot, cursorSlotIndex };
  }, [layout]);

  const updateDropZoneVisuals = useCallback((dropZone: typeof dropZoneRef.current) => {
    // Clear previous indicators
    document.querySelectorAll('.drop-zone-highlight').forEach(el => el.remove());
    document.querySelectorAll('.green-line-indicator').forEach(el => el.remove());
    document.querySelectorAll('.drop-zone-error-message').forEach(el => el.remove());

    if (!dropZone || !layout) return;

    const timelineElement = document.querySelector('[data-timeline-grid]') as HTMLElement | null;
    if (!timelineElement) return;

    // Use the exact DOM row selected for the drop
    const tableElement = document.querySelector(`[data-table-id="${dropZone.tableId}"]`) as HTMLElement | null;
    if (!tableElement) return;

    // Check if the current drag would result in an invalid configuration
    const tableNumberMatch = dropZone.tableId.match(/-(\d+)$/);
    let hasError = false;
    let errorMessage = '';
    
    if (tableNumberMatch && mouseDragState.draggedReservation) {
      const intendedStartTable = parseInt(tableNumberMatch[1]);
      const config = determineIntentionalTableConfiguration(
        {
          table_numbers: mouseDragState.draggedReservation.table_numbers,
          table_number: mouseDragState.draggedReservation.table_number
        },
        intendedStartTable,
        tables,
        mouseDragState.draggedReservation,
        tableGroups
      );
      
      if (config.tables.length === 0 && config.reason) {
        hasError = true;
        errorMessage = config.reason;
      }
    }

    // Highlight the exact row
    const tableRect = tableElement.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'drop-zone-highlight';
    highlight.style.cssText = `
      position: fixed;
      left: ${tableRect.left}px;
      top: ${tableRect.top}px;
      width: ${tableRect.width}px;
      height: ${tableRect.height}px;
      pointer-events: none;
      z-index: 5;
      border: 2px solid ${hasError ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'};
      background: ${hasError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'};
      border-radius: 4px;
    `;
    document.body.appendChild(highlight);
    
    // Add error message overlay if validation failed
    if (hasError && errorMessage) {
      const errorOverlay = document.createElement('div');
      errorOverlay.className = 'drop-zone-error-message';
      errorOverlay.textContent = errorMessage;
      errorOverlay.style.cssText = `
        position: fixed;
        left: ${tableRect.left + 10}px;
        top: ${tableRect.top + 10}px;
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

    // Vertical green line aligned to the START of the reservation (use grab offset)
    const slotEls = Array.from(tableElement.querySelectorAll('[data-time-slot]')) as HTMLElement[];

    let targetSlot: HTMLElement | null = null;

    // If we know where within the tile the user grabbed, shift the indicator left by that many slots
    if (typeof dropZone?.cursorSlotIndex === 'number' && typeof mouseDragState.grabOffset?.timeSlots === 'number') {
      const adjustedIndex = Math.max(
        0,
        Math.min(
          slotEls.length - 1,
          dropZone.cursorSlotIndex - mouseDragState.grabOffset.timeSlots
        )
      );
      targetSlot = slotEls[adjustedIndex] ?? null;
    } else {
      // Fallback: use the exact slot under the cursor
      const visualTimeSlot = dropZone?.timeSlot || dropZone?.cursorTimeSlot;
      if (visualTimeSlot) {
        targetSlot = slotEls.find(el => el.getAttribute('data-time-slot') === visualTimeSlot) || null;
      }
    }

    if (targetSlot) {
      const slotRect = targetSlot.getBoundingClientRect();
      const timelineRect = timelineElement.getBoundingClientRect();
      const firstRowEl = document.querySelector('[data-table-id]') as HTMLElement | null;
      const headerOffset = firstRowEl ? firstRowEl.getBoundingClientRect().top - timelineRect.top : 0;

      const greenLine = document.createElement('div');
      greenLine.className = 'green-line-indicator';
      greenLine.style.cssText = `
        position: absolute;
        left: ${slotRect.left - timelineRect.left}px;
        top: ${headerOffset}px;
        width: 2px;
        height: ${timelineElement.clientHeight - headerOffset}px;
        background: #22c55e;
        pointer-events: none;
        z-index: 30;
        box-shadow: 0 0 4px #22c55e;
      `;
      timelineElement.appendChild(greenLine);
    }
  }, [layout, mouseDragState.grabOffset]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!mouseDragState.isDragging || !mouseDragState.draggedElement || !layout) {
      return;
    }

    dragTracker.updateDragTracking(e.clientX, e.clientY);

    // Store position in ref for instant access (no re-render)
    currentPositionRef.current = { x: e.clientX, y: e.clientY };

    // Auto-scroll logic
    const scrollContainer = document.querySelector('[data-timeline-scroll-container]') as HTMLElement;
    const viewportHeight = window.innerHeight;
    const mouseY = e.clientY;
    const edgeThreshold = 100;
    const maxScrollSpeed = 15;
    
    let shouldScroll = false;
    let scrollSpeed = 0;
    
    if (mouseY > viewportHeight - edgeThreshold) {
      shouldScroll = true;
      const distanceFromEdge = viewportHeight - mouseY;
      scrollSpeed = maxScrollSpeed * (1 - distanceFromEdge / edgeThreshold);
    } else if (mouseY < edgeThreshold) {
      shouldScroll = true;
      const distanceFromEdge = mouseY;
      scrollSpeed = -maxScrollSpeed * (1 - distanceFromEdge / edgeThreshold);
    }
    
    if (shouldScroll && scrollContainer) {
      scrollContainer.scrollBy({
        top: scrollSpeed,
        behavior: 'auto'
      });
    }

    const dragElement = mouseDragState.draggedElement;
    const newX = e.clientX - mouseDragState.dragOffset.x;
    const newY = e.clientY - mouseDragState.dragOffset.y;
    
    // OPTIMIZED: Use GPU-accelerated transform instead of left/top (60fps smooth)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      dragElement.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      dragElement.style.willChange = 'transform';
    });

    // Calculate drop zone and store in ref (no re-render)
    const dropZone = calculateDropZone(e.clientX, e.clientY);
    dropZoneRef.current = dropZone;

    // OPTIMIZED: Debounce visual updates using requestAnimationFrame
    if (visualUpdateRafRef.current) {
      cancelAnimationFrame(visualUpdateRafRef.current);
    }
    
    visualUpdateRafRef.current = requestAnimationFrame(() => {
      updateDropZoneVisuals(dropZone);
    });
  }, [mouseDragState.isDragging, mouseDragState.draggedElement, mouseDragState.dragOffset, calculateDropZone, updateDropZoneVisuals, dragTracker, layout]);

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!mouseDragState.isDragging || !mouseDragState.draggedReservation) {
      return;
    }

    dragTracker.endDragTracking();

    // Get final drop zone from ref (not state)
    const dropZone = dropZoneRef.current;
    const draggedReservation = mouseDragState.draggedReservation;
    
    console.log('=== ENHANCED MOUSE UP - DROP PROCESSING ===', {
      draggedReservation: {
        id: draggedReservation.id,
        customerName: draggedReservation.customer_name,
        currentTableNumbers: draggedReservation.table_numbers,
        currentTableNumber: draggedReservation.table_number,
        time: draggedReservation.time
      },
      dropZone,
      grabOffset: mouseDragState.grabOffset
    });
    
    // Cancel any pending animation frames
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (visualUpdateRafRef.current) {
      cancelAnimationFrame(visualUpdateRafRef.current);
      visualUpdateRafRef.current = null;
    }
    
    if (customDragElement.current) {
      customDragElement.current.style.animation = 'none';
      customDragElement.current.style.transform = 'scale(0.8)';
      customDragElement.current.style.opacity = '0';
      setTimeout(() => {
        if (customDragElement.current && customDragElement.current.parentNode === document.body) {
          document.body.removeChild(customDragElement.current);
          customDragElement.current = null;
        }
      }, 200);
    }

    if (ghostElement.current) {
      ghostElement.current.style.opacity = '0';
      setTimeout(() => {
        if (ghostElement.current && ghostElement.current.parentNode === document.body) {
          document.body.removeChild(ghostElement.current);
          ghostElement.current = null;
        }
      }, 300);
    }

    // Clean up visual indicators
    document.querySelectorAll('.drop-zone-highlight').forEach(el => el.remove());
    document.querySelectorAll('.green-line-indicator').forEach(el => el.remove());

    const originalElements = document.querySelectorAll('[style*="opacity: 0.5"]');
    originalElements.forEach(el => {
      (el as HTMLElement).style.opacity = '';
    });

    // Cancel auto-scroll animation
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollSpeedRef.current = 0;

    // Reset refs
    currentPositionRef.current = { x: 0, y: 0 };
    dropZoneRef.current = null;
    
    setMouseDragState({
      isDragging: false,
      draggedReservation: null,
      dragOffset: { x: 0, y: 0 },
      draggedElement: null,
      grabOffset: null
    });

    if (!dropZone) {
      console.log('=== NO DROP ZONE - ABORTING ===');
      return;
    }

    const tableNumberMatch = dropZone.tableId.match(/-(\d+)$/);
    if (!tableNumberMatch) {
      console.log('=== INVALID TABLE ID - ABORTING ===', dropZone.tableId);
      return;
    }

    const intendedStartTable = parseInt(tableNumberMatch[1]);
    // Default: use the cursor slot captured in dropZone
    let targetTimeSlot = dropZone.timeSlot;

    // Adjust to reservation START by subtracting grabOffset slots from the cursor index
    const grabOffsetSlots = mouseDragState.grabOffset?.timeSlots ?? 0;
    if (
      typeof dropZone.cursorSlotIndex === 'number' &&
      typeof grabOffsetSlots === 'number'
    ) {
      const tableEl = document.querySelector(`[data-table-id="${dropZone.tableId}"]`) as HTMLElement | null;
      if (tableEl) {
        const slotEls = Array.from(tableEl.querySelectorAll('[data-time-slot]')) as HTMLElement[];
        const adjustedIndex = Math.max(
          0,
          Math.min(slotEls.length - 1, dropZone.cursorSlotIndex - grabOffsetSlots)
        );
        const adjustedEl = slotEls[adjustedIndex];
        const adjustedSlot = adjustedEl?.getAttribute('data-time-slot');
        if (adjustedSlot) targetTimeSlot = adjustedSlot;
      }
    }

    console.log('=== ENHANCED DROP TARGET DETAILS ===', {
      intendedStartTable,
      targetTimeSlot,
      dropZone
    });

    try {
      // FOR MANUAL DROPS: Place exactly where dropped, let optimization fix it 10s later
      // Check if table exists and is available (basic validation only)
      const targetTable = tables.find(t => t.table_number === intendedStartTable);
      
      if (!targetTable) {
        console.log('=== DROP REJECTED: Table not found ===', intendedStartTable);
        toast({
          title: "Invalid drop target",
          description: `Table ${intendedStartTable} not found`,
          variant: "destructive"
        });
        return;
      }

      // No conflict checks for manual drops – always allow exact placement; optimizer will resolve after lock expires
      // (Intentionally bypassing hasTableConflictWrapper here)

      // Get current tables from dragged reservation
      const currentTables = draggedReservation.table_numbers && draggedReservation.table_numbers.length > 0
        ? draggedReservation.table_numbers
        : draggedReservation.table_number ? [draggedReservation.table_number] : [];

      // Check if this is a time-only move (dropped on one of the current tables)
      const isSameRowShift = currentTables.includes(intendedStartTable);

      console.log('=== DROP ANALYSIS ===', {
        reservationId: draggedReservation.id,
        currentTables,
        intendedStartTable,
        isSameRowShift,
        targetTimeSlot
      });

      let assignedTables: number[] = [intendedStartTable];
      let isGroupAssignment = false;
      let groupName: string | undefined;

      if (isSameRowShift && currentTables.length > 0) {
        // TIME-ONLY MOVE: Preserve exact same tables
        console.log('=== TIME-ONLY MOVE DETECTED - PRESERVING TABLES ===', {
          preservedTables: currentTables,
          newTime: targetTimeSlot
        });

        // Check if current tables are available at new time
        if (targetTimeSlot) {
          const formattedTime = targetTimeSlot.includes(':') && targetTimeSlot.split(':').length === 2 
            ? `${targetTimeSlot}:00` 
            : targetTimeSlot;

          const hasConflict = hasTableConflictWrapper(currentTables, formattedTime);
          
          if (hasConflict) {
            console.log('=== TIME-ONLY MOVE BLOCKED: CONFLICT ===', {
              tables: currentTables,
              requestedTime: formattedTime
            });
            
            toast({
              title: "Time not available",
              description: `Tables ${currentTables.join(', ')} are not available at ${targetTimeSlot}. Reservation stays at original time.`,
              variant: "destructive"
            });
            return;
          }
        }

        // Preserve current table configuration
        assignedTables = currentTables;
        isGroupAssignment = currentTables.length > 1;
        
        if (isGroupAssignment && tableGroups && tableGroups.length > 0) {
          // Find which group these tables belong to for display purposes
          const matchingGroup = tableGroups.find(g => 
            g.tables && currentTables.every(t => g.tables.includes(t))
          );
          if (matchingGroup) {
            groupName = matchingGroup.name;
          }
        }
      } else {
        // ROW BOUNDARY CROSSED: Recalculate table assignment
        console.log('=== ROW BOUNDARY CROSSED - RECALCULATING TABLES ===', {
          anchorTable: intendedStartTable,
          partySize: draggedReservation.party_size
        });

        if (tableGroups && tableGroups.length > 0) {
          const groupAssignment = findOptimalPartialGroupAssignment(
            intendedStartTable,
            draggedReservation.party_size || 1,
            tableGroups,
            tables.map(t => ({ table_number: t.table_number, seats: t.seats })),
            true // Must include anchor table
          );

          if (groupAssignment.tables.length > 1) {
            // Validate the group assignment for contiguity
            const validation = isValidTableCombination(groupAssignment.tables, tableGroups);
            if (!validation.valid) {
              console.log('=== DROP REJECTED: Invalid table combination ===', {
                tables: groupAssignment.tables,
                reason: validation.reason
              });
              toast({
                title: "Invalid Table Assignment",
                description: validation.reason,
                variant: "destructive"
              });
              return;
            }
            
            assignedTables = groupAssignment.tables;
            isGroupAssignment = true;
            groupName = groupAssignment.groupName;
            console.log('=== GROUP ASSIGNMENT FROM ANCHOR ===', {
              anchorTable: intendedStartTable,
              assignedTables,
              groupName,
              reason: groupAssignment.reason
            });
          }
        }
      }

      const updateData: any = {
        _updateSource: 'drag', // Mark as drag-initiated update
        anchor_table: intendedStartTable, // Store the table user dropped on
      };

      // Set table assignments
      if (assignedTables.length > 1) {
        updateData.table_numbers = assignedTables;
        updateData.table_number = null;
      } else {
        updateData.table_number = assignedTables[0];
        updateData.table_numbers = null;
      }
      
      // Calculate original duration to preserve visual width
      let originalDurationMinutes = 120; // Default 2 hours
      if (draggedReservation.time && draggedReservation.end_time) {
        const [startHours, startMinutes] = draggedReservation.time.split(':').map(Number);
        const [endHours, endMinutes] = draggedReservation.end_time.split(':').map(Number);
        originalDurationMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
      }
      
      // Check if time has changed - normalize both times to HH:MM format for accurate comparison
      const normalizedReservationTime = draggedReservation.time.substring(0, 5); // "14:00:00" → "14:00"
      const normalizedTargetTime = targetTimeSlot?.substring(0, 5); // "14:00" → "14:00"
      
      // Only show confirmation for drag-initiated changes, not modal edits
      if (normalizedTargetTime && 
          normalizedTargetTime !== normalizedReservationTime && 
          draggedReservation._updateSource !== 'modal' &&
          !(isRecentModalEdit && isRecentModalEdit(draggedReservation.id))) {
        const formattedTime = targetTimeSlot.includes(':') && targetTimeSlot.split(':').length === 2 
          ? `${targetTimeSlot}:00` 
          : targetTimeSlot;
        
        // Store pending drop for confirmation
        setPendingDrop({
          reservation: draggedReservation,
          updateData: { ...updateData, time: formattedTime },
          originalTime: draggedReservation.time,
          newTime: formattedTime,
          targetTableNumber: intendedStartTable,
          assignedTables,
          isGroupAssignment,
          isSameRowShift
        });
        
        console.log('⏸️ MOUSE: Time change detected - waiting for user confirmation');
        return;
      }

      console.log('=== ENHANCED FINAL UPDATE DATA ===', updateData);

      if (Object.keys(updateData).length > 0) {
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
        
        // Add temporary lock to prevent optimization for 10 seconds after manual move
        const now = new Date();
        const lockedUntil = new Date(now.getTime() + 10 * 1000).toISOString();
        updateData.locked_until = lockedUntil;
        updateData.last_manual_move_time = now.toISOString();

        // Global hold: pause all optimizations until lock expires
        try {
          (window as any).__OPTIMIZATION_HOLD_UNTIL = new Date(lockedUntil).getTime();
          localStorage.setItem('optimization_hold_until', lockedUntil);
          console.log('🔒 DROP_LOCK: Optimization hold until', lockedUntil);
        } catch {}
        
        // PHASE 3: Apply instant optimistic update for all devices
        const reservationsCacheKey = ['reservations-date', companyId, selectedDate];
        console.log('=== INSTANT OPTIMISTIC UPDATE ===', reservationsCacheKey);
        
        queryClient.setQueryData(
          reservationsCacheKey,
          (oldData: any) => {
            if (!oldData) return oldData;
            
            // Handle both flat array and nested object structure
            const reservations = Array.isArray(oldData) ? oldData : oldData.reservations || [];
            
            const updatedReservations = reservations.map((r: Reservation) => {
              if (r.id === draggedReservation.id) {
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
        
        // Apply group-wide locks if this is a group assignment
        const lockPromises: Promise<any>[] = [];
        
        if (isGroupAssignment && assignedTables.length > 1) {
          console.log('🔒 APPLYING GROUP-WIDE LOCK', {
            anchorTable: intendedStartTable,
            allTables: assignedTables,
            lockDuration: '10 seconds'
          });

          // Apply lock to all tables in the group
          for (const tableNum of assignedTables) {
            if (tableNum !== intendedStartTable) {
              // Find other reservations on these tables and lock them too
              const otherReservations = existingReservations.filter(r =>
                r.id !== draggedReservation.id &&
                r.date === selectedDate &&
                (r.table_number === tableNum || r.table_numbers?.includes(tableNum))
              );

              for (const res of otherReservations) {
                lockPromises.push(
                  (async () => {
                    await supabase
                      .from('reservations')
                      .update({
                        locked_until: lockedUntil,
                        last_manual_move_time: now.toISOString()
                      })
                      .eq('id', res.id);
                  })()
                );
              }
            }
          }
        }

        // Queue database update with sequencer
        queueUpdate(`reservation:${draggedReservation.id}`, async () => {
          try {
            // Remove client-side fields before database write
            const { _updateSource, ...cleanUpdateData } = updateData;
            
            // Update main reservation
            const { error } = await supabase
              .from('reservations')
              .update(cleanUpdateData)
              .eq('id', draggedReservation.id);

            if (error) throw error;

            // Apply group-wide locks
            if (lockPromises.length > 0) {
              await Promise.all(lockPromises);
              console.log('🔒 GROUP-WIDE LOCKS APPLIED', { count: lockPromises.length });
            }

            console.log('=== MANUAL DROP UPDATE SUCCESS ===', {
              reservationId: draggedReservation.id,
              customerName: draggedReservation.customer_name,
              newTime: targetTimeSlot,
              anchorTable: intendedStartTable,
              assignedTables,
              isGroupAssignment,
              updateData,
              nextStep: 'Universal optimization in 10 seconds'
            });
            
            const assignedDisplay = isGroupAssignment 
              ? `tables ${assignedTables.join(', ')}${groupName ? ` in "${groupName}"` : ''}`
              : `table ${assignedTables[0]}`;
            const description = isSameRowShift
              ? `Time changed to ${targetTimeSlot}. Same tables preserved for 10 seconds.`
              : isGroupAssignment
                ? "Group assignment from your drop point. All tables locked for 10 seconds."
                : "Placed exactly where dropped. Universal optimization will analyze in 10 seconds.";
            
            toast({
              title: "Table moved successfully",
              duration: 2000
            });

            // Schedule post-lock optimization
            schedulePostLockOptimization(draggedReservation.id, lockedUntil);
          } catch (error: any) {
            console.error('=== DATABASE UPDATE ERROR ===', error);
            
            // Rollback optimistic update on error
            if (companyId && selectedDate) {
              const dateCacheKey = ['reservations-date', companyId, selectedDate];
              const currentCache = queryClient.getQueryData<any>(dateCacheKey);
              
              if (currentCache) {
                // Handle both flat array and nested object structure
                const reservations = Array.isArray(currentCache) ? currentCache : currentCache.reservations || [];
                const rolledBackReservations = reservations.map((r: Reservation) =>
                  r.id === draggedReservation.id ? draggedReservation : r
                );
                
                // Restore in same structure as cached
                const restoredData = Array.isArray(currentCache) ? rolledBackReservations : {
                  ...currentCache,
                  reservations: rolledBackReservations
                };
                
                queryClient.setQueryData(dateCacheKey, restoredData);
                console.log('=== ROLLBACK APPLIED ===', { reservationId: draggedReservation.id });
              }
            }
            
            toast({
              title: "Table move unsuccessful",
              variant: "destructive",
              duration: 2000
            });
          }
        });
      } else {
        console.log('=== NO CHANGES NEEDED ===');
      }
    } catch (error: any) {
      console.error('=== ENHANCED UPDATE ERROR ===', error);
      toast({
        title: "Error moving reservation",
        description: `Could not move reservation: ${error.message}`,
        variant: "destructive"
      });
    }
  }, [mouseDragState, hasTableConflictWrapper, tables, toast, onReservationUpdate, dragTracker, companyId, selectedDate, queryClient, queueUpdate, schedulePostLockOptimization, tableGroups, existingReservations]);

  const handleMouseDragStart = useCallback((reservation: Reservation, e: React.MouseEvent, tableNumber?: number) => {
    // Enhanced logging for drag start attempts
    console.log('=== MOUSE DRAG START ATTEMPT ===', {
      reservationId: reservation.id,
      customer: reservation.customer_name,
      currentTable: reservation.table_numbers || [reservation.table_number],
      isLocked: reservation.locked,
      lockedUntil: reservation.locked_until,
      status: reservation.status,
      timestamp: new Date().toISOString()
    });

    if (tables.length === 0) {
      e.preventDefault();
      console.log('=== DRAG BLOCKED: Tables not loaded ===');
      toast({
        title: "Tables not loaded",
        description: "Please wait for tables to load before moving reservations.",
        variant: "destructive"
      });
      return;
    }

    if (!layout) {
      e.preventDefault();
      console.log('=== DRAG BLOCKED: Layout not ready ===');
      toast({
        title: "Layout not ready",
        description: "Please wait for the layout to load before moving reservations.",
        variant: "destructive"
      });
      return;
    }

    const isLocked = reservation.locked;
    if (isLocked) {
      e.preventDefault();
      console.log('=== DRAG BLOCKED: Reservation permanently locked ===', {
        reservationId: reservation.id,
        customer: reservation.customer_name
      });
      toast({
        title: "Reservation is locked",
        description: "This reservation cannot be moved. Edit the reservation to unlock it first.",
        variant: "destructive"
      });
      return;
    }

    // Check if reservation is temporarily locked (optimization protection)
    if (reservation.locked_until) {
      const lockedUntil = new Date(reservation.locked_until);
      const now = new Date();
      
      if (now < lockedUntil) {
        const remainingSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
        console.log('=== MANUAL OVERRIDE: Temporarily locked reservation ===', {
          reservationId: reservation.id,
          customer: reservation.customer_name,
          lockedUntil: reservation.locked_until,
          remainingSeconds,
          userAction: 'manual_override_attempt'
        });
        
        // Allow manual override silently (no toast)
      }
    }

    // REMOVED: Restrictive validations for manual moves - staff override system checks
    // Only respect permanent locks, allow manual override of all other restrictions

    e.preventDefault();
    e.stopPropagation();

    dragTracker.startDragTracking(e.clientX, e.clientY);

    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    
    // CRITICAL: Improved grab offset calculation for precise cursor alignment
    const grabOffsetX = e.clientX - rect.left;
    const grabOffsetY = e.clientY - rect.top;
    const COLUMN_WIDTH = layout?.COLUMN_WIDTH || 19;
    const grabOffsetSlots = Math.floor(grabOffsetX / COLUMN_WIDTH);

    const grabOffset = { x: grabOffsetX, y: grabOffsetY, timeSlots: grabOffsetSlots };

    console.log('=== DRAG INITIATED SUCCESSFULLY ===', {
      reservation: reservation.customer_name,
      reservationId: reservation.id,
      clientPosition: { x: e.clientX, y: e.clientY },
      elementRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      grabOffset,
      columnWidth: COLUMN_WIDTH,
      rowHeight: layout.ROW_HEIGHT,
      calculatedOffsetSlots: grabOffsetSlots,
      isManualOverride: !!reservation.locked_until
    });

    // OPTIMIZED: Cache all table elements on drag start (eliminates 402-412 DOM query loop on every mouse move)
    const tableElements = Array.from(document.querySelectorAll('[data-table-id]')) as HTMLElement[];
    cachedTableElementsRef.current = tableElements.map(el => ({
      element: el,
      bounds: el.getBoundingClientRect(),
      tableId: el.getAttribute('data-table-id') || ''
    }));
    
    console.log('=== CACHED TABLE ELEMENTS FOR DRAG ===', {
      count: cachedTableElementsRef.current.length,
      tableIds: cachedTableElementsRef.current.map(c => c.tableId)
    });

    const dragElement = createCustomDragElement(reservation, grabOffset, element);
    customDragElement.current = dragElement;

    const ghost = createGhostElement(element);
    ghostElement.current = ghost;

    // OPTIMIZED: Use transform for initial positioning (GPU accelerated)
    const initialX = e.clientX - grabOffsetX;
    const initialY = e.clientY - grabOffsetY;
    dragElement.style.position = 'fixed';
    dragElement.style.left = '0px';
    dragElement.style.top = '0px';
    dragElement.style.zIndex = '9999';
    dragElement.style.pointerEvents = 'none';
    dragElement.style.transform = `translate3d(${initialX}px, ${initialY}px, 0)`;
    dragElement.style.willChange = 'transform';

    element.style.opacity = '0.5';
    
    // Initialize refs
    currentPositionRef.current = { x: e.clientX, y: e.clientY };
    dropZoneRef.current = null;

    setMouseDragState({
      isDragging: true,
      draggedReservation: reservation,
      dragOffset: { x: grabOffsetX, y: grabOffsetY },
      draggedElement: dragElement,
      grabOffset
    });
  }, [layout, toast, createCustomDragElement, createGhostElement, dragTracker, tables.length]);

  useEffect(() => {
    if (mouseDragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      document.addEventListener('dragstart', (e) => e.preventDefault());
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('dragstart', (e) => e.preventDefault());
      };
    }
  }, [mouseDragState.isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      // Cancel any pending animation frames
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (visualUpdateRafRef.current) {
        cancelAnimationFrame(visualUpdateRafRef.current);
      }
      
      if (customDragElement.current && customDragElement.current.parentNode === document.body) {
        document.body.removeChild(customDragElement.current);
      }
      
      if (ghostElement.current && ghostElement.current.parentNode === document.body) {
        document.body.removeChild(ghostElement.current);
      }
      
      document.querySelectorAll('.drop-zone-highlight').forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      
      document.querySelectorAll('.green-line-indicator').forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      
      // Clear cached elements
      cachedTableElementsRef.current = [];
    };
  }, []);

  // Cleanup post-lock timers on unmount
  useEffect(() => {
    return () => {
      // Clear all post-lock optimization timers
      postLockTimers.current.forEach((timer) => {
        clearTimeout(timer);
      });
      postLockTimers.current.clear();
    };
  }, []);

  const confirmTimeChange = useCallback(async () => {
    if (!pendingDrop) return;
    
    const { reservation, updateData, assignedTables, isGroupAssignment, isSameRowShift } = pendingDrop;
    setPendingDrop(null);
    
    console.log('✅ MOUSE: User confirmed time change - executing full update with new time');
    
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
      console.log('🔒 CONFIRM_TIME_LOCK (Mouse): Optimization hold until', lockedUntil);
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
    
    const lockPromises: Promise<void>[] = [];
    
    // Apply group-wide locks if needed
    if (isGroupAssignment && companyId && selectedDate) {
      const allReservations = queryClient.getQueryData<any>(reservationsCacheKey);
      const reservations = Array.isArray(allReservations) ? allReservations : allReservations?.reservations || [];
      
      for (const tableNum of assignedTables) {
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
        console.log('🔍 Confirm update payload:', cleanUpdateData);
        const { offlineAwareUpdate } = await import('@/utils/offlineAwareSupabase');
        const { error } = await offlineAwareUpdate('reservations', reservation.id, cleanUpdateData);
        if (error) throw error;
        
        await Promise.all(lockPromises);
        schedulePostLockOptimization(reservation.id, completeUpdateData.locked_until);
        
        toast({
          title: "Reservation moved",
          description: `Moved to table ${assignedTables[0]} at ${completeUpdateData.time.substring(0, 5)}`
        });
      } catch (error: any) {
        console.error('Update error:', error);
        queryClient.invalidateQueries({ queryKey: reservationsCacheKey });
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
      }
    });
  }, [pendingDrop, toast, companyId, selectedDate, location, queryClient, queueUpdate, schedulePostLockOptimization]);

  const cancelTimeChange = useCallback(async () => {
    if (!pendingDrop) return;
    
    const { reservation, updateData, originalTime, assignedTables, isGroupAssignment } = pendingDrop;
    setPendingDrop(null);
    
    console.log('🔄 MOUSE: User declined time change - updating table only (keeping original time)');
    
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
    
    const lockPromises: Promise<void>[] = [];
    
    if (isGroupAssignment && companyId && selectedDate) {
      const allReservations = queryClient.getQueryData<any>(reservationsCacheKey);
      const reservations = Array.isArray(allReservations) ? allReservations : allReservations?.reservations || [];
      
      for (const tableNum of assignedTables) {
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
          description: `Moved to table ${assignedTables[0]} (time unchanged)`
        });
      } catch (error: any) {
        console.error('Update error:', error);
        queryClient.invalidateQueries({ queryKey: reservationsCacheKey });
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
      }
    });
  }, [pendingDrop, toast, companyId, selectedDate, queryClient, queueUpdate, schedulePostLockOptimization]);

  return {
    mouseDragState,
    handleMouseDragStart,
    hasTableConflict: hasTableConflictWrapper,
    dragTracker,
    dropZoneRef,
    pendingDrop,
    confirmTimeChange,
    cancelTimeChange
  };
};
