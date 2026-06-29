import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { useTableGroups } from '@/hooks/useTableGroups';
import { checkTableAvailability, detectAccessibilityNeeds } from '@/utils/autoTableAssignment';
import { Reservation } from '@/types/reservation';
import { Table, TableGroupWithTables } from '@/types/table';
import { TableAssignmentOrchestrator } from '@/services/tableAssignmentOrchestrator';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface ManualAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  existingReservations: Reservation[];
  onAssign: (tableNumber: number) => void;
  onGroupAssign?: (tableNumbers: number[]) => void;
}

export const ManualAssignmentModal = ({
  open,
  onOpenChange,
  reservation,
  existingReservations,
  onAssign,
  onGroupAssign
}: ManualAssignmentModalProps) => {
  const { tables: allTables } = useTablesQuery();
  const { tableGroups } = useTableGroups();
  const { companyId } = useAuth();
  const { toast } = useToast();
  
  // Filter operational tables - exclude temporarily_removed but keep out_of_service for display as disabled
  const operationalTables = allTables.filter(t => 
    t.is_active && 
    (t.service_status !== 'temporarily_removed')
  );
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [availableGroups, setAvailableGroups] = useState<TableGroupWithTables[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<number[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const needsAccessibility = reservation ? detectAccessibilityNeeds(reservation).needsAccessible : false;

  useEffect(() => {
    if (!reservation) return;

    // Filter individual tables based on requirements
    const suitableTables = operationalTables.filter(table => {
      // Check if table has enough seats
      if (table.seats < reservation.party_size) return false;
      
      // Check accessibility requirements
      if (needsAccessibility && !table.accessibility_friendly) return false;
      
      // Check if table is out of service
      if (table.service_status === 'out_of_service') return false;
      
      // Check availability at the reservation time
      const isAvailable = checkTableAvailability(
        table.table_number,
        reservation.date,
        reservation.time,
        existingReservations,
        reservation.id
      );
      
      return isAvailable;
    });

    // Filter available table groups
    const suitableGroups = tableGroups.filter(group => {
      // Check if group has sufficient capacity
      if (!group.max_combined_capacity || group.max_combined_capacity < reservation.party_size) {
        return false;
      }
      
      // Check if all tables in the group are available
      if (!group.table_numbers || group.table_numbers.length === 0) {
        return false;
      }
      
      return group.table_numbers.every(tableNumber => {
        const table = operationalTables.find(t => t.table_number === tableNumber);
        if (!table) return false;
        
        // Check accessibility if needed
        if (needsAccessibility && !table.accessibility_friendly) return false;
        
        // Check if table is out of service
        if (table.service_status === 'out_of_service') return false;
        
        // Check availability
        return checkTableAvailability(
          tableNumber,
          reservation.date,
          reservation.time,
          existingReservations,
          reservation.id
        );
      });
    });

    setAvailableTables(suitableTables);
    setAvailableGroups(suitableGroups);
    setSelectedTable('');
    setSelectedGroup('');
    
    // Get smart suggestions in background
    if (companyId && reservation) {
      loadSmartSuggestions();
    }
  }, [reservation, operationalTables, tableGroups, existingReservations, needsAccessibility]);

  const loadSmartSuggestions = async () => {
    if (!companyId || !reservation) return;
    
    setIsLoadingSuggestions(true);
    try {
      // Use orchestrator for suggestions
      const result = await TableAssignmentOrchestrator.autoAssignTables(
        companyId,
        reservation.party_size,
        reservation.date,
        reservation.time,
        reservation
      );
      
      if (result.success && result.tables) {
        setSmartSuggestions(result.tables);
      }
    } catch (error) {
      console.error('Failed to load smart suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!companyId || !reservation) return;
    
    try {
      const result = await TableAssignmentOrchestrator.autoAssignTables(
        companyId,
        reservation.party_size,
        reservation.date,
        reservation.time,
        reservation
      );
      
      if (result.success && result.tables?.length === 1) {
        onAssign(result.tables[0]);
        onOpenChange(false);
        
        toast({
          title: "Smart Assignment Complete",
          description: `Table ${result.tables[0]} assigned using ${result.strategy} strategy`,
        });
      } else if (result.tables?.length > 1) {
        if (onGroupAssign) {
          onGroupAssign(result.tables);
          onOpenChange(false);
          
          toast({
            title: "Table Group Assigned",
            description: `Assigned to tables ${result.tables.join(', ')}`,
          });
        } else {
          toast({
            title: "Multi-Table Assignment",
            description: `Requires tables ${result.tables.join(', ')} - please use main assignment`,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "No Assignment Available", 
          description: result.reason || 'No suitable tables found',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Auto-assignment failed:', error);
      toast({
        title: "Assignment Failed",
        description: 'Smart assignment failed. Please select manually.',
        variant: "destructive"
      });
    }
  };

  const handleAssign = () => {
    if (selectedTable) {
      onAssign(parseInt(selectedTable));
      onOpenChange(false);
      setSelectedTable('');
      setSelectedGroup('');
    } else if (selectedGroup && onGroupAssign) {
      const group = availableGroups.find(g => g.group_id === selectedGroup);
      if (group && group.table_numbers) {
        onGroupAssign(group.table_numbers);
        onOpenChange(false);
        setSelectedTable('');
        setSelectedGroup('');
      }
    }
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manually Assign Table</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Reservation Details</Label>
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="font-medium">{reservation.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                {reservation.party_size} people • {reservation.date} at {reservation.time}
              </p>
              {needsAccessibility && (
                <Badge variant="destructive" className="text-xs">
                  Requires Accessible Table
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="table-select" className="text-sm font-medium">
                Individual Tables ({availableTables.length} options)
              </Label>
              {smartSuggestions.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Smart Suggestion: {smartSuggestions.join(', ')}
                </Badge>
              )}
            </div>
            <Select value={selectedTable} onValueChange={(value) => { setSelectedTable(value); setSelectedGroup(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select an individual table..." />
              </SelectTrigger>
              <SelectContent>
                {availableTables.map((table) => (
                  <SelectItem key={table.id} value={table.table_number.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>Table {table.table_number} ({table.table_name})</span>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="outline" className="text-xs">
                          {table.seats} seats
                        </Badge>
                        {table.accessibility_friendly && (
                          <Badge variant="secondary" className="text-xs">
                            Accessible
                          </Badge>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {availableTables.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {needsAccessibility 
                  ? "No accessible individual tables available for this time slot" 
                  : "No suitable individual tables available for this time slot"}
              </p>
            )}
          </div>

          {availableGroups.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="group-select" className="text-sm font-medium">
                Table Groups ({availableGroups.length} available)
              </Label>
            <Select value={selectedGroup} onValueChange={(value) => { setSelectedGroup(value); setSelectedTable(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a table group..." />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((group) => (
                  <SelectItem key={group.group_id} value={group.group_id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{group.group_name}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="outline" className="text-xs">
                          {group.max_combined_capacity} available seats
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Tables: {group.table_numbers?.join(', ')}
                        </Badge>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <Button 
              variant="outline" 
              onClick={handleAutoAssign}
              disabled={isLoadingSuggestions}
              className="border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              {isLoadingSuggestions ? 'Loading...' : 'Smart Auto-Assign'}
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssign} 
                disabled={!selectedTable && !selectedGroup}
              >
                {selectedGroup ? 'Assign Table Group' : 'Assign Table'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};