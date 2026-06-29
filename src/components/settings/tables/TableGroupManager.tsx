import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Info, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTableGroups } from '@/hooks/useTableGroups';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TableGroup } from '@/types/table';
import { toast } from 'sonner';
import { SimpleGroupCard } from './SimpleGroupCard';
import { AdvancedGroupSettingsModal } from './AdvancedGroupSettingsModal';
import { CollapsibleTableAssignment } from './CollapsibleTableAssignment';
import { ArrowUp, ArrowDown, X } from 'lucide-react';

export const TableGroupManager = () => {
  const deviceLive = useDeviceLiveLayer();
  const {
    tableGroups,
    loading: groupsLoading,
    error,
    fetchTableGroups,
    createTableGroup,
    updateTableGroup,
    deleteTableGroup,
    addTableToGroup,
    removeTableFromGroup,
    resequenceGroup,
    updateTableGroupOptimistic,
    updateAdvancedSettings,
    getOptimalGroupForPartySize,
    calculateGroupEfficiency
  } = useTableGroups();
  const { tables, loading: tablesLoading } = useTablesQuery();
  const { currentUser } = useCurrentUser();
  
  // Hide loading when device is live and we have data
  const loading = !deviceLive && (groupsLoading || tablesLoading);
  const showLoading = loading && !tableGroups.length && !tables.length;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [editingTableAssignments, setEditingTableAssignments] = useState<string | null>(null);
  const [selectedGroupForAdvanced, setSelectedGroupForAdvanced] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    group_name: '',
    description: '',
    max_combined_capacity: 8,
    display_order: 0
  });
  const [createDialogSelectedTables, setCreateDialogSelectedTables] = useState<string[]>([]);
  const [createDialogTableOrder, setCreateDialogTableOrder] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    console.log('🚀 TableGroupManager: useEffect triggered', { 
      deviceLive, 
      currentUser: currentUser?.company_id,
      tableGroupsCount: tableGroups.length 
    });
    
    if (currentUser?.company_id) {
      fetchTableGroups();
    }
  }, [currentUser?.company_id, fetchTableGroups]);

  const handleCreateGroup = async () => {
    try {
      const newGroup = await createTableGroup({
        ...formData,
        is_active: true
      });
      
      // Add selected tables with their priorities after group is created
      if (newGroup && createDialogSelectedTables.length > 0) {
        const sortedTables = [...createDialogSelectedTables].sort((a, b) => {
          const priorityA = createDialogTableOrder.get(a) ?? 0;
          const priorityB = createDialogTableOrder.get(b) ?? 0;
          return priorityA - priorityB;
        });

        for (let i = 0; i < sortedTables.length; i++) {
          await addTableToGroup(sortedTables[i], newGroup.id, i);
        }
      }

      setIsCreateDialogOpen(false);
      setFormData({
        group_name: '',
        description: '',
        max_combined_capacity: 8,
        display_order: 0
      });
      setCreateDialogSelectedTables([]);
      setCreateDialogTableOrder(new Map());
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm('Are you sure you want to delete this table group? This will remove all table assignments from this group.')) {
      try {
        await deleteTableGroup(groupId);
      } catch (error) {
        // Error is handled in the hook
      }
    }
  };

  const handleTableToggle = async (tableId: string, groupId: string, isInGroup: boolean) => {
    try {
      if (isInGroup) {
        await removeTableFromGroup(tableId, groupId);
      } else {
        await addTableToGroup(tableId, groupId);
      }
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleSave = async (groupId: string, changes: { 
    name?: string; 
    capacity?: number; 
    tableChanges?: { tableId: string; isInGroup: boolean }[];
    reorderChanges?: { tableId: string; newPosition: number }[];
  }) => {
    try {
      // Save name and capacity changes optimistically (no loading state)
      const updateData: any = {};
      if (changes.name !== undefined) {
        updateData.group_name = changes.name;
      }
      if (changes.capacity !== undefined) {
        updateData.max_combined_capacity = changes.capacity;
      }
      
      if (Object.keys(updateData).length > 0) {
        await updateTableGroupOptimistic(groupId, updateData);
      }

      // Save table changes sequentially to avoid race conditions
      if (changes.tableChanges && changes.tableChanges.length > 0) {
        // Filter out duplicate additions
        const validChanges = changes.tableChanges.filter(change => {
          if (!change.isInGroup) { // Adding to group (isInGroup is inverted)
            const table = tables?.find(t => t.id === change.tableId);
            if (table) {
              const group = tableGroups.find(g => g.group_id === groupId);
              // Check if table is already in group
              return !group?.table_numbers?.includes(table.table_number);
            }
          }
          return true; // Keep removals as-is
        });
        
        // Process table changes sequentially to avoid priority conflicts - AWAIT completion
        for (const change of validChanges) {
          if (change.isInGroup) {
            await removeTableFromGroup(change.tableId, groupId);
          } else {
            await addTableToGroup(change.tableId, groupId);
          }
        }
      }

      // Save reorder changes
      if (changes.reorderChanges && changes.reorderChanges.length > 0) {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Update priority_order for each table in the reorder changes
        for (const change of changes.reorderChanges) {
          const { error } = await supabase
            .from('table_group_memberships')
            .update({ priority_order: change.newPosition })
            .eq('group_id', groupId)
            .eq('table_id', change.tableId);
          
          if (error) {
            console.error('Error updating table order:', error);
            toast.error('Failed to save table order changes');
            throw error;
          }
        }
      }

      // Force refresh to get latest data from DB
      await fetchTableGroups({ forceRefresh: true });

      // Close editing mode after everything is saved
      setEditingTableAssignments(null);
      toast.success('Table group saved successfully');
    } catch (error) {
      toast.error('Failed to save table group');
    }
  };


  const handleAdvancedSettings = (groupId: string) => {
    setSelectedGroupForAdvanced(groupId);
    setIsAdvancedSettingsOpen(true);
  };

  const handleSaveAdvancedSettings = async (groupId: string, settings: any) => {
    try {
      const result = await updateAdvancedSettings(groupId, settings);
      if (result.success) {
        toast.success('Advanced settings saved');
        setIsAdvancedSettingsOpen(false);
        setSelectedGroupForAdvanced(null);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to save advanced settings');
    }
  };

  const getTablesInGroup = (groupId: string) => {
    const group = tableGroups.find(g => g.group_id === groupId);
    return group?.table_numbers || [];
  };

  const isTableInGroup = (tableNumber: number, groupId: string) => {
    const tablesInGroup = getTablesInGroup(groupId);
    return tablesInGroup.includes(tableNumber);
  };

  const handleEditTableAssignments = (groupId: string) => {
    setEditingTableAssignments(groupId);
  };

  const handleCloseEditing = () => {
    setEditingTableAssignments(null);
  };

  const handleGroupNameChange = (groupId: string, newName: string) => {
    // This is now handled locally in the component during editing
    // Only used for non-editing updates if needed
  };

  const handleCapacityChange = (groupId: string, newCapacity: number) => {
    // This is now handled locally in the component during editing
    // Only used for non-editing updates if needed
  };


  // Sort groups by efficiency for display (AI-driven)
  const sortedTableGroups = [...tableGroups].sort((a, b) => {
    const efficiencyA = calculateGroupEfficiency(a.group_id);
    const efficiencyB = calculateGroupEfficiency(b.group_id);
    return efficiencyB - efficiencyA; // Higher efficiency first
  });

  const selectedGroup = selectedGroupForAdvanced 
    ? sortedTableGroups.find(g => g.group_id === selectedGroupForAdvanced)
    : null;

  // Simple debounce utility function
  function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  // Remove global loading check to prevent freezing
  // if (loading) {
  //   return <div className="text-center py-8">Loading table groups...</div>;
  // }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Table Groups
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm">
                    <p><strong>Table Groups</strong> allow you to combine tables for larger parties.</p>
                    <p className="text-xs opacity-80 mt-1">
                      Groups are automatically selected based on seating efficiency and party size optimization.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h3>
            <p className="text-sm text-muted-foreground">
              Group tables that can be combined for larger parties
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md">
                <div className="space-y-2">
                  <p><strong>How Table Groups Work:</strong></p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>Groups are selected by AI based on seating efficiency</li>
                    <li>Most efficient combinations are chosen automatically</li>
                    <li>Use visual settings for custom capacity calculation</li>
                    <li>Only tables marked as "can combine" can be grouped</li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              // Reset state when dialog closes
              setCreateDialogSelectedTables([]);
              setCreateDialogTableOrder(new Map());
              setFormData({
                group_name: '',
                description: '',
                max_combined_capacity: 8,
                display_order: 0
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Table Group</DialogTitle>
                <DialogDescription>
                  Create a new group for tables that can be combined together.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="group_name">Group Name</Label>
                  <Input
                    id="group_name"
                    value={formData.group_name}
                    onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                    placeholder="e.g., Window Section, Main Dining"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description of this table group"
                  />
                </div>

                {/* Table Selection Section */}
                <div className="space-y-2">
                  <CollapsibleTableAssignment
                    tables={tables || []}
                    groupId="create-dialog"
                    isTableInGroup={(tableNumber) => {
                      const table = tables?.find(t => t.table_number === tableNumber);
                      return table ? createDialogSelectedTables.includes(table.id) : false;
                    }}
                    onTableToggle={(tableId) => {
                      setCreateDialogSelectedTables(prev => {
                        if (prev.includes(tableId)) {
                          // Remove table and its priority
                          const newOrder = new Map(createDialogTableOrder);
                          newOrder.delete(tableId);
                          setCreateDialogTableOrder(newOrder);
                          return prev.filter(id => id !== tableId);
                        } else {
                          // Add table with next priority
                          const newOrder = new Map(createDialogTableOrder);
                          newOrder.set(tableId, prev.length);
                          setCreateDialogTableOrder(newOrder);
                          return [...prev, tableId];
                        }
                      });
                    }}
                  />

                  {/* Selected Tables with Reorder Controls */}
                  {createDialogSelectedTables.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <Label>Selected Tables (Priority Order)</Label>
                      <div className="space-y-2">
                        {createDialogSelectedTables
                          .sort((a, b) => (createDialogTableOrder.get(a) ?? 0) - (createDialogTableOrder.get(b) ?? 0))
                          .map((tableId, index) => {
                            const table = tables?.find(t => t.id === tableId);
                            if (!table) return null;
                            
                            return (
                              <div key={tableId} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                  {index + 1}
                                </span>
                                <span className="flex-1 text-sm">
                                  Table {table.table_number} {table.table_name && `(${table.table_name})`}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={index === 0}
                                    onClick={() => {
                                      const newOrder = new Map(createDialogTableOrder);
                                      const currentPriority = newOrder.get(tableId) ?? 0;
                                      const prevTableId = createDialogSelectedTables
                                        .sort((a, b) => (createDialogTableOrder.get(a) ?? 0) - (createDialogTableOrder.get(b) ?? 0))[index - 1];
                                      const prevPriority = newOrder.get(prevTableId) ?? 0;
                                      
                                      newOrder.set(tableId, prevPriority);
                                      newOrder.set(prevTableId, currentPriority);
                                      setCreateDialogTableOrder(newOrder);
                                    }}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={index === createDialogSelectedTables.length - 1}
                                    onClick={() => {
                                      const newOrder = new Map(createDialogTableOrder);
                                      const currentPriority = newOrder.get(tableId) ?? 0;
                                      const nextTableId = createDialogSelectedTables
                                        .sort((a, b) => (createDialogTableOrder.get(a) ?? 0) - (createDialogTableOrder.get(b) ?? 0))[index + 1];
                                      const nextPriority = newOrder.get(nextTableId) ?? 0;
                                      
                                      newOrder.set(tableId, nextPriority);
                                      newOrder.set(nextTableId, currentPriority);
                                      setCreateDialogTableOrder(newOrder);
                                    }}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const newOrder = new Map(createDialogTableOrder);
                                      newOrder.delete(tableId);
                                      setCreateDialogTableOrder(newOrder);
                                      setCreateDialogSelectedTables(prev => prev.filter(id => id !== tableId));
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateGroup} disabled={!formData.group_name.trim()}>
                  Create Group
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {sortedTableGroups.length > 0 ? (
          <>
            <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
              <Info className="h-3 w-3" />
              Groups are displayed by efficiency. Most efficient combinations appear first.
            </div>
            <div className="table-groups-grid grid gap-4 relative">
              {sortedTableGroups.map((group, index) => (
                <SimpleGroupCard
                  key={group.group_id}
                  group={group}
                  efficiency={calculateGroupEfficiency(group.group_id)}
                  tables={tables}
                  isEditing={editingTableAssignments === group.group_id}
                  onEdit={handleEditTableAssignments}
                  onCloseEdit={handleCloseEditing}
                  onSave={handleSave}
                  onDelete={handleDeleteGroup}
                  onAdvancedSettings={handleAdvancedSettings}
                  onGroupNameChange={handleGroupNameChange}
                  onCapacityChange={handleCapacityChange}
                  onTableToggle={handleTableToggle}
                  isTableInGroup={isTableInGroup}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No table groups created yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first group to start combining tables for larger parties.</p>
          </div>
        )}
      </div>

      {/* Advanced Settings Modal */}
      {selectedGroup && (
        <AdvancedGroupSettingsModal
          group={selectedGroup}
          isOpen={isAdvancedSettingsOpen}
          onClose={() => {
            setIsAdvancedSettingsOpen(false);
            setSelectedGroupForAdvanced(null);
          }}
          onSave={handleSaveAdvancedSettings}
        />
      )}
    </div>
  );
};