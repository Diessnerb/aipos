import { useContext } from 'react';
import { DisplayScaleContext } from '@/contexts/DisplayScaleContext';

/**
 * Hook to access display scale context
 * Provides current scale factor and preference controls
 */
export function useDisplayScale() {
  const context = useContext(DisplayScaleContext);
  if (context === undefined) {
    throw new Error('useDisplayScale must be used within a DisplayScaleProvider');
  }
  return context;
}
