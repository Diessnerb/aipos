import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getBoundCompany } from '@/utils/deviceBinding';

interface TableSetupStepProps {
  onComplete: () => void;
  isCompleted: boolean;
}

interface TableData {
  tableNumber: number;
  tableName: string;
  seats: number;
  location: string;
  type: string;
}

export const TableSetupStep: React.FC<TableSetupStepProps> = ({ onComplete, isCompleted }) => {
  const [tables, setTables] = useState<TableData[]>([
    { tableNumber: 1, tableName: 'Table 1', seats: 4, location: 'Main Dining', type: 'standard' }
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const addTable = () => {
    const nextNumber = Math.max(...tables.map(t => t.tableNumber), 0) + 1;
    setTables([...tables, {
      tableNumber: nextNumber,
      tableName: `Table ${nextNumber}`,
      seats: 4,
      location: 'Main Dining',
      type: 'standard'
    }]);
  };

  const removeTable = (index: number) => {
    setTables(tables.filter((_, i) => i !== index));
  };

  const updateTable = (index: number, field: keyof TableData, value: string | number) => {
    const updated = [...tables];
    updated[index] = { ...updated[index], [field]: value };
    setTables(updated);
  };

  const createTables = async () => {
    if (tables.length === 0) {
      toast({
        title: 'No tables to create',
        description: 'Please add at least one table before continuing.',
        variant: 'destructive'
      });
      return;
    }

    const boundCompany = getBoundCompany();
    if (!boundCompany) {
      toast({
        title: 'Error',
        description: 'No company found. Please try logging in again.',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);
    try {
      const tablesToCreate = tables.map(table => ({
        company_id: boundCompany.company_id,
        table_number: table.tableNumber,
        table_name: table.tableName,
        seats: table.seats,
        location: table.location,
        type: table.type,
        is_active: true,
        service_status: 'available'
      }));

      const { error } = await supabase
        .from('tables')
        .insert(tablesToCreate);

      if (error) throw error;

      toast({
        title: 'Tables created successfully',
        description: `Created ${tables.length} table(s) for your restaurant.`
      });

      onComplete();
    } catch (error: any) {
      console.error('Error creating tables:', error);
      toast({
        title: 'Error creating tables',
        description: error.message || 'Failed to create tables',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold flex items-center justify-center gap-2">
          {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
          Table Layout Setup
        </h3>
        <p className="text-muted-foreground">
          Add your tables to start taking reservations and managing seating
        </p>
      </div>

      {/* Tables List */}
      <div className="space-y-4">
        {tables.map((table, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <Label htmlFor={`table-number-${index}`}>Table Number</Label>
                  <Input
                    id={`table-number-${index}`}
                    type="number"
                    value={table.tableNumber}
                    onChange={(e) => updateTable(index, 'tableNumber', parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>
                
                <div>
                  <Label htmlFor={`table-name-${index}`}>Table Name</Label>
                  <Input
                    id={`table-name-${index}`}
                    value={table.tableName}
                    onChange={(e) => updateTable(index, 'tableName', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor={`seats-${index}`}>Seats</Label>
                  <Select
                    value={table.seats.toString()}
                    onValueChange={(value) => updateTable(index, 'seats', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {num}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor={`location-${index}`}>Location</Label>
                  <Select
                    value={table.location}
                    onValueChange={(value) => updateTable(index, 'location', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Main Dining">Main Dining</SelectItem>
                      <SelectItem value="Patio">Patio</SelectItem>
                      <SelectItem value="Bar Area">Bar Area</SelectItem>
                      <SelectItem value="Private Room">Private Room</SelectItem>
                      <SelectItem value="Outdoor">Outdoor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant={table.type === 'vip' ? 'default' : 'secondary'}>
                    {table.type === 'vip' ? 'VIP' : 'Standard'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeTable(index)}
                    disabled={tables.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Table Button */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={addTable}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Another Table
        </Button>
      </div>

      {/* Quick Setup Options */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Quick Setup Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const smallCafe = [
                  { tableNumber: 1, tableName: 'Table 1', seats: 2, location: 'Main Dining', type: 'standard' },
                  { tableNumber: 2, tableName: 'Table 2', seats: 2, location: 'Main Dining', type: 'standard' },
                  { tableNumber: 3, tableName: 'Table 3', seats: 4, location: 'Main Dining', type: 'standard' },
                  { tableNumber: 4, tableName: 'Table 4', seats: 4, location: 'Main Dining', type: 'standard' }
                ];
                setTables(smallCafe);
              }}
            >
              Small Café (4 tables)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const restaurant = Array.from({ length: 12 }, (_, i) => ({
                  tableNumber: i + 1,
                  tableName: `Table ${i + 1}`,
                  seats: i < 4 ? 2 : i < 8 ? 4 : 6,
                  location: i < 8 ? 'Main Dining' : 'Patio',
                  type: 'standard' as const
                }));
                setTables(restaurant);
              }}
            >
              Restaurant (12 tables)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const fineDining = Array.from({ length: 8 }, (_, i) => ({
                  tableNumber: i + 1,
                  tableName: `Table ${i + 1}`,
                  seats: i < 2 ? 2 : i < 6 ? 4 : 6,
                  location: i < 6 ? 'Main Dining' : 'Private Room',
                  type: i >= 6 ? 'vip' : 'standard' as const
                }));
                setTables(fineDining);
              }}
            >
              Fine Dining (8 tables)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center pt-4">
        <Button 
          onClick={createTables}
          disabled={isCreating || tables.length === 0}
          size="lg"
        >
          {isCreating ? 'Creating Tables...' : `Create ${tables.length} Table${tables.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
};