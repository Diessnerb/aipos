import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  GripVertical, 
  Settings, 
  Trash2, 
  Pencil, 
  X, 
  Users, 
  ArrowUp, 
  ArrowDown, 
  Info,
  Hash,
  Zap
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { TableGroupWithTables, Table } from '@/types/table';

interface DraggableGroupCardProps {
  group: TableGroupWithTables;
  groupIndex: number;
  totalGroups: number;
  tables: Table[];
  isEditing: boolean;
  onEdit: (groupId: string) => void;
  onCloseEdit: () => void;
  onDelete: (groupId: string) => void;
  onAdvancedSettings: (groupId: string) => void;
  onGroupNameChange: (groupId: string, newName: string) => void;
  onCapacityChange: (groupId: string, newCapacity: number) => void;
  onMoveTable: (tableId: string, tableNumber: number, groupId: string, direction: 'up' | 'down') => void;
  onTableToggle: (tableId: string, groupId: string, isInGroup: boolean) => void;
  onMoveGroup: (groupId: string, direction: 'up' | 'down') => void;
  isTableInGroup: (tableNumber: number, groupId: string) => boolean;
}

export const DraggableGroupCard = ({
  group,
  groupIndex,
  totalGroups,
  tables,
  isEditing,
  onEdit,
  onCloseEdit,
  onDelete,
  onAdvancedSettings,
  onGroupNameChange,
  onCapacityChange,
  onMoveTable,
  onTableToggle,
  onMoveGroup,
  isTableInGroup
}: DraggableGroupCardProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const getTablesInGroup = (groupId: string) => {
    return group.table_numbers || [];
  };

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
    
    if (!group.can_combine) {
      return (
        <Badge variant="secondary" className="text-xs">
          Cannot combine
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-xs">
        {totalTables} tables
      </Badge>
    );
  };

  return (
    <Card 
      className={`relative transition-all duration-200 min-w-0 ${
        isDragging ? 'shadow-lg scale-105 rotate-1' : 'hover:shadow-md'
      }`}
    >
      {/* Priority Badge */}
      <div className="absolute -top-2 -left-2 z-10">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="default" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                <Hash className="h-3 w-3" />
                <span className="text-xs font-bold">{groupIndex + 1}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Assignment Priority #{groupIndex + 1}</p>
              <p className="text-xs opacity-80">Groups are checked in this order</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Drag Handle */}
      <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10">
        <div className="flex flex-col gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-background border shadow-sm"
                  onClick={() => onMoveGroup(group.group_id, 'up')}
                  disabled={groupIndex === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Move up in priority</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div 
            className="bg-background border rounded p-1 shadow-sm cursor-move flex items-center justify-center"
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-background border shadow-sm"
                  onClick={() => onMoveGroup(group.group_id, 'down')}
                  disabled={groupIndex === totalGroups - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Move down in priority</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {isEditing ? (
            <Input
              value={group.group_name}
              onChange={(e) => onGroupNameChange(group.group_id, e.target.value)}
              className="text-base font-semibold border-none shadow-none p-0 h-auto bg-transparent focus-visible:ring-0"
              placeholder="Group name"
            />
          ) : (
            <CardTitle className="text-base flex items-center gap-2">
              {group.group_name}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p><strong>Priority #{groupIndex + 1}</strong></p>
                    <p>This group is checked {groupIndex === 0 ? 'first' : `${groupIndex + 1}${getOrdinalSuffix(groupIndex + 1)}`} when assigning tables.</p>
                    {group.advanced_settings?.capacity_mode && (
                      <p className="mt-1 text-xs opacity-80">
                        Capacity mode: {group.advanced_settings.capacity_mode}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          )}
          
          <div className="flex items-center gap-2">
            {/* Advanced Settings Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAdvancedSettings(group.group_id)}
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Advanced Settings</p>
                  <p className="text-xs opacity-80">Capacity modes, selection rules</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCloseEdit}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(group.group_id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(group.group_id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getGroupStatusBadge()}
          {group.advanced_settings?.capacity_mode !== 'auto' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Advanced
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Uses advanced capacity settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {group.description && (
          <CardDescription className="text-xs">{group.description}</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Label htmlFor={`capacity-${group.group_id}`} className="text-xs font-medium">Max Capacity:</Label>
              <Input
                id={`capacity-${group.group_id}`}
                type="number"
                value={group.max_combined_capacity}
                onChange={(e) => onCapacityChange(group.group_id, parseInt(e.target.value) || 2)}
                min={2}
                max={50}
                className="w-20 h-8 text-xs"
              />
              <span className="text-xs">people</span>
            </div>
          ) : (
            <span>Max: {group.max_combined_capacity} people</span>
          )}
        </div>
        
        <div>
          <Label className="text-xs font-medium flex items-center gap-2">
            Tables in Group (Priority Order)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>Tables are selected in this order when making assignments.</p>
                  <p className="text-xs opacity-80 mt-1">Use arrows to reorder within the group.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="space-y-1 mt-2">
            {group.table_numbers.length > 0 ? (
              group.table_numbers.map((tableNumber, index) => {
                const table = tables.find(t => t.table_number === tableNumber);
                if (!table) return null;
                const isOutOfService = group.out_of_service_tables?.includes(tableNumber);
                
                return (
                  <div 
                    key={tableNumber} 
                    className={`flex items-center justify-between rounded px-2 py-1 ${
                      isOutOfService ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <span className={`text-xs ${isOutOfService ? 'text-destructive' : ''}`}>
                        Table {tableNumber} ({table.seats} seats)
                        {isOutOfService && ' - Out of Service'}
                      </span>
                    </div>
                    {isEditing && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onMoveTable(table.id, tableNumber, group.group_id, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onMoveTable(table.id, tableNumber, group.group_id, 'down')}
                          disabled={index === group.table_numbers.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-muted-foreground">No tables assigned</span>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="border-t pt-3">
            <Label className="text-xs font-medium">Assign Tables</Label>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {tables
                .filter(table => table.can_combine)
                .map((table) => (
                  <div key={table.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`table-${table.id}-${group.group_id}`}
                      checked={isTableInGroup(table.table_number, group.group_id)}
                      onCheckedChange={(checked) => 
                        onTableToggle(table.id, group.group_id, !checked)
                      }
                    />
                    <Label 
                      htmlFor={`table-${table.id}-${group.group_id}`}
                      className="text-xs"
                    >
                      Table {table.table_number} ({table.seats} seats)
                    </Label>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Helper function for ordinal suffixes
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
}