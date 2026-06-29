
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FuturisticButton } from './ui/FuturisticButton';
import { FuturisticToggleButton } from './ui/FuturisticToggleButton';
import { useTimeSelection } from '@/hooks/useTimeSelection';

interface TimeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeSelect: (time: string) => void;
  currentTime?: string;
}

export const TimeSelectionModal: React.FC<TimeSelectionModalProps> = ({
  isOpen,
  onClose,
  onTimeSelect,
  currentTime = ''
}) => {
  const {
    selectedPeriod,
    setSelectedPeriod,
    selectedHour,
    setSelectedHour,
    selectedMinute,
    setSelectedMinute,
    formatDisplayTime,
    getTimeString
  } = useTimeSelection(currentTime, isOpen);

  const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutes = [0, 15, 30, 45];

  const handleConfirm = () => {
    const timeString = getTimeString();
    onTimeSelect(timeString);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[420px] sm:max-w-[500px] md:max-w-[580px] lg:max-w-[650px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-foreground">Select Time</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 space-y-1.5 sm:space-y-2 md:space-y-3 p-3 sm:p-4 min-h-0 overflow-y-auto">
          {/* Display */}
          <div className="text-center flex-shrink-0">
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary mb-1 sm:mb-2 drop-shadow-sm">
              {formatDisplayTime()}
            </div>
            <div className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground">{selectedPeriod}</div>
          </div>

          {/* Hour and Minute Selection - Side by Side */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center flex-1 min-h-0">
            {/* Hour Selection */}
            <div className="flex-1 max-w-xs mx-auto sm:mx-0">
              <div className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 text-muted-foreground text-center">Select Hour</div>
              <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3 justify-items-center">
                {hours.map((hour) => (
                  <FuturisticButton
                    key={hour}
                    isSelected={selectedHour === hour}
                    onClick={() => setSelectedHour(hour)}
                  >
                    {hour}
                  </FuturisticButton>
                ))}
              </div>
            </div>

            {/* Minute Selection with AM/PM underneath */}
            <div className="flex-1 max-w-xs mx-auto sm:mx-0 space-y-2 sm:space-y-2.5 md:space-y-3">
              <div>
                <div className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 text-muted-foreground text-center">Select Minutes</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 justify-items-center">
                  {minutes.map((minute) => (
                    <FuturisticButton
                      key={minute}
                      isSelected={selectedMinute === minute}
                      onClick={() => setSelectedMinute(minute)}
                    >
                      {minute.toString().padStart(2, '0')}
                    </FuturisticButton>
                  ))}
                </div>
              </div>

              {/* AM/PM Toggle underneath minutes */}
              <div>
                <div className="text-xs sm:text-sm font-medium mb-2 text-muted-foreground text-center">Select Period</div>
                <div className="flex gap-2 sm:gap-3">
                  <FuturisticToggleButton
                    isSelected={selectedPeriod === 'AM'}
                    onClick={() => setSelectedPeriod('AM')}
                  >
                    AM
                  </FuturisticToggleButton>
                  <FuturisticToggleButton
                    isSelected={selectedPeriod === 'PM'}
                    onClick={() => setSelectedPeriod('PM')}
                  >
                    PM
                  </FuturisticToggleButton>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 sm:gap-3 pt-1.5 sm:pt-2 md:pt-3 flex-shrink-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 text-sm sm:text-base md:text-lg font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleConfirm} 
              className="flex-1 text-sm sm:text-base md:text-lg font-semibold"
            >
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
