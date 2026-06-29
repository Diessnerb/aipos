import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableArrangementEditor } from './TableArrangementEditor';
import { useTableGroups } from '@/hooks/useTableGroups';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { Table, TableArrangement, ConnectionPoint } from '@/types/table';
import { Settings, Eye, Save } from 'lucide-react';
import { toast } from 'sonner';

interface VisualTableGroupArrangementProps {
  groupId: string;
  onClose?: () => void;
}

export const VisualTableGroupArrangement = ({ 
  groupId, 
  onClose 
}: VisualTableGroupArrangementProps) => {
  const { tableGroups, saveGroupArrangement } = useTableGroups();
  const { tables } = useTablesQuery();
  const [arrangements, setArrangements] = useState<TableArrangement[]>([]);
  const [connectionPoints, setConnectionPoints] = useState<ConnectionPoint[]>([]);
  const [saving, setSaving] = useState(false);

  const group = tableGroups.find(g => g.group_id === groupId);
  const groupTables = tables.filter(table => 
    group?.table_numbers?.includes(table.table_number) || false
  );
  const selectedTableIds = groupTables.map(table => table.id);

  useEffect(() => {
    // Load existing arrangement if available
    if (group?.advanced_settings) {
      const visualData = (group.advanced_settings as any)?.visual_arrangement;
      if (visualData?.arrangements) {
        setArrangements(visualData.arrangements);
      }
      if (visualData?.connectionPoints) {
        setConnectionPoints(visualData.connectionPoints);
      }
    }
  }, [group]);

  const handleSave = async (arrangementData: any, seatData: any) => {
    setSaving(true);
    
    try {
      const visualArrangement = {
        arrangements: arrangementData.arrangements,
        connectionPoints: arrangementData.connectionPoints,
        seatPositions: seatData.tableSeatPositions,
        capacity: {
          totalSeats: seatData.totalSeats,
          lostSeats: seatData.lostSeats,
          efficiency: seatData.efficiency,
          actualCapacity: seatData.totalSeats - seatData.lostSeats
        },
        lastUpdated: new Date().toISOString()
      };

      const result = await saveGroupArrangement(groupId, visualArrangement);
      
      if (result.success) {
        toast.success('Visual arrangement saved successfully');
      } else {
        toast.error('Failed to save arrangement');
      }
    } catch (error) {
      console.error('Error saving arrangement:', error);
      toast.error('Failed to save arrangement');
    } finally {
      setSaving(false);
    }
  };

  if (!group) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Group not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Visual Table Arrangement - {group.group_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Arrange tables and seats to optimize capacity and service efficiency
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Tables: {group.table_numbers?.join(', ') || 'None'}
              </Badge>
              {onClose && (
                <Button variant="outline" size="sm" onClick={onClose}>
                  <Eye className="h-4 w-4" />
                  Back to Groups
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {groupTables.length > 0 ? (
        <TableArrangementEditor
          tables={groupTables}
          selectedTableIds={selectedTableIds}
          onArrangementChange={setArrangements}
          onConnectionPointsChange={setConnectionPoints}
          onSave={handleSave}
        />
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              No tables found for this group. Please add tables to the group first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};