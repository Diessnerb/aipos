import { useState, useEffect, useRef } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Table } from '@/types/table';

interface CollapsibleTableAssignmentProps {
  tables: Table[];
  groupId: string;
  isTableInGroup: (tableNumber: number, groupId: string) => boolean;
  onTableToggle: (tableId: string, groupId: string, isInGroup: boolean) => void;
}

export const CollapsibleTableAssignment = ({
  tables,
  groupId,
  isTableInGroup,
  onTableToggle
}: CollapsibleTableAssignmentProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const availableTables = tables.filter(table => table.can_combine);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [isOpen]);

  return (
    <div className="border-t pt-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center justify-between w-full h-auto p-0 text-xs font-medium hover:bg-transparent"
          >
            <span>Tables ({availableTables.filter(t => isTableInGroup(t.table_number, groupId)).length} assigned)</span>
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0">
          <div ref={contentRef} className="grid grid-cols-2 gap-1 mt-2">
            {availableTables.map((table) => (
              <div key={table.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`table-${table.id}-${groupId}`}
                  checked={isTableInGroup(table.table_number, groupId)}
                  onCheckedChange={(checked) => 
                    onTableToggle(table.id, groupId, !checked)
                  }
                />
                <Label 
                  htmlFor={`table-${table.id}-${groupId}`}
                  className="text-xs cursor-pointer"
                >
                  Table {table.table_number} ({table.seats} seats)
                </Label>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};