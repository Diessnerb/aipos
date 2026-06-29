
import React from 'react';

interface TimelineLoadingStateProps {
  message: string;
  showSpinner?: boolean;
}

export const TimelineLoadingState: React.FC<TimelineLoadingStateProps> = ({ 
  message, 
  showSpinner = true 
}) => {
  return (
    <div className="w-full h-full bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        {showSpinner && (
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        )}
        <div className="text-muted-foreground">{message}</div>
      </div>
    </div>
  );
};
