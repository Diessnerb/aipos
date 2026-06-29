import React from 'react';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';

interface InstantPageProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper component that eliminates loading states for device-bound scenarios
 * When device is bound, renders children immediately with no loading indicators
 * When not bound, shows normal loading patterns
 */
export const InstantPage: React.FC<InstantPageProps> = ({ children, fallback }) => {
  const deviceLive = useDeviceLiveLayer();

  // For bound devices: render immediately, no loading states
  if (deviceLive) {
    return <>{children}</>;
  }

  // For non-bound devices: use fallback if provided
  return fallback ? <>{fallback}</> : <>{children}</>;
};
