import React from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDateSelect: (date: string) => void;
  currentDate?: string;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  onDateSelect,
  currentDate = ''
}) => {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    currentDate ? new Date(currentDate) : new Date() // Default to today's date
  );

  React.useEffect(() => {
    if (isOpen) {
      // Set to current date if provided, otherwise default to today
      setSelectedDate(currentDate ? new Date(currentDate) : new Date());
    }
  }, [isOpen, currentDate]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      onDateSelect(formattedDate);
      onClose();
    }
  };

  const handleConfirm = () => {
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      onDateSelect(formattedDate);
      onClose();
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[420px] sm:max-w-[550px] md:max-w-[650px] lg:max-w-[750px] max-h-[90vh] bg-slate-50/95 backdrop-blur-sm border-cyan-200/40 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-800">Select Date</DialogTitle>
        </DialogHeader>

        <div className="p-3 sm:p-4 h-96 flex flex-col">
          {/* Calendar Only - Fixed positioning, centered */}
          <div className="flex justify-center items-start flex-1 min-h-0">
            <div className="flex justify-center w-full">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} // Disable past dates
                className={cn("p-1 pointer-events-auto scale-110 sm:scale-125")}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};