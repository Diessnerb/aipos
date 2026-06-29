import { AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useNavigate } from 'react-router-dom';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';

interface AutoAssignmentStatusProps {
  unassignedCount: number;
  totalReservations: number;
}

export const AutoAssignmentStatus = ({ 
  unassignedCount, 
  totalReservations 
}: AutoAssignmentStatusProps) => {
  const { settings } = useCompanySettings();
  const navigate = useNavigate();
  const { checkPermission } = usePermissionCheck();

  if (!settings?.auto_assign_tables) {
    return (
      <Card className="border-muted bg-muted/10">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Auto-Assignment Disabled</p>
              <p className="text-xs text-muted-foreground">
                Table auto-assignment is currently disabled
              </p>
            </div>
          </div>
          {checkPermission('/settings/table-assignment', 'admin') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/table-assignment')}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Enable
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (unassignedCount === 0) {
    return (
      <Card className="border-success bg-success/10">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-medium">All Tables Assigned</p>
            <p className="text-xs text-muted-foreground">
              {totalReservations} reservations with tables assigned
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning bg-warning/10">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium">
              {unassignedCount} Unassigned Reservation{unassignedCount > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Some reservations could not be automatically assigned tables
            </p>
          </div>
        </div>
        {checkPermission('/settings/table-assignment', 'admin') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings/table-assignment')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Manage
          </Button>
        )}
      </CardContent>
    </Card>
  );
};