import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search } from 'lucide-react';
import { useWastage } from '@/hooks/useWastage';
import { useAuth } from '@/components/AuthProvider';

interface WastageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: 'kitchen' | 'bar';
  items: Array<{
    id: string;
    name: string;
    type: 'menu_item' | 'ingredient';
    unit_cost?: number;
  }>;
}

export const WastageModal: React.FC<WastageModalProps> = ({
  open,
  onOpenChange,
  location,
  items,
}) => {
  const { pinUser } = useAuth();
  const { logWastage } = useWastage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<typeof items[0] | null>(null);
  const [quantity, setQuantity] = useState('');
  const [wastageType, setWastageType] = useState<'expired' | 'damaged' | 'overproduction' | 'other'>('expired');
  const [notes, setNotes] = useState('');

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleItemSelect = (item: typeof items[0]) => {
    setSelectedItem(item);
    setSearchQuery('');
  };

  const handleSubmit = async () => {
    if (!selectedItem || !quantity || !pinUser?.company_id) return;

    const quantityNum = parseFloat(quantity);
    const totalCost = selectedItem.unit_cost ? selectedItem.unit_cost * quantityNum : 0;

    await logWastage({
      company_id: pinUser.company_id,
      ingredient_id: selectedItem.id,
      quantity: quantityNum,
      unit: 'unit', // Default unit, should be fetched from ingredient
      reason: wastageType,
      cost_impact: totalCost,
      location,
      notes: notes || null,
      wastage_time: new Date().toISOString(),
    });

    // Reset form
    setSelectedItem(null);
    setQuantity('');
    setWastageType('expired');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Log Wastage - {location === 'kitchen' ? 'Kitchen' : 'Bar'}
          </DialogTitle>
        </DialogHeader>

        {!selectedItem ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items or ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemSelect(item)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {item.type.replace('_', ' ')}
                    {item.unit_cost && ` • £${item.unit_cost.toFixed(2)}`}
                  </div>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No items found
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted">
              <div className="font-medium">{selectedItem.name}</div>
              <div className="text-sm text-muted-foreground capitalize">
                {selectedItem.type.replace('_', ' ')}
              </div>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>

            <div>
              <Label htmlFor="wastage_type">Reason *</Label>
              <select
                id="wastage_type"
                value={wastageType}
                onChange={(e) => setWastageType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="expired">Expired</option>
                <option value="damaged">Damaged</option>
                <option value="overproduction">Overproduction</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedItem(null);
                  setQuantity('');
                  setNotes('');
                }}
              >
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={!quantity}>
                ✅ Log Wastage
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
