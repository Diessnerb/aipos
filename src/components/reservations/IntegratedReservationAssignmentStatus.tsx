import React from 'react';
import { EnhancedAutoAssignmentStatus } from './EnhancedAutoAssignmentStatus';
import { useVisualEfficiencyAnalytics } from '@/hooks/useVisualEfficiencyAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface IntegratedReservationAssignmentStatusProps {
  unassignedCount: number;
  totalReservations: number;
  onTriggerAssignment?: () => void;
  assignmentInProgress?: boolean;
  lastAssignmentTime?: Date;
  assignmentSuccessRate?: number;
}

/**
 * Integrated component that combines assignment status with visual efficiency analytics
 */
export const IntegratedReservationAssignmentStatus: React.FC<IntegratedReservationAssignmentStatusProps> = ({
  unassignedCount,
  totalReservations,
  onTriggerAssignment,
  assignmentInProgress,
  lastAssignmentTime,
  assignmentSuccessRate
}) => {
  const { analytics, loading: analyticsLoading } = useVisualEfficiencyAnalytics();

  if (analyticsLoading) {
    return (
      <div className="flex items-center gap-2 p-4 border rounded-lg">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-muted-foreground">Loading assignment analytics...</span>
      </div>
    );
  }

  return (
    <EnhancedAutoAssignmentStatus
      unassignedCount={unassignedCount}
      totalReservations={totalReservations}
      onTriggerAssignment={onTriggerAssignment}
      assignmentInProgress={assignmentInProgress}
      lastAssignmentTime={lastAssignmentTime}
      assignmentSuccessRate={assignmentSuccessRate}
      averageEfficiencyScore={analytics?.averageEfficiencyScore}
      visualAssignmentsCount={analytics?.visualAssignmentsCount}
    />
  );
};