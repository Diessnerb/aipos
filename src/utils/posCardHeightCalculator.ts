import { getDeviceScreenDimensions } from './deviceScreenSize';
import { getCurrentScale } from './displayScaleCalculator';

export interface POSCardDimensions {
  cardHeight: number;      // Height for each card
  cardMinHeight: number;   // Minimum height constraint
}

/**
 * Calculate optimal card heights for POS to fit exactly 6 rows
 * 
 * Layout breakdown:
 * - KitchenReadyNotificationsBar: ~80px (when visible)
 * - Container padding (p-6): 48px total
 * - 6 rows with 5 gaps between them
 * - gap-4 = 16px per gap
 */
export function calculatePOSCardHeight(): POSCardDimensions {
  const dimensions = getDeviceScreenDimensions();
  
  if (!dimensions) {
    // Fallback to reasonable defaults
    return {
      cardHeight: 150,
      cardMinHeight: 150,
    };
  }

  const viewportHeight = dimensions.viewportHeight;
  
  // Layout constants
  const notificationBarHeight = 80;  // KitchenReadyNotificationsBar when visible
  const containerPadding = 48;        // p-6 = 24px × 2
  const targetRows = 6;
  const gridGapPx = 16;               // gap-4 = 1rem = 16px
  const totalGaps = (targetRows - 1) * gridGapPx; // 5 gaps × 16px = 80px
  
  // Calculate available height for cards
  const availableHeight = viewportHeight - notificationBarHeight - containerPadding - totalGaps;
  
  // Divide by number of rows
  let cardHeight = Math.floor(availableHeight / targetRows);
  
  // Set reasonable constraints
  // Minimum: 100px (ensures usability)
  // Maximum: 250px (prevents oversized cards on large screens)
  cardHeight = Math.max(100, Math.min(250, cardHeight));
  
  // Apply display scale factor
  const scale = getCurrentScale();
  cardHeight = cardHeight * scale;
  
  console.log('📐 POS Card Heights Calculated:', {
    viewport: `${dimensions.viewportWidth}x${viewportHeight}`,
    breakdown: {
      viewportHeight: `${viewportHeight}px`,
      notificationBar: `${notificationBarHeight}px`,
      containerPadding: `${containerPadding}px`,
      gridGaps: `${totalGaps}px (5 gaps)`,
      availableHeight: `${availableHeight}px`,
    },
    result: {
      cardHeight: `${cardHeight}px`,
      rows: targetRows,
      totalGridHeight: `${(cardHeight * targetRows) + totalGaps}px`,
    },
  });
  
  return {
    cardHeight,
    cardMinHeight: cardHeight,
  };
}

/**
 * Get card dimensions as CSS-in-JS style object
 */
export function getPOSCardHeightStyles(dimensions: POSCardDimensions) {
  return {
    minHeight: `${dimensions.cardMinHeight}px`,
    height: `${dimensions.cardHeight}px`,
  };
}
