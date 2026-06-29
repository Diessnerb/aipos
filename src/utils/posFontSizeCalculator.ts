import { getDeviceScreenDimensions } from './deviceScreenSize';
import { getCurrentScale } from './displayScaleCalculator';

export interface POSFontSizes {
  cardTitle: number;      // Item/category name
  price: number;          // Price display
  description: number;    // Description text
  badge: number;          // Tags
}

/**
 * Calculate optimal font sizes for POS cards based on device screen
 * Ensures at least 11 characters fit on a line for card titles
 * Font sizes range from 11-20px based on device screen width
 * 
 * Layout considerations:
 * - 72px sidebar width
 * - 65% of remaining space for POS menu column
 * - 6-column grid with gap-4 (16px)
 * - p-6 container padding (48px)
 * - p-2 card padding (16px)
 */
export function calculatePOSFontSizes(): POSFontSizes {
  const dimensions = getDeviceScreenDimensions();
  
  if (!dimensions) {
    // Fallback to reasonable defaults if no device bound
    return {
      cardTitle: 16,
      price: 14,
      description: 12,
      badge: 10,
    };
  }

  // Use viewport width for calculations (adapts to orientation)
  const viewportWidth = dimensions.viewportWidth;
  
  // Layout calculations
  const sidebarWidth = 72;
  const posMenuWidthPercent = 0.65; // 65% of remaining space
  const gridCols = 6;
  const gridGapPx = 16; // gap-4 = 1rem = 16px
  const totalGaps = (gridCols - 1) * gridGapPx; // 5 gaps × 16px = 80px
  const containerPadding = 48; // p-6 = 24px × 2 = 48px
  const cardPadding = 16; // p-2 = 8px × 2 = 16px
  
  // Calculate available width for menu column
  const afterSidebar = viewportWidth - sidebarWidth;
  const menuColumnWidth = afterSidebar * posMenuWidthPercent;
  const availableWidth = menuColumnWidth - containerPadding;
  const cardWidth = (availableWidth - totalGaps) / gridCols;
  const textWidth = cardWidth - cardPadding;
  
  // Calculate font size to fit minimum 11 characters
  // Average character width is ~0.6em for typical fonts
  const minChars = 11;
  const avgCharWidthRatio = 0.6;
  const targetCharWidth = minChars * avgCharWidthRatio;
  
  let cardTitle = Math.floor(textWidth / targetCharWidth);
  
  // Clamp font sizes: 11px minimum, 20px maximum
  cardTitle = Math.max(11, Math.min(20, cardTitle));
  
  // Scale other text relative to title, maintaining readability hierarchy
  const price = Math.max(10, Math.min(18, cardTitle - 2));
  const description = Math.max(9, Math.min(14, cardTitle - 4));
  const badge = Math.max(8, Math.min(12, cardTitle - 5));
  
  // Calculate actual characters that will fit
  const actualCharsPerLine = Math.floor(textWidth / (cardTitle * avgCharWidthRatio));
  
  console.log('📐 POS Font Sizes Calculated:', {
    viewport: `${viewportWidth}x${dimensions.viewportHeight}`,
    layout: {
      sidebar: `${sidebarWidth}px`,
      afterSidebar: `${afterSidebar.toFixed(0)}px`,
      menuColumn: `${menuColumnWidth.toFixed(0)}px (65%)`,
      available: `${availableWidth.toFixed(0)}px`,
    },
    grid: {
      columns: gridCols,
      cardWidth: `${cardWidth.toFixed(1)}px`,
      textWidth: `${textWidth.toFixed(1)}px`,
    },
    sizes: {
      cardTitle: `${cardTitle}px`,
      price: `${price}px`,
      description: `${description}px`,
      badge: `${badge}px`,
    },
    charsPerLine: actualCharsPerLine,
    meetsRequirement: actualCharsPerLine >= minChars ? '✅' : '❌',
  });
  
  return {
    cardTitle,
    price,
    description,
    badge,
  };
}

/**
 * Get font sizes as CSS-in-JS style object
 */
export function getPOSFontSizeStyles(sizes: POSFontSizes) {
  return {
    cardTitle: { 
      fontSize: `${sizes.cardTitle}px`, 
      lineHeight: '1.2' 
    },
    price: { 
      fontSize: `${sizes.price}px`, 
      lineHeight: '1.3' 
    },
    description: { 
      fontSize: `${sizes.description}px`, 
      lineHeight: '1.4' 
    },
    badge: { 
      fontSize: `${sizes.badge}px`, 
      lineHeight: '1' 
    },
  };
}
