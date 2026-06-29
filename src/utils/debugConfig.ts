// Debug configuration to reduce excessive logging in production
export const DEBUG_CONFIG = {
  // Enable detailed logging only in development or when explicitly enabled
  enableVerboseLogging: process.env.NODE_ENV === 'development',
  
  // Specific debug flags for different areas
  permissions: false,  // Disable verbose permission logging
  auth: false,         // Disable verbose auth logging
  optimization: false, // Disable verbose optimization logging
  realtime: false,     // Disable verbose realtime logging
  kitchen: true,       // Enable kitchen notifications debugging
  
  // Toast configuration - disable all system-generated toasts
  showSettingsToasts: false,        // Disable toasts on settings pages
  showSystemToasts: false,          // Disable system-level toasts
  showSmartAssignmentToasts: false, // Disable smart assignment toasts
  showAutoAssignmentToasts: false,  // Disable auto-assignment toasts
  showEditToasts: false,            // Disable edit operation toasts
  showCreateToasts: false,          // Disable create operation toasts
};

/**
 * Conditional console.log that respects debug configuration
 */
export const debugLog = (category: keyof typeof DEBUG_CONFIG, message: string, ...args: any[]) => {
  if (DEBUG_CONFIG.enableVerboseLogging && DEBUG_CONFIG[category]) {
    console.log(`[${category.toUpperCase()}] ${message}`, ...args);
  }
};

/**
 * Check if we're on a settings-related page to determine toast behavior
 */
export const isOnSettingsPage = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path.includes('/settings') || path.includes('/company-settings');
};