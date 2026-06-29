import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Clock, Zap, Settings, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';

interface EnhancedAutoAssignmentStatusProps {
  unassignedCount: number;
  totalReservations: number;
  onTriggerAssignment?: () => void;
  assignmentInProgress?: boolean;
  lastAssignmentTime?: Date;
  assignmentSuccessRate?: number;
  averageEfficiencyScore?: number;
  visualAssignmentsCount?: number;
}

export const EnhancedAutoAssignmentStatus: React.FC<EnhancedAutoAssignmentStatusProps> = ({
  unassignedCount,
  totalReservations,
  onTriggerAssignment,
  assignmentInProgress = false,
  lastAssignmentTime,
  assignmentSuccessRate = 0,
  averageEfficiencyScore,
  visualAssignmentsCount = 0
}) => {
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useCompanySettings();
  const { checkPermission } = usePermissionCheck();

  const isAdmin = checkPermission('settings/table-assignment', 'admin');
  const autoAssignEnabled = settings?.auto_assign_tables ?? false;

  // Calculate assignment statistics
  const assignedCount = totalReservations - unassignedCount;
  const assignmentRate = totalReservations > 0 ? ((assignedCount / totalReservations) * 100) : 0;

  if (settingsLoading) {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>Loading assignment status...</AlertDescription>
      </Alert>
    );
  }

  if (!autoAssignEnabled) {
    return (
      <Alert variant="destructive">
        <Settings className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Auto-assignment is disabled. Enable it to automatically assign tables to reservations.</span>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/table-assignment')}
              className="ml-4"
            >
              Enable Auto-Assignment
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (unassignedCount === 0) {
    return (
      <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-800 dark:text-green-200">
              All tables assigned successfully! ({assignedCount}/{totalReservations} reservations)
            </span>
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {assignmentRate.toFixed(0)}% assigned
            </Badge>
            {averageEfficiencyScore && (
              <Badge variant="outline" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {averageEfficiencyScore.toFixed(1)}% efficiency
              </Badge>
            )}
            {visualAssignmentsCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {visualAssignmentsCount} visual assignments
              </Badge>
            )}
          </div>
          {lastAssignmentTime && (
            <span className="text-sm text-muted-foreground">
              Last check: {lastAssignmentTime.toLocaleTimeString()}
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800">
      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-orange-800 dark:text-orange-200">
              {unassignedCount} of {totalReservations} reservations need table assignment
            </span>
            <Badge variant="destructive" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              {assignmentRate.toFixed(0)}% assigned
            </Badge>
            {assignmentSuccessRate > 0 && (
              <Badge variant="outline" className="text-xs">
                {assignmentSuccessRate}% success rate
              </Badge>
            )}
            {averageEfficiencyScore && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3" />
                {averageEfficiencyScore.toFixed(1)}% efficiency
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onTriggerAssignment}
              size="sm"
              disabled={assignmentInProgress}
              className="flex items-center gap-1"
            >
              {assignmentInProgress ? (
                <>
                  <Clock className="h-3 w-3 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3" />
                  Auto-Assign Now
                </>
              )}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings/table-assignment')}
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {lastAssignmentTime && (
          <div className="mt-2 text-sm text-muted-foreground">
            Last auto-assignment check: {lastAssignmentTime.toLocaleTimeString()}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};