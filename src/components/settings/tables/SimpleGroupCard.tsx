import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Settings, 
  Trash2, 
  Pencil, 
  X, 
  Users, 
  Info,
  Zap,
  Calculator,
  Save,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { TableGroupWithTables, Table } from '@/types/table';
import { CollapsibleTableAssignment } from './CollapsibleTableAssignment';

interface SimpleGroupCardProps {
  group: TableGroupWithTables;
  efficiency: number;
  tables: Table[];
  isEditing: boolean;
  onEdit: (groupId: string) => void;
  onCloseEdit: () => void;
  onSave: (groupId: string, changes: { name?: string; capacity?: number; tableChanges?: { tableId: string; isInGroup: boolean }[] }) => void;
  onDelete: (groupId: string) => void;
  onAdvancedSettings: (groupId: string) => void;
  onGroupNameChange: (groupId: string, newName: string) => void;
  onCapacityChange: (groupId: string, newCapacity: number) => void;
  onTableToggle: (tableId: string, groupId: string, isInGroup: boolean) => void;
  isTableInGroup: (tableNumber: number, groupId: string) => boolean;
}

export const SimpleGroupCard = ({
  group,
  efficiency,
  tables,
  isEditing,
  onEdit,
  onCloseEdit,
  onSave,
  onDelete,
  onAdvancedSettings,
  onGroupNameChange,
  onCapacityChange,
  onTableToggle,
  isTableInGroup
}: SimpleGroupCardProps) => {
  // Local state for pending changes during editing
  const [localName, setLocalName] = useState(group.group_name);
  const [localCapacity, setLocalCapacity] = useState(group.max_combined_capacity);
  const [pendingTableChanges, setPendingTableChanges] = useState<{ tableId: string; isInGroup: boolean }[]>([]);
  const [pendingReorderChanges, setPendingReorderChanges] = useState<{ tableId: string; newPosition: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset local state when editing starts/stops or group changes
  useEffect(() => {
    setLocalName(group.group_name);
    setLocalCapacity(group.max_combined_capacity);
    setPendingTableChanges([]);
    setPendingReorderChanges([]);
  }, [group.group_name, group.max_combined_capacity, isEditing]);

  // Handle local table toggle during editing
  const handleLocalTableToggle = (tableId: string, groupId: string, isInGroup: boolean) => {
    if (isEditing) {
      // Add to pending changes
      setPendingTableChanges(prev => {
        const existing = prev.find(change => change.tableId === tableId);
        if (existing) {
          return prev.map(change => 
            change.tableId === tableId ? { ...change, isInGroup } : change
          );
        } else {
          return [...prev, { tableId, isInGroup }];
        }
      });
    } else {
      onTableToggle(tableId, groupId, isInGroup);
    }
  };

  // Check if table is in group (considering pending changes during editing)
  const isTableInGroupLocal = (tableNumber: number, groupId: string) => {
    const table = tables.find(t => t.table_number === tableNumber);
    if (!table) return false;
    
    if (isEditing) {
      const pendingChange = pendingTableChanges.find(change => change.tableId === table.id);
      if (pendingChange) {
        return !pendingChange.isInGroup; // Inverted because isInGroup param means "remove from group"
      }
    }
    
    return isTableInGroup(tableNumber, groupId);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const changes: { 
        name?: string; 
        capacity?: number; 
        tableChanges?: { tableId: string; isInGroup: boolean }[];
        reorderChanges?: { tableId: string; newPosition: number }[];
      } = {};
      
      if (localName !== group.group_name) {
        changes.name = localName;
      }
      
      if (localCapacity !== group.max_combined_capacity) {
        changes.capacity = localCapacity;
      }
      
      if (pendingTableChanges.length > 0) {
        changes.tableChanges = pendingTableChanges;
      }

      if (pendingReorderChanges.length > 0) {
        changes.reorderChanges = pendingReorderChanges;
      }
      
      await onSave(group.group_id, changes);
      
      // Clear pending changes after successful save
      setPendingTableChanges([]);
      setPendingReorderChanges([]);
    } finally {
      setIsSaving(false);
    }
  };

  // Get effective tables (considering pending changes during editing)
  const getEffectiveGroupTables = () => {
    const originalTableNumbers = [...group.table_numbers];
    const newlyAddedTableIds: string[] = [];
    let removedTableNumbers: number[] = [];
    
    // Track additions and removals
    if (isEditing && pendingTableChanges.length > 0) {
      pendingTableChanges.forEach(change => {
        const table = tables.find(t => t.id === change.tableId);
        if (table) {
          if (!change.isInGroup) { // Adding to group (isInGroup is inverted)
            if (!originalTableNumbers.includes(table.table_number)) {
              newlyAddedTableIds.push(change.tableId);
            }
          } else { // Removing from group
            removedTableNumbers.push(table.table_number);
          }
        }
      });
    }
    
    // Get originally existing tables (minus removed ones)
    let effectiveTables = tables.filter(table => 
      originalTableNumbers.includes(table.table_number) && 
      !removedTableNumbers.includes(table.table_number)
    );
    
    // Append newly added tables at the end
    const newlyAddedTables = tables.filter(table => 
      newlyAddedTableIds.includes(table.id)
    );
    effectiveTables = [...effectiveTables, ...newlyAddedTables];

    // Apply reorder changes if editing
    if (isEditing && pendingReorderChanges.length > 0) {
      // Sort by the new positions
      effectiveTables = [...effectiveTables].sort((a, b) => {
        const reorderA = pendingReorderChanges.find(r => r.tableId === a.id);
        const reorderB = pendingReorderChanges.find(r => r.tableId === b.id);
        
        const posA = reorderA?.newPosition ?? effectiveTables.indexOf(a);
        const posB = reorderB?.newPosition ?? effectiveTables.indexOf(b);
        
        return posA - posB;
      });
    }
    
    return effectiveTables;
  };

  const handleMoveUp = (tableId: string) => {
    const effectiveTables = getEffectiveGroupTables();
    const currentIndex = effectiveTables.findIndex(t => t.id === tableId);
    
    if (currentIndex <= 0) return; // Already at top
    
    // Swap with previous table
    const newOrder = pendingReorderChanges.length > 0 ? [...pendingReorderChanges] : [];
    
    // Update both tables' positions
    const currentTableReorder = { tableId: effectiveTables[currentIndex].id, newPosition: currentIndex - 1 };
    const previousTableReorder = { tableId: effectiveTables[currentIndex - 1].id, newPosition: currentIndex };
    
    // Remove existing entries for these tables
    const filtered = newOrder.filter(r => r.tableId !== tableId && r.tableId !== effectiveTables[currentIndex - 1].id);
    
    setPendingReorderChanges([...filtered, currentTableReorder, previousTableReorder]);
  };

  const handleMoveDown = (tableId: string) => {
    const effectiveTables = getEffectiveGroupTables();
    const currentIndex = effectiveTables.findIndex(t => t.id === tableId);
    
    if (currentIndex >= effectiveTables.length - 1) return; // Already at bottom
    
    // Swap with next table
    const newOrder = pendingReorderChanges.length > 0 ? [...pendingReorderChanges] : [];
    
    // Update both tables' positions
    const currentTableReorder = { tableId: effectiveTables[currentIndex].id, newPosition: currentIndex + 1 };
    const nextTableReorder = { tableId: effectiveTables[currentIndex + 1].id, newPosition: currentIndex };
    
    // Remove existing entries for these tables
    const filtered = newOrder.filter(r => r.tableId !== tableId && r.tableId !== effectiveTables[currentIndex + 1].id);
    
    setPendingReorderChanges([...filtered, currentTableReorder, nextTableReorder]);
  };

  const effectiveGroupTables = getEffectiveGroupTables();

  const calculateCapacityMetrics = () => {
    const effectiveTables = getEffectiveGroupTables();
    const totalIndividualSeats = effectiveTables.reduce((sum, table) => sum + table.seats, 0);
    const availableSeats = group.max_combined_capacity || 0; // Available Seats = source of truth for bookings
    // Efficiency shows how well Available Seats configuration utilizes Individual Total
    const efficiency = totalIndividualSeats > 0 ? Math.round((availableSeats / totalIndividualSeats) * 100) : 0;
    
    return {
      totalIndividualSeats,
      availableSeats, // This is what booking logic uses
      efficiency
    };
  };

  const metrics = calculateCapacityMetrics();
  
  // Use passed efficiency or calculated efficiency from Available Seats vs Individual Total
  const displayEfficiency = efficiency || metrics.efficiency;

  const getGroupStatusBadge = () => {
    const outOfServiceCount = group.out_of_service_tables?.length || 0;
    const totalTables = group.table_numbers?.length || 0;
    
    if (outOfServiceCount > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          {outOfServiceCount} out of service
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-xs">
        {totalTables} tables
      </Badge>
    );
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-emerald-600";
    if (efficiency >= 75) return "text-yellow-600"; 
    return "text-orange-600";
  };

  const getEfficiencyBadgeVariant = (efficiency: number) => {
    if (efficiency >= 90) return "default";
    if (efficiency >= 75) return "secondary";
    return "destructive";
  };

  return (
    <Card className="relative transition-all duration-200 hover:shadow-md">
      {/* Efficiency Badge */}
      <div className="absolute -top-2 -left-2 z-10">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge 
                variant={getEfficiencyBadgeVariant(displayEfficiency)} 
                className="h-6 w-6 rounded-full p-0 flex items-center justify-center"
              >
                <Zap className="h-3 w-3" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{displayEfficiency}% Efficiency</p>
              <p className="text-xs opacity-80">Smart selection based on seat optimization</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {isEditing ? (
            <Input
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              className="text-base font-semibold border-none shadow-none p-0 h-auto bg-transparent focus-visible:ring-0"
              placeholder="Group name"
            />
          ) : (
            <CardTitle className="text-base flex items-center gap-2">
              {group.group_name}
            </CardTitle>
          )}
          
          <div className="flex items-center gap-1">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCloseEdit}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-7 px-2"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(group.group_id)}
                  className="h-7 w-7 p-0"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(group.group_id)}
                  className="h-7 w-7 p-0"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getGroupStatusBadge()}
          <Badge 
            variant={getEfficiencyBadgeVariant(displayEfficiency)} 
            className="text-xs flex items-center gap-1"
          >
            <Zap className="h-2 w-2" />
            {displayEfficiency}% efficient
          </Badge>
        </div>

        {group.description && (
          <CardDescription className="text-xs">{group.description}</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Visual Capacity Preview */}
        <div className="bg-secondary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Capacity Analysis</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>Smart capacity calculation based on table arrangement and connection efficiency.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Individual Total</div>
              <div className="font-mono font-medium">{metrics.totalIndividualSeats} seats</div>
            </div>
          </div>
        </div>
        
        <div>
          <Label className="text-xs font-medium flex items-center gap-2">
            Tables in Group
            <Badge variant="outline" className="text-xs">
              {effectiveGroupTables.length} tables
            </Badge>
          </Label>
          <div className="space-y-1 mt-2">
            {effectiveGroupTables.length > 0 ? (
              effectiveGroupTables.map((table, index) => {
                const tableNumber = table.table_number;
                const isOutOfService = group.out_of_service_tables?.includes(tableNumber);
                
                // Check if this is a pending addition
                const isPendingAddition = isEditing && pendingTableChanges.find(change => 
                  change.tableId === table.id && !change.isInGroup
                );
                
                // Check if this is a pending removal
                const isPendingRemoval = isEditing && pendingTableChanges.find(change => 
                  change.tableId === table.id && change.isInGroup
                );
                
                const isFirst = index === 0;
                const isLast = index === effectiveGroupTables.length - 1;
                
                return (
                  <div 
                    key={tableNumber} 
                    className={`flex items-center justify-between rounded px-2 py-1 ${
                      isOutOfService 
                        ? 'bg-destructive/10 border border-destructive/20' 
                        : isPendingAddition 
                          ? 'bg-blue-50 border border-blue-200' 
                          : isPendingRemoval
                            ? 'bg-red-50 border border-red-200 opacity-50'
                            : 'bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isEditing && !isPendingRemoval && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveUp(table.id)}
                            disabled={isFirst}
                            className="h-5 w-5 p-0 hover:bg-secondary"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveDown(table.id)}
                            disabled={isLast}
                            className="h-5 w-5 p-0 hover:bg-secondary"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-muted-foreground mx-1">#{index + 1}</span>
                        </div>
                      )}
                      <span className={`text-xs ${
                        isOutOfService 
                          ? 'text-destructive' 
                          : isPendingRemoval 
                            ? 'text-red-600 line-through' 
                            : ''
                      }`}>
                        Table {tableNumber} ({table.seats} seats)
                        {isOutOfService && ' - Out of Service'}
                      </span>
                      {isPendingAddition && (
                        <Badge variant="outline" className="text-xs h-4 px-1 bg-blue-100 text-blue-700 border-blue-300">
                          New
                        </Badge>
                      )}
                      {isPendingRemoval && (
                        <Badge variant="outline" className="text-xs h-4 px-1 bg-red-100 text-red-700 border-red-300">
                          Remove
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-muted-foreground">No tables assigned</span>
            )}
          </div>
        </div>

        {isEditing && (
          <CollapsibleTableAssignment
            tables={tables}
            groupId={group.group_id}
            isTableInGroup={isTableInGroupLocal}
            onTableToggle={handleLocalTableToggle}
          />
        )}
      </CardContent>
    </Card>
  );
};