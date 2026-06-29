import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { CategorizedFloorPlanToolbar } from './CategorizedFloorPlanToolbar';
import { SeatConfigurationEditor } from './SeatConfigurationEditor';
import { FloorLevelManager } from './FloorLevelManager';
import { useTableManagement } from '@/hooks/useTableManagement';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { Table, SeatPosition } from '@/types/table';
import { toast } from 'sonner';
import { Settings, Eye, EyeOff, Download, Upload } from 'lucide-react';
import { floorPlanStorage, FloorLevel } from './FloorPlanStorageService';

export const FloorPlanBuilder = () => {
  const { tables: allTables, loading } = useTablesQuery();
  const { createTable, updateTable } = useTableManagement();
  const [selectedTool, setSelectedTool] = useState('select');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showSeatEditor, setShowSeatEditor] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [tablePropertiesVisible, setTablePropertiesVisible] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [currentLevel, setCurrentLevel] = useState<FloorLevel>({
    id: 'level-1',
    name: 'Ground Floor',
    level: 1,
    isActive: true
  });

  // Track pending position changes for deferred saving
  const [pendingPositions, setPendingPositions] = useState<Map<string, { x: number; y: number; rotation: number }>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Filter tables by current floor level and apply pending positions
  const tables = allTables
    .filter(table => (table.floor_level || 1) === currentLevel.level)
    .map(table => {
      const pendingPos = pendingPositions.get(table.id);
      if (pendingPos) {
        return {
          ...table,
          floor_plan_x: pendingPos.x,
          floor_plan_y: pendingPos.y,
          floor_plan_rotation: pendingPos.rotation
        };
      }
      return table;
    });

  // Form state for table properties
  const [tableForm, setTableForm] = useState({
    table_number: '',
    table_name: '',
    seats: 4,
    shape: 'round',
    type: 'standard',
    location: ''
  });

  const handleTableSelect = (table: Table | null) => {
    setSelectedTable(table);
    if (table) {
      setTableForm({
        table_number: table.table_number.toString(),
        table_name: table.table_name,
        seats: table.seats,
        shape: table.shape || 'round',
        type: table.type || 'standard',
        location: table.location || ''
      });
    }
  };

  const handleTableMove = (tableId: string, x: number, y: number, rotation = 0) => {
    // Store position change locally without immediately saving to database
    setPendingPositions(prev => {
      const updated = new Map(prev);
      updated.set(tableId, { x, y, rotation });
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleAddTable = async (x: number, y: number, shape: string) => {
    // Find next available table number by checking for gaps
    const existingNumbers = tables.map(t => t.table_number).sort((a, b) => a - b);
    let nextNumber = 1;
    
    // Find the first gap in the sequence
    for (let i = 0; i < existingNumbers.length; i++) {
      if (existingNumbers[i] !== nextNumber) {
        break;
      }
      nextNumber++;
    }

    const newTable = {
      table_number: nextNumber,
      table_name: `Table ${nextNumber}`,
      seats: 4,
      shape: shape.replace('-table', '') as any, // Remove '-table' suffix for shape
      type: 'standard' as any,
      status: 'available' as any,
      floor_plan_x: x,
      floor_plan_y: y,
      floor_plan_rotation: 0,
      floor_level: currentLevel.level, // Assign to current floor
      is_active: true
    } satisfies Omit<Table, 'id' | 'created_at' | 'company_id'>;

    const success = await createTable(newTable);
    if (success) {
      toast.success(`Table ${nextNumber} added to floor plan`);
      setSelectedTool('select');
    }
  };

  const handleUpdateSelectedTable = async () => {
    if (!selectedTable) return;

    const updateData: Partial<Table> = {
      table_number: parseInt(tableForm.table_number),
      table_name: tableForm.table_name,
      seats: tableForm.seats,
      shape: tableForm.shape,
      type: tableForm.type,
      location: tableForm.location
    };

    const success = await updateTable(selectedTable.id, updateData);
    if (success) {
      toast.success('Table updated successfully');
    }
  };

  const handleDeleteSelectedTable = async () => {
    if (!selectedTable) return;

    const success = await updateTable(selectedTable.id, { is_active: false });
    if (success) {
      setSelectedTable(null);
      toast.success('Table removed from floor plan');
    }
  };

  const handleOpenSeatEditor = () => {
    if (selectedTable) {
      setShowSeatEditor(true);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleSaveSeatLayout = async (tableId: string, seatPositions: SeatPosition[]) => {
    // For now, we'll store seat layout in the table's features field
    const success = await updateTable(tableId, {
      features: { seatLayout: seatPositions }
    });
    
    if (success) {
      toast.success('Seat layout saved successfully');
    }
  };

  // Save/Load Layout Functions
  const handleSaveLayout = () => {
    try {
      const layout = floorPlanStorage.saveLayout({
        name: `${currentLevel.name} Layout`,
        level: currentLevel.level,
        tables: [], // Placeholder since actual table data is passed separately
        objects: [] // Will be expanded in future for architectural objects
      }, tables);
      toast.success(`Layout saved for ${currentLevel.name}`);
    } catch (error) {
      toast.error('Failed to save layout');
    }
  };

  const handleLoadLayout = () => {
    try {
      const layout = floorPlanStorage.getLayoutForLevel(currentLevel.level);
      if (layout) {
        // In a real implementation, this would reload the tables from the layout
        toast.success(`Layout loaded for ${currentLevel.name}`);
      } else {
        toast.info(`No saved layout found for ${currentLevel.name}`);
      }
    } catch (error) {
      toast.error('Failed to load layout');
    }
  };

  const handleRotateSelected = () => {
    if (selectedTable) {
      const currentRotation = selectedTable.floor_plan_rotation || 0;
      const newRotation = (currentRotation + 45) % 360;
      updateTable(selectedTable.id, { floor_plan_rotation: newRotation });
      toast.success(`Rotated table to ${newRotation}°`);
    } else {
      toast.info('Select a table to rotate');
    }
  };

  const handleSavePositions = async () => {
    if (pendingPositions.size === 0) {
      toast.info('No changes to save');
      return;
    }

    console.log('Starting to save positions:', Object.fromEntries(pendingPositions));

    const savePromises = Array.from(pendingPositions.entries()).map(([tableId, pos]) => {
      // Ensure numeric values are properly converted - no strings sent to RPC
      const sanitizedData = {
        floor_plan_x: pos.x !== null && pos.x !== undefined ? Number(parseFloat(pos.x.toFixed(2))) : null,
        floor_plan_y: pos.y !== null && pos.y !== undefined ? Number(parseFloat(pos.y.toFixed(2))) : null,
        floor_plan_rotation: pos.rotation !== null && pos.rotation !== undefined ? Number(Math.round(pos.rotation)) : null,
        floor_level: currentLevel.level
      };
      
      console.log(`Saving table ${tableId} with sanitized data:`, sanitizedData);
      
      return updateTable(tableId, sanitizedData);
    });

    try {
      const results = await Promise.all(savePromises);
      const successCount = results.filter(Boolean).length;
      
      console.log('Save results:', { total: pendingPositions.size, successful: successCount, results });
      
      if (successCount === pendingPositions.size) {
        setPendingPositions(new Map());
        setHasUnsavedChanges(false);
        toast.success(`Saved positions for ${successCount} tables`);
      } else {
        toast.error(`Failed to save some table positions (${successCount}/${pendingPositions.size} saved)`);
      }
    } catch (error) {
      console.error('Error saving table positions:', error);
      toast.error('Failed to save table positions');
    }
  };

  const handleDiscardChanges = () => {
    setPendingPositions(new Map());
    setHasUnsavedChanges(false);
    toast.info('Changes discarded');
  };

  const handleLevelChange = (level: FloorLevel) => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Switch floors anyway? Changes will be lost.')) {
        return;
      }
      setPendingPositions(new Map());
      setHasUnsavedChanges(false);
    }
    
    setCurrentLevel(level);
    setSelectedTable(null);
    toast.info(`Switched to ${level.name}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Floor Plan Builder</h3>
          <p className="text-sm text-muted-foreground">
            Design your restaurant layout by placing tables and configuring seating arrangements
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTablePropertiesVisible(!tablePropertiesVisible)}
        >
          {tablePropertiesVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          Properties Panel
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Floor Plan Canvas */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-4">
                <CategorizedFloorPlanToolbar
                  selectedTool={selectedTool}
                  onToolSelect={setSelectedTool}
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  gridVisible={gridVisible}
                  onToggleGrid={() => setGridVisible(!gridVisible)}
                  onSave={handleSaveLayout}
                  onLoad={handleLoadLayout}
                  onRotateSelected={handleRotateSelected}
                />
                
                {/* Save/Discard Position Changes */}
                {hasUnsavedChanges && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSavePositions}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Save Positions ({pendingPositions.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDiscardChanges}
                    >
                      Discard
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <FloorPlanCanvas
                key={`floor-${currentLevel.id}`}
                tables={tables}
                selectedTool={selectedTool}
                onTableSelect={handleTableSelect}
                onTableMove={handleTableMove}
                onAddTable={handleAddTable}
                gridVisible={gridVisible}
                zoom={zoom}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
              />
            </CardContent>
          </Card>
        </div>

        {/* Table Properties Panel */}
        {tablePropertiesVisible && (
          <div className="lg:col-span-1 space-y-4">
            {/* Floor Level Manager */}
            <FloorLevelManager
              currentLevel={currentLevel}
              onLevelChange={handleLevelChange}
            />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedTable ? `Table ${selectedTable.table_number}` : 'No Table Selected'}
                </CardTitle>
                <CardDescription>
                  {selectedTable ? 'Configure table properties' : 'Select a table to edit properties'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTable ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="tableNumber">Number</Label>
                        <Input
                          id="tableNumber"
                          type="number"
                          value={tableForm.table_number}
                          onChange={(e) => setTableForm(prev => ({ ...prev, table_number: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="tableSeats">Seats</Label>
                        <Input
                          id="tableSeats"
                          type="number"
                          value={tableForm.seats}
                          onChange={(e) => setTableForm(prev => ({ ...prev, seats: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="tableName">Name</Label>
                      <Input
                        id="tableName"
                        value={tableForm.table_name}
                        onChange={(e) => setTableForm(prev => ({ ...prev, table_name: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="tableShape">Shape</Label>
                        <Select
                          value={tableForm.shape}
                          onValueChange={(value) => setTableForm(prev => ({ ...prev, shape: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="round">Round</SelectItem>
                            <SelectItem value="rectangular">Rectangle</SelectItem>
                            <SelectItem value="square">Square</SelectItem>
                            <SelectItem value="booth">Booth</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="tableType">Type</Label>
                        <Select
                          value={tableForm.type}
                          onValueChange={(value) => setTableForm(prev => ({ ...prev, type: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="high_top">High Top</SelectItem>
                            <SelectItem value="booth">Booth</SelectItem>
                            <SelectItem value="outdoor">Outdoor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="tableLocation">Location</Label>
                      <Input
                        id="tableLocation"
                        value={tableForm.location}
                        placeholder="e.g., Main Dining, Patio"
                        onChange={(e) => setTableForm(prev => ({ ...prev, location: e.target.value }))}
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <Button onClick={handleUpdateSelectedTable} size="sm">
                        Update Table
                      </Button>
                      <Button 
                        onClick={handleOpenSeatEditor} 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Seats
                      </Button>
                      <Button 
                        onClick={handleDeleteSelectedTable} 
                        variant="destructive" 
                        size="sm"
                      >
                        Delete Table
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">Select a table from the floor plan to edit its properties</p>
                    <p className="text-xs mt-2">Or use the toolbar to add new tables</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Floor Plan Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Current Level:</span>
                  <span className="font-semibold">{currentLevel.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Tables:</span>
                  <span className="font-semibold">{tables.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Seats:</span>
                  <span className="font-semibold">{tables.reduce((sum, t) => sum + t.seats, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Round Tables:</span>
                  <span>{tables.filter(t => t.shape === 'round').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Square Tables:</span>
                  <span>{tables.filter(t => t.shape === 'rectangular' || t.shape === 'square').length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Export/Import Layout */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Layout Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    try {
                      const layout = floorPlanStorage.getLayoutForLevel(currentLevel.level);
                      if (layout) {
                        const dataStr = floorPlanStorage.exportLayout(layout);
                        const dataBlob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(dataBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${currentLevel.name.replace(/\s+/g, '_')}_layout.json`;
                        link.click();
                        toast.success('Layout exported successfully');
                      } else {
                        toast.error('No layout to export for this level');
                      }
                    } catch (error) {
                      toast.error('Failed to export layout');
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Layout
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          try {
                            const jsonData = e.target?.result as string;
                            floorPlanStorage.importLayout(jsonData, tables);
                            toast.success('Layout imported successfully');
                          } catch (error) {
                            toast.error('Failed to import layout');
                          }
                        };
                        reader.readAsText(file);
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Layout
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Seat Configuration Modal */}
      {showSeatEditor && selectedTable && (
        <SeatConfigurationEditor
          table={selectedTable}
          onSave={handleSaveSeatLayout}
          onClose={() => setShowSeatEditor(false)}
        />
      )}
    </div>
  );
};