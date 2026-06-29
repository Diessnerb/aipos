import React from 'react';
import { ResponsiveTimelineContainer } from './ResponsiveTimelineContainer';
import { TabletLayoutOptimizer } from './TabletLayoutOptimizer';
import { getDeviceInfo } from '@/utils/deviceDetection';

interface EnhancedTimelineContainerProps {
  children: React.ReactNode;
  onRefreshTables?: () => void;
  isRefreshing?: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  showRefreshButton?: boolean;
  totalGridHeight?: number;
  containerHeight?: number;
}

export const EnhancedTimelineContainer: React.FC<EnhancedTimelineContainerProps> = ({
  children,
  onRefreshTables,
  isRefreshing = false,
  containerRef,
  showRefreshButton = false,
  totalGridHeight,
  containerHeight = 0
}) => {
  const device = getDeviceInfo();
  
  return (
    <TabletLayoutOptimizer
      totalGridHeight={totalGridHeight}
      containerHeight={containerHeight}
    >
      <ResponsiveTimelineContainer
        onRefreshTables={onRefreshTables}
        isRefreshing={isRefreshing}
        containerRef={containerRef}
        showRefreshButton={showRefreshButton}
      >
        {children}
      </ResponsiveTimelineContainer>
    </TabletLayoutOptimizer>
  );
};