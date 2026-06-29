import { getBoundCompany } from './deviceBinding';
import { getBoundDeviceInfo } from './deviceDetection';
import { APP_HEADER_HEIGHT, APP_OUTER_PADDING } from './layoutConstants';
import { getDeviceScreenDimensions } from './deviceScreenSize';
import { getCurrentScale } from './displayScaleCalculator';

export interface TimelineDimensions {
  TABLE_COLUMN_WIDTH: number;
  SEATS_COLUMN_WIDTH: number;
  COLUMN_WIDTH: number;
  timelineWidth: number;
  ROW_HEIGHT: number;
  ROW_REMAINDER: number;
  totalWidth: number;
  totalGridHeight: number;
  containerWidth: number;
  containerHeight: number;
  tableCount: number;
  timeSlotCount: number;
}

/**
 * Calculate exact timeline dimensions based on device profile and data.
 * This is a pure function that runs synchronously and produces consistent results.
 */
export function calculateTimelineDimensions(
  tableCount: number,
  timeSlotCount: number
): TimelineDimensions | null {
  const boundCompany = getBoundCompany();
  const device = getBoundDeviceInfo();

  if (!boundCompany || !device) {
    console.warn('⚠️ Cannot calculate timeline dimensions - no device binding');
    return null;
  }

  // Use stored viewport dimensions on tablets to prevent keyboard-triggered recalculations
  const storedDimensions = getDeviceScreenDimensions();
  const viewportWidth = window.innerWidth;
  const viewportHeight = device.isTablet && storedDimensions?.initialViewportHeight 
    ? storedDimensions.initialViewportHeight 
    : window.innerHeight;
  const padding = APP_OUTER_PADDING; // Fixed 6px padding

  // Calculate container dimensions (subtract header height to avoid page scroll)
  // Ensure container never exceeds viewport width to prevent horizontal scrolling
  const maxWidth = viewportWidth - padding * 2;
  const containerWidth = Math.max(320, Math.min(maxWidth, viewportWidth - padding * 2));
  const containerHeight = Math.max(200, viewportHeight - padding * 2 - APP_HEADER_HEIGHT);

  // Use pre-calculated layout values
  const TABLE_COLUMN_WIDTH = boundCompany.precalculated_layouts.tableColumnWidth;
  const SEATS_COLUMN_WIDTH = boundCompany.precalculated_layouts.seatsColumnWidth;
  const minColumnWidth = boundCompany.precalculated_layouts.minColumnWidth;

  // Account for 2px grid border (1px left + 1px right)
  const GRID_BORDER_X = 2;

  // Calculate timeline width to fill available space exactly - no remainder
  const availableTimelineWidth = containerWidth - TABLE_COLUMN_WIDTH - SEATS_COLUMN_WIDTH - GRID_BORDER_X;
  // Distribute space equally across all columns (no minimum constraint)
  const COLUMN_WIDTH = timeSlotCount > 0 ? availableTimelineWidth / timeSlotCount : minColumnWidth;
  const timelineWidth = availableTimelineWidth;

  // Calculate row heights
  const HEADER_HEIGHT = boundCompany.precalculated_layouts.headerHeight;
  const HEADER_BORDER = 1;
  const ROW_BORDER = 1;
  const headerChrome = HEADER_HEIGHT + HEADER_BORDER;
  const rowChrome = Math.max(tableCount - 1, 0) * ROW_BORDER;
  const availableRowHeight = Math.max(0, containerHeight - headerChrome - rowChrome);

  let ROW_HEIGHT = 44; // Default

  if (tableCount > 0 && availableRowHeight > 0) {
    const calculatedRowHeight = Math.floor(availableRowHeight / tableCount);
    const minRowHeight = boundCompany.precalculated_layouts.minRowHeight;
    ROW_HEIGHT = Math.max(minRowHeight, calculatedRowHeight);
  } else {
    // Device-specific fallback heights
    if (device.isTablet) {
      ROW_HEIGHT = tableCount > 25 ? 18 : tableCount > 15 ? 22 : 28;
    } else if (device.isMobile) {
      ROW_HEIGHT = tableCount > 20 ? 28 : 34;
    } else if (tableCount > 20) {
      ROW_HEIGHT = 32;
    }
  }

  // Calculate row height to fill container exactly - distribute all available space
  const availableRowSpace = containerHeight - headerChrome - rowChrome;
  
  // Distribute space equally across all rows and calculate true remainder
  const finalRowHeight = tableCount > 0 
    ? Math.floor(availableRowSpace / tableCount)
    : boundCompany.precalculated_layouts.minRowHeight;
    
  const ROW_REMAINDER = tableCount > 0 
    ? availableRowSpace - (finalRowHeight * tableCount)
    : 0;

  // Apply display scale factor
  const scale = getCurrentScale();

  const dimensions: TimelineDimensions = {
    TABLE_COLUMN_WIDTH: TABLE_COLUMN_WIDTH * scale,
    SEATS_COLUMN_WIDTH: SEATS_COLUMN_WIDTH * scale,
    COLUMN_WIDTH: COLUMN_WIDTH * scale,
    timelineWidth: timelineWidth * scale,
    ROW_HEIGHT: finalRowHeight * scale,
    ROW_REMAINDER: ROW_REMAINDER * scale,
    totalWidth: (containerWidth - GRID_BORDER_X) * scale,
    totalGridHeight: containerHeight * scale,
    containerWidth: containerWidth * scale,
    containerHeight: containerHeight * scale,
    tableCount,
    timeSlotCount,
  };

  // Sanity check: verify height equation
  const calculatedHeight = headerChrome + (finalRowHeight * tableCount) + rowChrome + ROW_REMAINDER;
  const heightMatches = Math.abs(calculatedHeight - containerHeight) <= 1;

  console.log('📐 Calculated timeline dimensions:', {
    container: `${containerWidth}x${containerHeight}`,
    tables: tableCount,
    timeSlots: timeSlotCount,
    rowHeight: finalRowHeight,
    rowRemainder: ROW_REMAINDER,
    totalHeight: dimensions.totalGridHeight,
    heightEquation: `${headerChrome} + ${finalRowHeight * tableCount} + ${rowChrome} + ${ROW_REMAINDER} = ${calculatedHeight}`,
    heightMatches,
    device: device.isTablet ? 'tablet' : device.isMobile ? 'mobile' : 'desktop',
    orientation: device.orientation,
  });

  return dimensions;
}
