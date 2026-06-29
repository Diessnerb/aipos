import { useMemo } from 'react';
import { Table } from '@/types/table';
import { useTimelineLayoutPrecalc } from '@/hooks/useTimelineLayoutPrecalc';
import { getDeviceScreenDimensions } from '@/utils/deviceScreenSize';
import { APP_HEADER_HEIGHT, APP_OUTER_PADDING } from '@/utils/layoutConstants';

interface LayoutConfig {
  TABLE_COLUMN_WIDTH: number;
  SEATS_COLUMN_WIDTH: number;
  COLUMN_WIDTH: number;
  timelineWidth: number;
  ROW_HEIGHT: number;
  ROW_REMAINDER: number;
  totalWidth: number;
  totalGridHeight?: number;
}

export const useOptimizedTimelineLayout = (tables: Table[], timeSlots: any[]) => {
  const { getPrecalculatedLayout } = useTimelineLayoutPrecalc();

  // Calculate layout using FIXED device dimensions with 6px padding
  const layout = useMemo((): LayoutConfig => {
    const deviceDimensions = getDeviceScreenDimensions();
    const precalculated = getPrecalculatedLayout(tables.length, timeSlots.length);
    
    // Use precalculated layout if available
    if (deviceDimensions && tables.length > 0 && timeSlots.length > 0 && precalculated) {
      console.log('⚡ Using precalculated layout with exact dimensions:', {
        viewport: `${precalculated.viewportWidth}x${precalculated.viewportHeight}`,
        container: `${precalculated.containerWidth}x${precalculated.containerHeight}`,
        tables: tables.length,
        slots: timeSlots.length,
        totalGridHeight: precalculated.totalGridHeight
      });
      
      return {
        TABLE_COLUMN_WIDTH: precalculated.TABLE_COLUMN_WIDTH,
        SEATS_COLUMN_WIDTH: precalculated.SEATS_COLUMN_WIDTH,
        COLUMN_WIDTH: precalculated.COLUMN_WIDTH,
        timelineWidth: precalculated.timelineWidth,
        ROW_HEIGHT: precalculated.ROW_HEIGHT,
        ROW_REMAINDER: precalculated.ROW_REMAINDER,
        totalWidth: precalculated.totalWidth,
        totalGridHeight: precalculated.totalGridHeight
      };
    }

    // Fallback: calculate on-the-fly using viewport dimensions with 6px padding
    if (!deviceDimensions) {
      console.warn('⚠️ No device dimensions - using basic fallback');
      return {
        TABLE_COLUMN_WIDTH: 90,
        SEATS_COLUMN_WIDTH: 70,
        COLUMN_WIDTH: 15,
        timelineWidth: 15 * timeSlots.length,
        ROW_HEIGHT: 44,
        ROW_REMAINDER: 0,
        totalWidth: 800,
        totalGridHeight: 44 * tables.length + 46 // header + rows
      };
    }
    
    // Calculate layout using stored viewport dimensions on tablets to prevent keyboard-triggered recalculations
    const storedDimensions = getDeviceScreenDimensions();
    const device = deviceDimensions;
    const viewportWidth = window.innerWidth;
    const viewportHeight = device?.isTablet && storedDimensions?.initialViewportHeight 
      ? storedDimensions.initialViewportHeight 
      : window.innerHeight;
    const padding = APP_OUTER_PADDING;
    
    const containerWidth = Math.max(320, viewportWidth - (padding * 2));
    const containerHeight = Math.max(200, viewportHeight - (padding * 2) - APP_HEADER_HEIGHT);
    
    const TABLE_COLUMN_WIDTH = 90;
    const SEATS_COLUMN_WIDTH = 70;
    const GRID_BORDER_X = 2; // Account for 1px left + 1px right border
    const availableTimelineWidth = containerWidth - TABLE_COLUMN_WIDTH - SEATS_COLUMN_WIDTH - GRID_BORDER_X;
    const COLUMN_WIDTH = timeSlots.length > 0 ? availableTimelineWidth / timeSlots.length : 15;
    
    // Calculate row height to fill container exactly
    const HEADER_HEIGHT = 45;
    const HEADER_BORDER = 1;
    const ROW_BORDER = 1;
    const headerChrome = HEADER_HEIGHT + HEADER_BORDER;
    const rowChrome = Math.max(tables.length - 1, 0) * ROW_BORDER;
    const availableRowSpace = containerHeight - headerChrome - rowChrome;
    const ROW_HEIGHT = tables.length > 0 ? Math.floor(availableRowSpace / tables.length) : 44;
    
    return {
      TABLE_COLUMN_WIDTH,
      SEATS_COLUMN_WIDTH,
      COLUMN_WIDTH,
      timelineWidth: availableTimelineWidth,
      ROW_HEIGHT,
      ROW_REMAINDER: 0,
      totalWidth: containerWidth - GRID_BORDER_X,
      totalGridHeight: containerHeight
    };
  }, [tables.length, timeSlots.length, getPrecalculatedLayout]);

  // Layout is ready when we have data (dimensions are always available after binding)
  const isReady = useMemo(() => {
    const deviceDimensions = getDeviceScreenDimensions();
    return deviceDimensions !== null && tables.length > 0 && timeSlots.length > 0;
  }, [tables.length, timeSlots.length]);

  return {
    layout,
    isReady,
    wouldScroll: false // No longer relevant since we use fixed dimensions
  };
};
