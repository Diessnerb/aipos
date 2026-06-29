import React, { useState } from 'react';
import { Edit, Trash2, Users, MapPin, Accessibility, AlertTriangle, X, Crown, TreePine, Volume2, Utensils, Dog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DeleteTableConfirmModal } from './DeleteTableConfirmModal';
import OutOfServiceDurationModal from './OutOfServiceDurationModal';
import { useTableServiceSchedules } from '@/hooks/useTableServiceSchedules';
import { toast } from '@/hooks/use-toast';
import type { Table } from '@/types/table';

interface TablesListProps {
  tables: Table[];
  loading: boolean;
  onUpdate: (tableId: string, data: Partial<Table>) => Promise<boolean>;
  onUpdateOptimistic?: (tableId: string, data: Partial<Table>) => Promise<boolean>;
  onDelete: (tableId: string) => void;
  onEdit: (table: Table) => void;
}

export const TablesList: React.FC<TablesListProps> = ({
  tables,
  loading,
  onUpdate,
  onUpdateOptimistic,
  onDelete,
  onEdit,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const [optimisticTables, setOptimisticTables] = useState<Table[]>([]);
  const [loadingToggles, setLoadingToggles] = useState<Set<string>>(new Set());
  const [durationModalOpen, setDurationModalOpen] = useState(false);
  const [selectedTableForDuration, setSelectedTableForDuration] = useState<Table | null>(null);
  
  const { createServiceSchedule } = useTableServiceSchedules();

  // Use optimistic tables if available, otherwise use regular tables
  const displayTables = optimisticTables.length > 0 ? optimisticTables : tables;

  const filteredTables = displayTables.filter((table) => {
    const matchesSearch = 
      table.table_number.toString().includes(search) ||
      table.table_name?.toLowerCase().includes(search.toLowerCase()) ||
      table.location?.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === 'all' || table.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const tableTypes = [...new Set(displayTables.map(t => t.type).filter(Boolean))];

  const handleDeleteClick = (table: Table) => {
    setTableToDelete(table);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (tableToDelete) {
      onDelete(tableToDelete.id);
      setDeleteModalOpen(false);
      setTableToDelete(null);
    }
  };

  const handleEditClick = (table: Table) => {
    onEdit(table);
  };

  const getTableTypeBadges = (table: Table) => {
    const badges = [];
    
    if (table.vip_status) {
      badges.push({
        icon: Crown,
        label: 'VIP',
        variant: 'secondary' as const
      });
    }
    
    if (table.window_seating) {
      badges.push({
        icon: MapPin,
        label: 'Window View',
        variant: 'outline' as const
      });
    }
    
    if (table.is_outdoor) {
      badges.push({
        icon: TreePine,
        label: 'Outdoor',
        variant: 'outline' as const
      });
    }
    
    if (table.is_quiet_area) {
      badges.push({
        icon: Volume2,
        label: 'Quiet Area',
        variant: 'outline' as const
      });
    }
    
    if (table.is_main_dining) {
      badges.push({
        icon: Utensils,
        label: 'Main Dining',
        variant: 'outline' as const
      });
    }
    
    if (table.is_dog_friendly) {
      badges.push({
        icon: Dog,
        label: 'Dog Friendly',
        variant: 'outline' as const
      });
    }
    
    return badges;
  };

  const handleServiceStatusToggle = async (table: Table, isEnabled: boolean) => {
    // If turning OFF (out of service), open duration modal
    if (!isEnabled) {
      setSelectedTableForDuration(table);
      setDurationModalOpen(true);
      return;
    }

    // If turning ON (back to available), proceed with update
    const tableId = table.id;
    setLoadingToggles(prev => new Set(prev).add(tableId));
    
    const updatedTable: Table = { ...table, service_status: 'available' };
    setOptimisticTables(prev => {
      const current = prev.length > 0 ? prev : tables;
      return current.map(t => t.id === tableId ? updatedTable : t);
    });
    
    try {
      const updateFn = onUpdateOptimistic || onUpdate;
      await updateFn(tableId, { service_status: 'available' });
    } catch (error) {
      setOptimisticTables(prev => {
        const current = prev.length > 0 ? prev : tables;
        return current.map(t => t.id === tableId ? table : t);
      });
      console.error('Failed to update service status:', error);
    } finally {
      setLoadingToggles(prev => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
  };

  const handleDurationSelected = async (days: number | null) => {
    if (!selectedTableForDuration) return;

    const table = selectedTableForDuration;
    const tableId = table.id;
    
    setLoadingToggles(prev => new Set(prev).add(tableId));
    
    const updatedTable: Table = { ...table, service_status: 'out_of_service' };
    setOptimisticTables(prev => {
      const current = prev.length > 0 ? prev : tables;
      return current.map(t => t.id === tableId ? updatedTable : t);
    });
    
    try {
      console.log(`🔧 Marking Table ${table.table_number} as out of service...`);
      
      // STEP 1: Create service schedule FIRST (so it exists when real-time fires)
      console.log(`📅 Creating service schedule (${days ? `${days} days` : 'undetermined duration'})...`);
      await createServiceSchedule(tableId, days);
      
      // STEP 2: Brief delay to ensure schedule is committed to database
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // STEP 3: Update table status (this triggers cascade reassignment)
      console.log(`⚡ Updating table status to out_of_service...`);
      await onUpdate(tableId, { service_status: 'out_of_service' });
      
      console.log(`✅ Table ${table.table_number} marked as out of service`);
      console.log(`🔄 Real-time subscription will trigger reservation reassignment`);
      
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticTables(prev => {
        const current = prev.length > 0 ? prev : tables;
        return current.map(t => t.id === tableId ? table : t);
      });
      console.error('Failed to update service status:', error);
      
      // Show error toast
      toast({
        title: "Error",
        description: "Failed to mark table as out of service. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingToggles(prev => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
      setSelectedTableForDuration(null);
    }
  };

  // Reset optimistic state when tables prop changes (from real-time updates)
  React.useEffect(() => {
    setOptimisticTables([]);
  }, [tables]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search tables by number, name, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {tableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tables List */}
      {filteredTables.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              {tables.length === 0 ? (
                <div>
                  <h3 className="text-lg font-medium mb-2">No tables configured</h3>
                  <p>Add your first table to get started with table management.</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-medium mb-2">No tables found</h3>
                  <p>Try adjusting your search or filter criteria.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTables.map((table) => {
            return (
              <Card 
                key={table.id} 
                className="transition-all duration-200 hover:shadow-md"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          Table {table.table_number}
                          {table.table_name && (
                            <span className="text-muted-foreground font-normal ml-2">
                              ({table.table_name})
                            </span>
                          )}
                        </h3>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Service Status Badge */}
                          {table.service_status === 'out_of_service' && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Out of Service
                            </Badge>
                          )}
                          {table.service_status === 'temporarily_removed' && (
                            <Badge variant="outline" className="flex items-center gap-1 border-destructive text-destructive">
                              <X className="h-3 w-3" />
                              Temporarily Removed
                            </Badge>
                          )}
                          
                          {/* Table Type Badges */}
                          {getTableTypeBadges(table).map((badge, index) => {
                            const Icon = badge.icon;
                            return (
                              <Badge key={index} variant={badge.variant} className="flex items-center gap-1">
                                <Icon className="h-3 w-3" />
                                {badge.label}
                              </Badge>
                            );
                          })}
                          
                          {table.accessibility_friendly && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Accessibility className="h-3 w-3" />
                              Accessible
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {table.seats} seats
                        </div>
                        {table.type && (
                          <Badge variant="outline">{table.type}</Badge>
                        )}
                        {table.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {table.location}
                          </div>
                        )}
                      </div>
                      
                      {table.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {table.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="relative">
                          <Switch
                            checked={table.service_status === 'available'}
                            onCheckedChange={(checked) => handleServiceStatusToggle(table, checked)}
                            disabled={loadingToggles.has(table.id)}
                          />
                          {loadingToggles.has(table.id) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <LoadingSpinner size="sm" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {table.service_status === 'available' ? 'On' : 'Off'}
                        </span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(table)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(table)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DeleteTableConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        table={tableToDelete}
      />
      
      {selectedTableForDuration && (
        <OutOfServiceDurationModal
          isOpen={durationModalOpen}
          onClose={() => {
            setDurationModalOpen(false);
            setSelectedTableForDuration(null);
          }}
          table={selectedTableForDuration}
          onDurationSelected={handleDurationSelected}
        />
      )}
    </div>
  );
};