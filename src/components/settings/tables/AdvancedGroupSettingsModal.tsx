import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { TableGroupWithTables, AdvancedGroupSettings, Table } from '@/types/table';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { useTableGroups } from '@/hooks/useTableGroups';
import { SimpleTableLayoutEditor } from './SimpleTableLayoutEditor';
import { toast } from 'sonner';

interface AdvancedGroupSettingsModalProps {
  group: TableGroupWithTables;
  isOpen: boolean;
  onClose: () => void;
  onSave: (groupId: string, settings: AdvancedGroupSettings) => Promise<void>;
}

export const AdvancedGroupSettingsModal = ({
  group,
  isOpen,
  onClose,
  onSave
}: AdvancedGroupSettingsModalProps) => {
  const { tables } = useTablesQuery();
  const { saveGroupArrangement } = useTableGroups();
  const [loading, setLoading] = useState(false);
  const [arrangementData, setArrangementData] = useState<any>(null);

  // Get tables that belong to this group
  const groupTables = tables.filter(table => 
    group.table_numbers.includes(table.table_number)
  );

  const handleLayoutSave = async (data: any) => {
    setArrangementData(data);
    toast.success('Layout configuration updated');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (arrangementData) {
        await saveGroupArrangement(group.group_id, arrangementData);
      }
      
      toast.success('Table layout saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save table layout:', error);
      toast.error('Failed to save layout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[95vw] h-[min(95vh,900px)] min-h-[600px] max-h-screen flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Table Layout Settings - {group?.group_name}
          </DialogTitle>
          <DialogDescription>
            Configure your table arrangement and seating layout for optimal service efficiency.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <SimpleTableLayoutEditor
            tables={groupTables}
            groupName={group.group_name}
            onSave={handleLayoutSave}
          />
        </div>

        <DialogFooter className="flex-shrink-0 flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Layout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};