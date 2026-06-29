import { useCallback } from 'react';

interface UseReservationRefreshProps {
  onReservationUpdate: () => void;
}

export const useReservationRefresh = ({
  onReservationUpdate
}: UseReservationRefreshProps) => {
  const forceRefresh = useCallback(() => {
    console.log('=== MANUAL TIMELINE REFRESH TRIGGERED ===');
    onReservationUpdate();
  }, [onReservationUpdate]);

  return {
    forceRefresh
  };
};