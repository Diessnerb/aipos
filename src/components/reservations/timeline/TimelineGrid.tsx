import React, { useState, useEffect } from 'react';
import { Table, TableGroupWithTables, TableServiceSchedule } from '@/types/table';
import { Reservation } from '@/types/reservation';
import { TableRow } from './TableRow';
import { getBoundCompany } from '@/utils/deviceBinding';

interface TouchDragState {
  isDragging: boolean;
  draggedReservation: Reservation | null;
  dragOffset: { x: number; y: number };
  currentPosition: { x: number; y: number };
  draggedElement: HTMLElement | null;
  dropZone: { tableId: string; timeSlot?: string } | null;
  grabOffset: { x: number; y: number; timeSlots: number } | null;
}

interface MouseDragState {
  isDragging: boolean;
  draggedReservation: Reservation | null;
  dragOffset: { x: number; y: number };
  draggedElement: HTMLElement | null;
  grabOffset: { x: number; y: number; timeSlots: number } | null;
}

interface TimelineGridProps {
  tables: Table[];
  reservations: Reservation[];
  timeSlots: Array<{ hour: number; minute: number; time: string; label: string; isMainHour: boolean }>;
  layout: {
    TABLE_COLUMN_WIDTH: number;
    SEATS_COLUMN_WIDTH: number;
    COLUMN_WIDTH: number;
    timelineWidth: number;
    ROW_HEIGHT: number;
    ROW_REMAINDER: number;
    totalWidth: number;
    totalGridHeight?: number;
  };
  openingHour: number;
  closingHour: number;
  selectedDate: string;
  tableSchedules: Map<string, TableServiceSchedule>;
  londonTime: Date;
  dragOverInfo: {tableId: string, timeSlot?: string, cursorTimeSlot?: string} | null;
  draggedReservation: Reservation | null;
  onTableDragOver: (e: React.DragEvent, tableId: string) => void;
  onTimeSlotDragOver: (e: React.DragEvent, tableId: string, timeSlot: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetTableNumber: number, targetTimeSlot?: string) => void;
  onDragStart: (reservation: Reservation, e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onReservationClick: (reservation: Reservation, e?: React.MouseEvent) => void;
  onTimeSlotClick: (tableNumber: number, timeSlot: string) => void;
  hasTableConflict?: (targetTables: number[], requestedTime: string) => boolean;
  // Enhanced mouse drag handlers
  enhancedMouseDragState?: MouseDragState;
  onEnhancedMouseDragStart?: (reservation: Reservation, e: React.MouseEvent, tableNumber?: number) => void;
  // Touch handlers
  touchDragState: TouchDragState;
  onTouchStart: (reservation: Reservation, e: React.TouchEvent, tableNumber?: number) => void;
  // Table groups
  tableGroups?: TableGroupWithTables[];
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  tables,
  reservations,
  timeSlots,
  layout,
  openingHour,
  closingHour,
  selectedDate,
  tableSchedules,
  londonTime,
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
  hasTableConflict,
  enhancedMouseDragState,
  onEnhancedMouseDragStart,
  touchDragState,
  onTouchStart,
  tableGroups
}) => {
  const getCurrentTimePosition = () => {
    const londonDateString = londonTime.toLocaleDateString('en-CA', {
      timeZone: 'Europe/London'
    });
    
    if (selectedDate !== londonDateString) {
      return -1;
    }
    
    // FIXED: Get hours and minutes in London timezone (not device timezone)
    const londonTimeString = londonTime.toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Parse "21:10" format
    const [hours, minutes] = londonTimeString.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    
    const startMinutes = openingHour * 60;
    const endMinutes = (closingHour * 60) + 59;
    
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return -1;
    }
    
    const elapsedMinutes = currentMinutes - startMinutes;
    const slotPosition = elapsedMinutes / 15;
    const pixelPosition = slotPosition * layout.COLUMN_WIDTH;
    
    return pixelPosition;
  };

  // Make current time position live - updates every 5 seconds
  const [currentTimePosition, setCurrentTimePosition] = useState(getCurrentTimePosition());
  
  // Update current time line every 5 seconds to keep it synchronized
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimePosition(getCurrentTimePosition());
    }, 5000); // 5 seconds for live updates
    
    return () => clearInterval(interval);
  }, [openingHour, closingHour, layout.COLUMN_WIDTH, selectedDate, londonTime]);

  // Recalculate current time position when relevant props change
  useEffect(() => {
    setCurrentTimePosition(getCurrentTimePosition());
  }, [selectedDate, londonTime, openingHour, closingHour, layout.COLUMN_WIDTH]);
  
  const headerTimeSlots = timeSlots.filter(slot => slot.isMainHour);
  const filteredReservations = reservations.filter(r => {
    if (!r || !r.date) return false;
    return r.date === selectedDate;
  });

  const isDragDisabled = !tables || tables.length === 0;
  

  // Use exact totalGridHeight from layout calculation - it includes header, rows, borders, and remainder
  const totalGridHeight = layout.totalGridHeight;
  
  // Get header height from bound company precalculations
  const boundCompany = getBoundCompany();
  const HEADER_HEIGHT = boundCompany?.precalculated_layouts?.headerHeight || 45;

  // Verify height calculation
  console.log('🎯 TimelineGrid dimensions:', {
    totalGridHeight,
    containerHeight: totalGridHeight,
    headerHeight: HEADER_HEIGHT,
    rowHeight: layout.ROW_HEIGHT,
    rowRemainder: layout.ROW_REMAINDER,
    tableCount: tables.length,
    calculatedHeight: HEADER_HEIGHT + 1 + (layout.ROW_HEIGHT * tables.length) + Math.max(tables.length - 1, 0) + layout.ROW_REMAINDER,
    heightMatches: Math.abs((HEADER_HEIGHT + 1 + (layout.ROW_HEIGHT * tables.length) + Math.max(tables.length - 1, 0) + layout.ROW_REMAINDER) - totalGridHeight) <= 1
  });

  return (
    <div 
      className="relative box-border bg-card border border-border rounded-lg overflow-hidden shadow-sm flex flex-col"
      style={{ 
        width: `${layout.totalWidth}px`,
        height: `${totalGridHeight}px` 
      }}
      data-timeline-grid
    >

      {/* Time Header Row */}
      <div className="sticky top-0 z-0 bg-card flex border-b border-border">
        {/* Table Header */}
        <div 
          className="flex items-center justify-center border-r border-border bg-muted text-xs font-medium text-muted-foreground py-1 box-border flex-shrink-0"
          style={{ width: `${layout.TABLE_COLUMN_WIDTH}px`, height: `${HEADER_HEIGHT}px` }}
        >
          Table
        </div>
        
        {/* Seats Header */}
        <div 
          className="flex items-center justify-center border-r border-border bg-muted text-xs font-medium text-muted-foreground py-1 box-border flex-shrink-0"
          style={{ width: `${layout.SEATS_COLUMN_WIDTH}px`, height: `${HEADER_HEIGHT}px` }}
        >
          Seats
        </div>
        
        {/* Time Headers */}
        {headerTimeSlots.map((slot, index) => (
          <div
            key={slot.time}
            className={`flex items-center justify-center text-xs font-medium text-muted-foreground py-1 box-border relative flex-shrink-0 ${
              index < headerTimeSlots.length - 1 ? 'border-r border-border/50' : ''
            }`}
            style={{ width: `${layout.COLUMN_WIDTH * 4}px`, height: `${HEADER_HEIGHT}px` }}
          >
            {slot.label}
          </div>
        ))}
      </div>

      {/* Current Time Line */}
      {currentTimePosition >= 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-destructive z-30 pointer-events-none"
          style={{ 
            left: `${layout.TABLE_COLUMN_WIDTH + layout.SEATS_COLUMN_WIDTH + currentTimePosition}px`,
            top: `${HEADER_HEIGHT}px`
          }}
        />
      )}

      {/* Table Rows */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {tables.map((table, index) => (
          <TableRow
            key={table.id}
            table={table}
            schedule={tableSchedules.get(table.id)}
            selectedDate={new Date(selectedDate)}
            index={index}
            tablesLength={tables.length}
            reservations={filteredReservations}
            timeSlots={timeSlots}
            layout={layout}
            openingHour={openingHour}
            closingHour={closingHour}
            dragOverInfo={dragOverInfo}
            draggedReservation={draggedReservation}
            onTableDragOver={onTableDragOver}
            onTimeSlotDragOver={onTimeSlotDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onReservationClick={onReservationClick}
            onTimeSlotClick={onTimeSlotClick}
            allTables={tables}
            hasTableConflict={hasTableConflict}
            enhancedMouseDragState={enhancedMouseDragState}
            onEnhancedMouseDragStart={onEnhancedMouseDragStart}
            touchDragState={touchDragState}
            onTouchStart={onTouchStart}
            tableGroups={tableGroups}
          />
        ))}
      </div>
    </div>
  );
};
