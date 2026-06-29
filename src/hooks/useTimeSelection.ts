
import { useState, useEffect } from 'react';

export const useTimeSelection = (currentTime?: string, isOpen?: boolean) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = useState<number>(12);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  // Parse current time when modal opens
  useEffect(() => {
    if (isOpen && currentTime) {
      const [hours, minutes] = currentTime.split(':').map(Number);
      
      if (hours === 0) {
        setSelectedHour(12);
        setSelectedPeriod('AM');
      } else if (hours < 12) {
        setSelectedHour(hours);
        setSelectedPeriod('AM');
      } else if (hours === 12) {
        setSelectedHour(12);
        setSelectedPeriod('PM');
      } else {
        setSelectedHour(hours - 12);
        setSelectedPeriod('PM');
      }
      
      setSelectedMinute(minutes);
    }
  }, [isOpen, currentTime]);

  const formatDisplayTime = () => {
    const displayHour = selectedPeriod === 'PM' 
      ? selectedHour.toString() 
      : selectedHour.toString().padStart(2, '0');
    const displayMinute = selectedMinute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute}`;
  };

  const getTimeString = () => {
    let hour24 = selectedHour;
    
    if (selectedPeriod === 'AM' && selectedHour === 12) {
      hour24 = 0;
    } else if (selectedPeriod === 'PM' && selectedHour !== 12) {
      hour24 = selectedHour + 12;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
  };

  return {
    selectedPeriod,
    setSelectedPeriod,
    selectedHour,
    setSelectedHour,
    selectedMinute,
    setSelectedMinute,
    formatDisplayTime,
    getTimeString
  };
};
