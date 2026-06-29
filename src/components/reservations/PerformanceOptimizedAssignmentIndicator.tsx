import React, { memo, useMemo } from 'react';
import { AutoAssignmentIndicator } from './AutoAssignmentIndicator';
import { Reservation } from '@/types/reservation';

interface PerformanceOptimizedAssignmentIndicatorProps {
  reservation: Reservation;
  onManualAssign?: () => void;
  efficiencyScore?: number;
  visualCapacityUsed?: boolean;
  assignmentStrategy?: string;
}

/**
 * Performance-optimized version of AutoAssignmentIndicator
 * Uses memoization to prevent unnecessary re-renders
 */
export const PerformanceOptimizedAssignmentIndicator = memo<PerformanceOptimizedAssignmentIndicatorProps>(({
  reservation,
  onManualAssign,
  efficiencyScore,
  visualCapacityUsed,
  assignmentStrategy
}) => {
  // Memoize indicator data to prevent recalculation
  const indicatorData = useMemo(() => ({
    hasTable: reservation.table_number || (reservation.table_numbers && reservation.table_numbers.length > 0),
    isSpecialStatus: ['cancelled', 'no-show', 'completed'].includes(reservation.status),
    efficiencyScore,
    visualCapacityUsed,
    assignmentStrategy
  }), [
    reservation.table_number,
    reservation.table_numbers,
    reservation.status,
    efficiencyScore,
    visualCapacityUsed,
    assignmentStrategy
  ]);

  return (
    <AutoAssignmentIndicator
      reservation={reservation}
      onManualAssign={onManualAssign}
      efficiencyScore={indicatorData.efficiencyScore}
      visualCapacityUsed={indicatorData.visualCapacityUsed}
      assignmentStrategy={indicatorData.assignmentStrategy}
    />
  );
});

PerformanceOptimizedAssignmentIndicator.displayName = 'PerformanceOptimizedAssignmentIndicator';