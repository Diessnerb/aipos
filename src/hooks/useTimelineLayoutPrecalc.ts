import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { getBoundDeviceInfo } from '@/utils/deviceDetection';
import { getBoundCompany } from '@/utils/deviceBinding';
import { APP_HEADER_HEIGHT, APP_OUTER_PADDING } from '@/utils/layoutConstants';
import { getDeviceScreenDimensions } from '@/utils/deviceScreenSize';

interface PrecalculatedLayout {
  TABLE_COLUMN_WIDTH: number;
  SEATS_COLUMN_WIDTH: number;
  COLUMN_WIDTH: number;
  timelineWidth: number;
  ROW_HEIGHT: number;
  ROW_REMAINDER: number;
  totalWidth: number;
  totalGridHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  containerWidth: number;
  containerHeight: number;
  tableCount: number;
  timeSlotCount: number;
  precalculated: true;
  timestamp: number;
}

export const useTimelineLayoutPrecalc = () => {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const precalculateLayout = (tables: any[], timeSlots: any[]): PrecalculatedLayout | null => {
    if (!companyId || !tables.length || !timeSlots.length) {
      return null;
    }

    // Use physical screen dimensions with 6px padding
    const boundCompany = getBoundCompany();
    const device = getBoundDeviceInfo();
    
    if (!boundCompany || !device) {
      console.warn('⚠️ No bound device info available for layout pre-calculation');
      return null;
    }
    
    // Use stored viewport dimensions on tablets to prevent keyboard-triggered recalculations
    const storedDimensions = getDeviceScreenDimensions();
    const viewportWidth = window.innerWidth;
    const viewportHeight = device.isTablet && storedDimensions?.initialViewportHeight 
      ? storedDimensions.initialViewportHeight 
      : window.innerHeight;
    const padding = APP_OUTER_PADDING; // Fixed 6px padding as requested
    
    // Container dimensions subtracting app header to prevent scroll
    // Ensure container never exceeds viewport width to prevent horizontal scrolling
    const maxWidth = viewportWidth - (padding * 2);
    const containerWidth = Math.max(320, Math.min(maxWidth, viewportWidth - (padding * 2)));
    const containerHeight = Math.max(200, viewportHeight - (padding * 2) - APP_HEADER_HEIGHT);
    
    // Use device-binding constants for precise layout with tablet enhancements
    const boundConstants = boundCompany.precalculated_layouts;
    const TABLE_COLUMN_WIDTH = boundConstants.tableColumnWidth;
    const SEATS_COLUMN_WIDTH = boundConstants.seatsColumnWidth;
    let minColumnWidth = boundConstants.minColumnWidth;
    let minRowHeight = boundConstants.minRowHeight;
    
    // Apply tablet-specific enhancements
    if (device.isTablet) {
      // Ensure minimum dimensions prevent clipping on tablets
      const tabletMinColumnWidth = device.orientation === 'portrait' ? 15 : 20;
      const tabletMinRowHeight = device.orientation === 'portrait' ? 20 : 22;
      minColumnWidth = Math.max(minColumnWidth, tabletMinColumnWidth);
      minRowHeight = Math.max(minRowHeight, tabletMinRowHeight);
    }
    
    // Account for 2px grid border (1px left + 1px right)
    const GRID_BORDER_X = 2;
    
    // Calculate timeline width to fill available space exactly - no remainder
    const availableTimelineWidth = containerWidth - TABLE_COLUMN_WIDTH - SEATS_COLUMN_WIDTH - GRID_BORDER_X;
    
    // Distribute space equally across all columns (no minimum constraint)
    const COLUMN_WIDTH = timeSlots.length > 0 ? availableTimelineWidth / timeSlots.length : minColumnWidth;
    const timelineWidth = availableTimelineWidth;
    const totalWidth = containerWidth - GRID_BORDER_X;
    
    // Use pre-calculated header and row dimensions
    const HEADER_HEIGHT = boundCompany.precalculated_layouts.headerHeight;
    const HEADER_BORDER = 1;
    const ROW_BORDER = 1;
    const headerChrome = HEADER_HEIGHT + HEADER_BORDER;
    const rowChrome = Math.max(tables.length - 1, 0) * ROW_BORDER;
    const availableRowHeight = Math.max(0, containerHeight - headerChrome - rowChrome);
    
    let ROW_HEIGHT = 44; // Default
    
    if (tables.length > 0 && availableRowHeight > 0) {
      const calculatedRowHeight = Math.floor(availableRowHeight / tables.length);
      ROW_HEIGHT = Math.max(minRowHeight, calculatedRowHeight);
      
      // Tablet-specific: prevent cramped layouts with many tables
      if (device.isTablet && tables.length > 20) {
        // For high table counts, ensure minimum readability
        const tabletComfortableMin = device.orientation === 'portrait' ? 22 : 24;
        ROW_HEIGHT = Math.max(ROW_HEIGHT, tabletComfortableMin);
      }
    } else {
      // Use device-specific fallback heights with improved tablet values
      if (device.isTablet) {
        ROW_HEIGHT = tables.length > 25 ? 20 : tables.length > 15 ? 24 : 28;
      } else if (device.isMobile) {
        ROW_HEIGHT = tables.length > 20 ? 28 : 34;
      } else if (tables.length > 20) {
        ROW_HEIGHT = 32;
      }
    }
    
    // Calculate row height to fill container exactly - distribute all available space
    const availableRowSpace = containerHeight - headerChrome - rowChrome;
    
    // Distribute space equally across all rows and calculate true remainder
    const finalRowHeight = tables.length > 0 
      ? Math.floor(availableRowSpace / tables.length)
      : boundCompany.precalculated_layouts.minRowHeight;
      
    const ROW_REMAINDER = tables.length > 0 
      ? availableRowSpace - (finalRowHeight * tables.length)
      : 0;

    const layout: PrecalculatedLayout = {
      TABLE_COLUMN_WIDTH,
      SEATS_COLUMN_WIDTH,
      COLUMN_WIDTH,
      timelineWidth,
      ROW_HEIGHT: finalRowHeight,
      ROW_REMAINDER,
      totalWidth,
      totalGridHeight: containerHeight, // Exact container height - no scrolling
      viewportWidth,
      viewportHeight,
      containerWidth,
      containerHeight,
      tableCount: tables.length,
      timeSlotCount: timeSlots.length,
      precalculated: true,
      timestamp: Date.now()
    };

    // Cache the pre-calculated layout
    queryClient.setQueryData(['timeline-layout-precalc', companyId], layout);
    
    // Sanity check: verify height equation
    const calculatedHeight = headerChrome + (finalRowHeight * tables.length) + rowChrome + ROW_REMAINDER;
    const heightMatches = Math.abs(calculatedHeight - containerHeight) <= 1;

    console.log('📐 Pre-calculated timeline layout:', {
      tables: tables.length,
      timeSlots: timeSlots.length,
      viewport: `${viewportWidth}x${viewportHeight}`,
      container: `${containerWidth}x${containerHeight}`,
      rowHeight: finalRowHeight,
      rowRemainder: ROW_REMAINDER,
      totalHeight: layout.totalGridHeight,
      heightEquation: `${headerChrome} + ${finalRowHeight * tables.length} + ${rowChrome} + ${ROW_REMAINDER} = ${calculatedHeight}`,
      heightMatches,
      device: device.isTablet ? 'tablet' : device.isMobile ? 'mobile' : 'desktop',
      orientation: device.orientation,
      noScrollNeeded: layout.totalGridHeight <= containerHeight
    });

    return layout;
  };

  const getPrecalculatedLayout = (currentTableCount?: number, currentTimeSlotCount?: number): PrecalculatedLayout | null => {
    if (!companyId) return null;
    
    const cached = queryClient.getQueryData(['timeline-layout-precalc', companyId]) as PrecalculatedLayout;
    
    // Check if cached layout is still valid
    if (cached && cached.precalculated) {
      const age = Date.now() - cached.timestamp;
      const viewportChanged = Math.abs(window.innerWidth - cached.viewportWidth) > 50 || 
                             Math.abs(window.innerHeight - cached.viewportHeight) > 50;
      
      // Validate data dimensions match if provided
      const dataChanged = (currentTableCount !== undefined && cached.tableCount !== currentTableCount) ||
                         (currentTimeSlotCount !== undefined && cached.timeSlotCount !== currentTimeSlotCount);
      
      if (age < 30000 && !viewportChanged && !dataChanged) {
        console.log('✅ Using valid precalculated layout:', {
          tables: cached.tableCount,
          timeSlots: cached.timeSlotCount,
          container: `${cached.containerWidth}x${cached.containerHeight}`,
          age: `${Math.round(age / 1000)}s`
        });
        return cached;
      }
      
      if (dataChanged) {
        console.log('⚠️ Rejecting precalc cache - data mismatch:', {
          cached: { tables: cached.tableCount, timeSlots: cached.timeSlotCount },
          current: { tables: currentTableCount, timeSlots: currentTimeSlotCount }
        });
      }
    }
    
    return null;
  };

  return {
    precalculateLayout,
    getPrecalculatedLayout
  };
};