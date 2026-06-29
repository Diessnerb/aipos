import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, List, Settings, ChevronLeft, ChevronRight, Zap, UserPlus, Trash2 } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { NewReservationModal } from './NewReservationModal';
import { EditReservationModal } from './EditReservationModal';
import { StatusSettingsModal } from './StatusSettingsModal';
import { TimelineOptimizationIndicator } from './TimelineOptimizationIndicator';
import { Reservation } from '@/types/reservation';
import { formatDisplayDate } from './timeline/utils/timelineUtils';
import { DatePickerModal } from './DatePickerModal';

interface ReservationHeaderProps {
  viewMode: 'list' | 'timeline';
  onViewModeChange: (mode: 'list' | 'timeline') => void;
  isDialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  editingReservation: Reservation | null;
  onEditingReservationChange: (reservation: Reservation | null) => void;
  onSaveReservation: (reservation: Reservation) => Promise<boolean>;
  dateRange?: { from?: Date; to?: Date };
  onDateRangeChange?: (range: { from?: Date; to?: Date }) => void;
  isTimelineView?: boolean;
  selectedDate?: string;
  onSelectedDateChange?: (date: string) => void;
  onOptimizeTrigger?: () => void;
  isOptimizing?: boolean;
  onCleanupNoShows?: () => void;
}

export const ReservationHeader: React.FC<ReservationHeaderProps> = ({
  viewMode,
  onViewModeChange,
  isDialogOpen,
  onDialogOpenChange,
  editingReservation,
  onEditingReservationChange,
  onSaveReservation,
  dateRange,
  onDateRangeChange,
  isTimelineView = false,
  selectedDate,
  onSelectedDateChange,
  onOptimizeTrigger,
  isOptimizing = false,
  onCleanupNoShows,
}) => {
  const [isStatusSettingsOpen, setIsStatusSettingsOpen] = useState(false);
  const [isWalkInMode, setIsWalkInMode] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const navigateDate = (direction: 'prev' | 'next') => {
    if (!selectedDate || !onSelectedDateChange) return;
    const currentDate = new Date(selectedDate);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    onSelectedDateChange(newDate.toISOString().split('T')[0]);
  };

  const handleDateSelect = (date: string) => {
    if (onSelectedDateChange) {
      onSelectedDateChange(date);
    }
    setIsDatePickerOpen(false);
  };

  const handleNewReservation = () => {
    onEditingReservationChange(null);
    setIsWalkInMode(false);
    onDialogOpenChange(true);
  };

  const handleNewWalkIn = () => {
    onEditingReservationChange(null);
    setIsWalkInMode(true);
    onDialogOpenChange(true);
  };

  const handleNewReservationSave = async (reservationData: {
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
    // Create new reservation object
    const newReservation: Reservation = {
      id: '', // Will be set by the database
      customer_name: reservationData.customer_name,
      party_size: reservationData.party_size,
      phone: reservationData.phone,
      email: reservationData.email,
      date: reservationData.date,
      time: reservationData.time,
      table_number: reservationData.table_number,
      table_numbers: reservationData.table_numbers,
      status: reservationData.status,
      notes: reservationData.notes,
      has_allergens: reservationData.has_allergens,
      allergens: reservationData.allergens,
    };

    const success = await onSaveReservation(newReservation);
    if (success) {
      onDialogOpenChange(false);
    }
  };

  const handleEditReservationSave = async (reservation: Reservation) => {
    const success = await onSaveReservation(reservation);
    if (success) {
      onDialogOpenChange(false);
      onEditingReservationChange(null);
    }
  };

  const handleEditModalClose = () => {
    onDialogOpenChange(false);
    onEditingReservationChange(null);
  };

  return (
    <>
      {/* Fixed height header - exact 72px to match APP_HEADER_HEIGHT */}
      <div className={cn(
        "h-[72px]",
        // In list view, break out of parent padding like PageHeader does
        !isTimelineView && "-mx-6"
      )}>
        {/* Grid layout for perfect centering */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 h-full px-6">
          {/* Left Section: Sidebar trigger and title */}
          <div className="flex items-center gap-3">
            {isTimelineView && (
              <SidebarTrigger className="flex-shrink-0" />
            )}
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Reservations
            </h1>
          </div>

          {/* Center Section: Date selector (only for timeline view) */}
          {isTimelineView && selectedDate && onSelectedDateChange ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate('prev')}
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setIsDatePickerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {formatDisplayDate(selectedDate)}
                </span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate('next')}
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div /> // Empty div to maintain grid structure
          )}
          
          {/* Right Section: Controls */}
          <div className="flex items-center gap-3 justify-end">
            {/* View Mode Toggle - Instant switching, no re-renders */}
            <div className="flex items-stretch h-9 border rounded-lg p-1 bg-muted/30">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('list')}
                className="px-3 h-7 transition-all duration-100"
              >
                <List className="h-3 w-3 mr-1" />
                List
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('timeline')}
                className="px-3 h-7 transition-all duration-100"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Timeline
              </Button>
            </div>

            {onCleanupNoShows && (
              <Button 
                onClick={onCleanupNoShows} 
                size="sm" 
                variant="outline"
                title="Remove tables from no-show reservations"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cleanup No-Shows
              </Button>
            )}

            <Button onClick={handleNewWalkIn} size="sm" variant="secondary">
              <UserPlus className="h-4 w-4 mr-2" />
              New Walk In
            </Button>
            
            <Button onClick={handleNewReservation} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Reservation
            </Button>
          </div>
        </div>
      </div>

      {/* New Reservation Modal */}
      <NewReservationModal
        isOpen={isDialogOpen && !editingReservation}
        onClose={() => {
          onDialogOpenChange(false);
          setIsWalkInMode(false);
        }}
        onSave={handleNewReservationSave}
        isWalkIn={isWalkInMode}
      />

      {/* Edit Reservation Modal - Always mounted for instant opening (Phase 2) */}
      <EditReservationModal
        isOpen={isDialogOpen && !!editingReservation}
        onClose={handleEditModalClose}
        onSave={handleEditReservationSave}
        reservation={editingReservation || undefined}
      />

      {/* Status Settings Modal */}
      <StatusSettingsModal
        isOpen={isStatusSettingsOpen}
        onClose={() => setIsStatusSettingsOpen(false)}
      />

      {/* Date Picker Modal */}
      {isTimelineView && selectedDate && onSelectedDateChange && (
        <DatePickerModal
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          onDateSelect={handleDateSelect}
          currentDate={selectedDate}
        />
      )}
    </>
  );
};
