import type { ScalePreference } from '@/contexts/DisplayScaleContext';

/**
 * Calculate automatic scale factor based on screen width
 * Uses a smooth curve to scale UI proportionally
 */
export function calculateAutoScale(screenWidth: number): number {
  // Base reference: 1920px = 1.0 scale (100%)
  const baseWidth = 1920;
  
  // Define breakpoints with their ideal scales
  if (screenWidth >= 1920) return 1.0;      // Large screens: 100%
  if (screenWidth >= 1600) return 0.95;     // Medium-large: 95%
  if (screenWidth >= 1440) return 0.90;     // Medium: 90%
  if (screenWidth >= 1366) return 0.85;     // Medium tablets: 85%
  if (screenWidth >= 1280) return 0.80;     // Small tablets: 80%
  if (screenWidth >= 1024) return 0.70;     // Mini tablets: 70%
  
  // For very small screens, use minimum scale
  return 0.65; // Minimum 65% scale
}

/**
 * Get scale factor from user preference
 */
export function getScaleFromPreference(
  preference: ScalePreference,
  screenWidth: number
): number {
  switch (preference) {
    case 'large':
      return 1.0;
    case 'medium':
      return 0.85;
    case 'small':
      return 0.75;
    case 'auto':
    default:
      return calculateAutoScale(screenWidth);
  }
}

/**
 * Apply scale to document root
 * Sets CSS custom properties that components can use
 */
export function applyScaleToDocument(scale: number): void {
  const root = document.documentElement;
  
  // Set main scale variable
  root.style.setProperty('--app-scale', scale.toString());
  
  // Scale base font size (affects all rem units throughout app)
  root.style.fontSize = `${16 * scale}px`; // 16px = 1rem default
  
  // Sidebar widths scale automatically via rem units
  root.style.setProperty('--sidebar-width-expanded', '16rem');
  root.style.setProperty('--sidebar-width-collapsed', '4.5rem');
  
  console.log('📐 Display scale applied:', {
    scale: `${(scale * 100).toFixed(0)}%`,
    screenWidth: `${window.innerWidth}px`,
    baseFontSize: `${16 * scale}px`,
  });
}

/**
 * Get current scale from CSS variable
 */
export function getCurrentScale(): number {
  const scale = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-scale');
  return parseFloat(scale) || 1.0;
}
