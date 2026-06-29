import { useState, useEffect } from 'react';
import { ReservationConflictService, DoubleBookingAlert } from '@/services/reservationConflictService';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

export interface UseDoubleBookingDetectionResult {
  conflicts: DoubleBookingAlert[];
  loading: boolean;
  error: string | null;
  refetchConflicts: () => Promise<void>;
  hasActiveConflicts: boolean;
  totalConflictCount: number;
}

/**
 * Hook to detect and monitor double bookings in the system
 */
export const useDoubleBookingDetection = (
  autoRefresh: boolean = true,
  refreshInterval: number = 30000, // 30 seconds
  enabled: boolean = true
): UseDoubleBookingDetectionResult => {
  const [conflicts, setConflicts] = useState<DoubleBookingAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { companyId } = useAuth();

  const fetchConflicts = async () => {
    if (!companyId || !enabled) return;

    try {
      setLoading(true);
      setError(null);
      
      const detectedConflicts = await ReservationConflictService.detectDoubleBookings(
        companyId
      );
      
      setConflicts(detectedConflicts);
      
      // Show toast notification for new conflicts
      if (detectedConflicts.length > 0) {
        const totalReservations = detectedConflicts.reduce(
          (sum, conflict) => sum + conflict.reservation_count, 
          0
        );
        
        console.warn(`⚠️ Double booking conflicts detected:`, {
          conflictCount: detectedConflicts.length,
          totalAffectedReservations: totalReservations,
          conflicts: detectedConflicts
        });
      }
      
    } catch (err) {
      console.error('Failed to fetch double booking conflicts:', err);
      setError('Failed to check for double bookings');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchConflicts();
    }
  }, [companyId, enabled]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !companyId || !enabled) return;

    const interval = setInterval(fetchConflicts, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, companyId, enabled]);

  return {
    conflicts,
    loading,
    error,
    refetchConflicts: fetchConflicts,
    hasActiveConflicts: conflicts.length > 0,
    totalConflictCount: conflicts.reduce((sum, conflict) => sum + conflict.reservation_count, 0)
  };
};