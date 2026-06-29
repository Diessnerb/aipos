import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Reservation } from "@/types/reservation";
import { detectAccessibilityNeeds } from "@/utils/autoTableAssignment";
import { VisualEfficiencyIndicator } from "./VisualEfficiencyIndicator";

interface AutoAssignmentIndicatorProps {
  reservation: Reservation;
  onManualAssign?: () => void;
  efficiencyScore?: number;
  visualCapacityUsed?: boolean;
  assignmentStrategy?: string;
}

export const AutoAssignmentIndicator = ({ 
  reservation, 
  onManualAssign,
  efficiencyScore,
  visualCapacityUsed = false,
  assignmentStrategy
}: AutoAssignmentIndicatorProps) => {
  const hasTable = reservation.table_number || (reservation.table_numbers && reservation.table_numbers.length > 0);
  const { needsAccessible: needsAccessibility } = detectAccessibilityNeeds(reservation);
  const isSpecialStatus = ['cancelled', 'no-show', 'completed'].includes(reservation.status);

  if (isSpecialStatus) {
    return null; // Don't show indicator for these statuses
  }

  if (hasTable) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Table Assigned
        </Badge>
        <VisualEfficiencyIndicator
          efficiencyScore={efficiencyScore}
          visualCapacityUsed={visualCapacityUsed}
          size="sm"
        />
        {assignmentStrategy === 'visual-efficiency' && (
          <Badge variant="outline" className="text-xs">
            AI Optimized
          </Badge>
        )}
      </div>
    );
  }

  if (needsAccessibility) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Needs Accessible Table
        </Badge>
        {onManualAssign && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onManualAssign}
            className="h-6 text-xs"
          >
            Assign Manually
          </Button>
        )}
      </div>
    );
  }

  if (reservation.party_size > 10) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Large Party - Manual Assignment Required
        </Badge>
        {onManualAssign && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onManualAssign}
            className="h-6 text-xs"
          >
            Assign Tables
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Awaiting Auto-Assignment
      </Badge>
      {onManualAssign && (
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onManualAssign}
          className="h-6 text-xs"
        >
          Assign Manually
        </Button>
      )}
    </div>
  );
};