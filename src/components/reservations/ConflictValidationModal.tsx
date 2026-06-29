import { Sparkles, Clock, Users, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConflictValidationResult } from '@/services/reservationConflictService';
import { TableAssignmentOrchestrator } from '@/services/tableAssignmentOrchestrator';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ConflictValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictResult: ConflictValidationResult;
  onSelectAlternative?: (tableNumber: number) => void;
  onForceOverride?: () => void;
  onCancel?: () => void;
  onSmartAssign?: (tables: number[]) => void;
  companyId?: string;
  partySize?: number;
  date?: string;
  time?: string;
}

export const ConflictValidationModal = ({
  open,
  onOpenChange,
  conflictResult,
  onSelectAlternative,
  onForceOverride,
  onCancel,
  onSmartAssign,
  companyId,
  partySize,
  date,
  time
}: ConflictValidationModalProps) => {
  const { toast } = useToast();
  const [isSmartAssigning, setIsSmartAssigning] = useState(false);
  
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleSelectTable = (tableNumber: number) => {
    onSelectAlternative?.(tableNumber);
    onOpenChange(false);
  };

  const handleSmartAssign = async () => {
    if (!companyId || !partySize || !date || !time) {
      toast({
        title: "Missing Information",
        description: "Unable to perform smart assignment. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setIsSmartAssigning(true);
    try {
      const result = await TableAssignmentOrchestrator.assignForNewReservation(
        companyId,
        partySize,
        date,
        time,
        false // Don't show toast, we'll handle it here
      );

      if (result.success && result.tables.length > 0) {
        toast({
          title: "Perfect Tables Found!",
          description: `Assigned ${result.strategy}: Tables ${result.tables.join(', ')}`,
        });
        onSmartAssign?.(result.tables);
        onOpenChange(false);
      } else {
        toast({
          title: "No Available Tables",
          description: result.reason || "Unable to find available tables at this time.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Smart assign error:', error);
      toast({
        title: "Assignment Failed",
        description: "Unable to complete smart assignment. Please try manual selection.",
        variant: "destructive"
      });
    } finally {
      setIsSmartAssigning(false);
    }
  };

  if (!conflictResult || !conflictResult.hasConflict) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <Sparkles className="h-5 w-5" />
            Let's Find Perfect Tables
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              This table is already booked at this time, but we can quickly find you perfect alternatives!
            </p>
          </div>

          {/* Smart Assign Button - Primary Action */}
          {onSmartAssign && companyId && partySize && date && time && (
            <Button
              onClick={handleSmartAssign}
              disabled={isSmartAssigning}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              size="lg"
            >
              {isSmartAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finding Optimal Tables...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Smart Assign Tables
                </>
              )}
            </Button>
          )}

          {conflictResult.alternativeTables && conflictResult.alternativeTables.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="text-xs text-muted-foreground">or choose manually</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
              
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Available Alternative Tables
              </h4>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {conflictResult.alternativeTables.map((table) => (
                  <div 
                    key={table.table_number}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleSelectTable(table.table_number)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Table {table.table_number}</span>
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {table.seats} seats
                      </Badge>
                      {table.accessibility_friendly && (
                        <Badge variant="outline" className="text-xs">
                          Accessible
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" variant="outline">
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            
            {conflictResult.alternativeTables?.length === 0 && onForceOverride && (
              <Button
                variant="destructive"
                onClick={() => {
                  onForceOverride();
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                Force Override
              </Button>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
            <strong>Tip:</strong> Smart Assign uses AI to find the best table configuration, including table groups and combinations.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};