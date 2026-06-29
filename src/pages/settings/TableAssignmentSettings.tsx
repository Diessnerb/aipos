
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, ChevronDown, Accessibility } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TablesList } from '@/components/settings/tables/TablesList';
import { TableManagementModal } from '@/components/settings/tables/TableManagementModal';
import { TableGroupManager } from '@/components/settings/tables/TableGroupManager';
import { SimpleAssignmentRulesManager } from '@/components/settings/tables/SimpleAssignmentRulesManager';
import { VisualEfficiencyDashboard } from '@/components/settings/tables/VisualEfficiencyDashboard';
import TableServiceNotifications from '@/components/settings/tables/TableServiceNotifications';
import { useTableManagement } from '@/hooks/useTableManagement';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Table } from '@/types/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { FloorPlanBuilder } from '@/components/settings/tables/FloorPlanBuilder';

const TableAssignmentSettings = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTable, setModalTable] = useState<Table | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [autoAssignHelpOpen, setAutoAssignHelpOpen] = useState(false);
  const [optimizationHelpOpen, setOptimizationHelpOpen] = useState(false);
  
  // Use useTablesQuery for instant data from device cache
  const { tables, loading: tablesLoading, refetch: refetchTables } = useTablesQuery();
  
  // Use useTableManagement only for mutations (create, update, delete)
  const { createTable, updateTable, updateTableOptimistic, deleteTable } = useTableManagement();
  
  const { settings, loading: settingsLoading, isSaving, updateSettings, refetch } = useCompanySettings();
  const { currentUser: user } = useCurrentUser();

  // Wrapper functions for FloorPlan component compatibility
  const handleFloorPlanCreateTable = async (tableData: Partial<Table>): Promise<boolean> => {
    try {
      const result = await createTable(tableData as Omit<Table, "id" | "created_at" | "company_id">);
      return result === true || typeof result === 'boolean' ? result : false;
    } catch (error) {
      return false;
    }
  };

  const handleFloorPlanUpdateTable = async (id: string, tableData: Partial<Table>): Promise<boolean> => {
    try {
      const result = await updateTable(id, tableData);
      return result === true || typeof result === 'boolean' ? result : true;
    } catch (error) {
      return false;
    }
  };

  const handleFloorPlanDeleteTable = async (id: string): Promise<boolean> => {
    try {
      const result = await deleteTable(id);
      return result === true || typeof result === 'boolean' ? result : true;
    } catch (error) {
      return false;
    }
  };

  // Auto-normalize optimization mode based on toggle states (defensive)
  useEffect(() => {
    if (!settings || settingsLoading || isSaving) return;
    
    // Only normalize if we have sufficient context and it's safe to do so
    const hasValidSettings = settings.id && settings.id !== 'readonly';
    const anyEnabled = settings.auto_assign_tables || settings.optimization_enabled;
    const currentMode = settings.optimization_mode;
    
    if (!hasValidSettings) return;
    
    // Debounce normalization to prevent rapid updates
    const timer = setTimeout(() => {
      if (anyEnabled && currentMode !== 'continuous') {
        console.log('Normalizing: enabling continuous mode for active toggles');
        updateSettings({ optimization_mode: 'continuous' }, true);
      } else if (!anyEnabled && currentMode !== 'disabled') {
        console.log('Normalizing: disabling mode for inactive toggles');
        updateSettings({ optimization_mode: 'disabled' }, true);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [settings?.auto_assign_tables, settings?.optimization_enabled, settings?.optimization_mode, settingsLoading, isSaving, updateSettings]);

  const handleAddTable = () => {
    setModalTable(null);
    setModalOpen(true);
  };

  const handleEditTable = (table: Table) => {
    setModalTable(table);
    setModalOpen(true);
  };

  const handleModalSubmit = async (tableData: any) => {
    setModalSubmitting(true);
    try {
      if (modalTable) {
        // Editing existing table
        await updateTable(modalTable.id, tableData);
      } else {
        // Creating new table
        await createTable(tableData);
      }
      setModalOpen(false);
      setModalTable(null);
      
      // Force refresh tables to update UI immediately
      await refetchTables();
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleUpdateTable = async (tableId: string, tableData: Partial<Table>): Promise<boolean> => {
    const result = await updateTable(tableId, tableData);
    return result === true || typeof result === 'boolean' ? result : false;
  };

  const handleUpdateTableOptimistic = async (tableId: string, tableData: Partial<Table>): Promise<boolean> => {
    try {
      return await updateTableOptimistic(tableId, tableData);
    } catch (error) {
      return false;
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    const success = await deleteTable(tableId);
    if (success) {
      await refetchTables();
    }
  };

  const handleAutoAssignToggle = async (enabled: boolean) => {
    if (!settings || isSaving) return;
    
    try {
      console.log('🔄 Auto-assign toggle:', enabled);
      
      // Optimistic update
      const optimisticUpdate = { 
        auto_assign_tables: enabled,
        optimization_enabled: enabled ? true : settings.optimization_enabled
      };
      
      await updateSettings(optimisticUpdate);
      
      toast.success(enabled ? "Auto-assignment enabled" : "Auto-assignment disabled");
    } catch (error) {
      console.error('Error toggling auto-assign:', error);
      toast.error('Failed to update setting');
    }
  };

  const handleOptimizationToggle = async (enabled: boolean) => {
    if (!settings || isSaving) return;
    
    try {
      console.log('🔄 Optimization toggle:', enabled);
      
      // Optimistic update
      const optimisticUpdate = { 
        optimization_enabled: enabled,
        auto_assign_tables: enabled ? settings.auto_assign_tables : false
      };
      
      await updateSettings(optimisticUpdate);
      
      toast.success(enabled ? "Optimization enabled" : "Optimization disabled");
    } catch (error) {
      console.error('Error toggling optimization:', error);
      toast.error('Failed to update setting');
    }
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </div>

        <PageHeader 
          title="Tables & Table Groups Settings" 
          subtitle="Configure your restaurant tables and seating arrangements. Set up table numbers, capacity, accessibility options, and other important details." 
        />

        <div className="space-y-6 max-w-none w-full">
          {/* Service Notifications */}
          <TableServiceNotifications />
          
          {/* Auto-Assignment & Optimization Settings */}
          <Card>
          <CardHeader>
            <CardTitle>Auto Assignment & Optimization</CardTitle>
            <CardDescription>
              Automatically assign tables to new reservations and continuously optimize existing assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {settingsLoading && !settings ? (
                    <Skeleton className="h-6 w-11" />
                  ) : (
                    <Switch
                      id="auto-assign"
                      checked={settings?.auto_assign_tables ?? false}
                      onCheckedChange={handleAutoAssignToggle}
                      disabled={isSaving}
                    />
                  )}
                  <Label htmlFor="auto-assign">Enable automatic table assignment</Label>
                </div>
                <Collapsible open={autoAssignHelpOpen} onOpenChange={setAutoAssignHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${autoAssignHelpOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
              
              <Collapsible open={autoAssignHelpOpen} onOpenChange={setAutoAssignHelpOpen}>
                <CollapsibleContent className="space-y-0">
                  <div className="text-sm text-muted-foreground ml-6 pb-4">
                    <p className="mb-2">Automatically assigns tables when new reservations are created using advanced AI optimization:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Universal optimization logic across all assignment scenarios</li>
                      <li>Space-making analysis: moves smaller parties to free optimal combinations</li>
                      <li>Global rebalancing: cascading moves to accommodate large groups</li>
                      <li>Matches accessibility needs (wheelchair access, tall tables, seating preferences)</li>
                      <li>Intelligent table grouping with waste minimization</li>
                      <li>Can always be overridden manually if needed</li>
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {settingsLoading && !settings ? (
                    <Skeleton className="h-6 w-11" />
                  ) : (
                    <Switch
                      id="optimization"
                      checked={settings?.optimization_enabled ?? false}
                      onCheckedChange={handleOptimizationToggle}
                      disabled={isSaving}
                    />
                  )}
                  <Label htmlFor="optimization">Enable timeline optimization</Label>
                </div>
                <Collapsible open={optimizationHelpOpen} onOpenChange={setOptimizationHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${optimizationHelpOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
              
              <Collapsible open={optimizationHelpOpen} onOpenChange={setOptimizationHelpOpen}>
                <CollapsibleContent className="space-y-0">
                  <div className="text-sm text-muted-foreground ml-6 pb-4">
                    <p className="mb-2">Continuously optimizes table assignments every 5 minutes using multi-strategy AI:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Reduces gaps between bookings for maximum efficiency</li>
                      <li>Space-making mode: proactively shuffles reservations for incoming parties</li>
                      <li>Global rebalancing: finds optimal cascading moves across entire timeline</li>
                      <li>Matches special requirements (wheelchair access, tall tables, preferences)</li>
                      <li>Smart protection: respects locked reservations and 10-second post-move immunity</li>
                      <li>Never moves bookings starting within 30 minutes or changes dates/times</li>
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>

        {/* Table Management Modal */}
        <TableManagementModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setModalTable(null);
          }}
          initialData={modalTable}
          onSubmit={handleModalSubmit}
          loading={modalSubmitting}
          tables={tables}
        />

        {/* Tabbed Interface for Advanced Configuration */}
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full grid-cols-2" data-tabs-list>
            <TabsTrigger value="tables" data-tabs-trigger="tables">Tables</TabsTrigger>
            {/* <TabsTrigger value="floorplan" data-tabs-trigger="floorplan">Floor Plan</TabsTrigger> */}
            <TabsTrigger value="groups" data-tabs-trigger="groups">Table Groups</TabsTrigger>
            {/* <TabsTrigger value="rules" data-tabs-trigger="rules">Assignment Rules</TabsTrigger> */}
          </TabsList>
          
          <TabsContent value="tables" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Restaurant Tables</CardTitle>
                    <CardDescription>
                      Manage your restaurant's table configuration and seating arrangements.
                    </CardDescription>
                  </div>
                  <Button onClick={handleAddTable}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Table
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TablesList
                  tables={tables}
                  loading={tablesLoading}
                  onUpdate={handleUpdateTable}
                  onUpdateOptimistic={handleUpdateTableOptimistic}
                  onDelete={handleDeleteTable}
                  onEdit={handleEditTable}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* <TabsContent value="floorplan" className="space-y-6">
            <FloorPlanBuilder />
          </TabsContent> */}
          
          <TabsContent value="groups" className="space-y-6">
            <TableGroupManager />
          </TabsContent>
          
          {/* <TabsContent value="rules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Accessibility className="h-5 w-5 text-blue-500" />
                  Accessibility & Seating Policy
                </CardTitle>
                <CardDescription>
                  Manage accessibility table allocation and high-top vs dining table preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Accessible Tables</Label>
                      <div className="text-2xl font-bold text-blue-600">
                        {tables?.filter(t => t.accessibility_friendly && t.is_active).length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Active wheelchair-accessible tables
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Total Tables</Label>
                      <div className="text-2xl font-bold">
                        {tables?.filter(t => t.is_active).length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        All active tables in restaurant
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Spare Target</Label>
                      <div className="flex items-center gap-2">
                        <select
                          value={settings?.accessible_spare_target || 1}
                          onChange={(e) => updateSettings({ accessible_spare_target: parseInt(e.target.value) })}
                          disabled={isSaving}
                          className="text-lg font-bold bg-transparent border rounded px-2 py-1 w-16 text-center"
                        >
                          {[0, 1, 2, 3].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-sm text-muted-foreground">tables</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Reserve accessible tables for walk-ins
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="text-sm">
                      <h4 className="font-medium mb-2">Accessibility Assignment Policy</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>System detects accessibility needs from reservation notes</li>
                        <li>Keeps {settings?.accessible_spare_target || 1} accessible table{(settings?.accessible_spare_target || 1) !== 1 ? 's' : ''} in reserve based on predicted demand</li>
                        <li>Assigns accessible tables when the guest specifically needs them</li>
                        <li>Protects accessibility options while maximizing overall utilization</li>
                      </ul>
                    </div>
                    
                    <VisualEfficiencyDashboard />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <SimpleAssignmentRulesManager />
          </TabsContent> */}
          <TabsContent value="efficiency" className="space-y-4">
            <VisualEfficiencyDashboard />
          </TabsContent>
          <TabsContent value="efficiency" className="space-y-4">
            <VisualEfficiencyDashboard />
          </TabsContent>
        </Tabs>
        </div>
    </div>
  );
};

export default TableAssignmentSettings;
