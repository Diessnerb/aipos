import { useEffect, useRef } from 'react';
import { updateScreenDimensionsIfChanged } from '@/utils/deviceScreenSize';

interface UseDeviceScreenCheckerOptions {
  enabled?: boolean;
  intensiveMode?: boolean; // 30s for first 5min, then 15min
}

/**
 * Hook to periodically check and update screen dimensions
 * Runs intensive checks (30s) for first 5 minutes after binding,
 * then switches to relaxed checks (15min)
 */
export function useDeviceScreenChecker(options: UseDeviceScreenCheckerOptions = {}) {
  const { enabled = true, intensiveMode = false } = options;
  const intervalRef = useRef<NodeJS.Timeout>();
  const intensiveModeTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!enabled) return;

    // Initial check
    updateScreenDimensionsIfChanged();

    // Determine check interval
    const interval = intensiveMode ? 30000 : 900000; // 30s or 15min

    console.log('📐 Screen checker started:', {
      mode: intensiveMode ? 'intensive (30s)' : 'relaxed (15min)',
      interval: `${interval / 1000}s`,
    });

    // Start periodic checks
    intervalRef.current = setInterval(() => {
      updateScreenDimensionsIfChanged();
    }, interval);

    // If in intensive mode, switch to relaxed after 5 minutes
    if (intensiveMode) {
      intensiveModeTimeoutRef.current = setTimeout(() => {
        console.log('📐 Switching screen checker to relaxed mode (15min intervals)');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        // Start relaxed mode
        intervalRef.current = setInterval(() => {
          updateScreenDimensionsIfChanged();
        }, 900000); // 15 minutes
      }, 300000); // 5 minutes
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (intensiveModeTimeoutRef.current) {
        clearTimeout(intensiveModeTimeoutRef.current);
      }
    };
  }, [enabled, intensiveMode]);

  // Also listen for window resize events for immediate updates
  useEffect(() => {
    if (!enabled) return;

    const handleResize = () => {
      updateScreenDimensionsIfChanged();
      // Trigger scale recalculation
      window.dispatchEvent(new Event('orientationchange'));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [enabled]);
}
