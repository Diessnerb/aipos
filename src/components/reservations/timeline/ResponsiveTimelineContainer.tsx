
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { getDeviceInfo } from '@/utils/deviceDetection';

interface ResponsiveTimelineContainerProps {
  children: React.ReactNode;
  onRefreshTables?: () => void;
  isRefreshing?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
  showRefreshButton?: boolean;
}

export const ResponsiveTimelineContainer: React.FC<ResponsiveTimelineContainerProps> = ({
  children,
  onRefreshTables,
  isRefreshing = false,
  containerRef,
  showRefreshButton = false
}) => {
  const device = getDeviceInfo();
  
  useEffect(() => {
    // Add tablet-specific CSS class for overflow handling
    if (device.isTablet) {
      document.body.classList.add('tablet-timeline-mode');
    } else {
      document.body.classList.remove('tablet-timeline-mode');
    }
    
    return () => {
      document.body.classList.remove('tablet-timeline-mode');
    };
  }, [device.isTablet]);
  
  return (
    <div className="relative w-full max-w-full h-full min-h-0 flex flex-col items-center overflow-x-hidden overflow-y-auto">
      {children}
    </div>
  );
};
