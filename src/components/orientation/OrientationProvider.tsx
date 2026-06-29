import { useEffect } from 'react';
import { orientationManager } from '@/utils/orientationManager';
import { isDeviceBound } from '@/utils/deviceBinding';

export const OrientationProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Only initialize if device is bound
    if (isDeviceBound()) {
      orientationManager.initialize();
    }

    return () => {
      orientationManager.destroy();
    };
  }, []);

  return <>{children}</>;
};
