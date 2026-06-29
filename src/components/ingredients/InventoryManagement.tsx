import React, { useState } from 'react';
import { Plus, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StockAdjustmentModal } from './StockAdjustmentModal';

interface InventoryManagementProps {
  currentStock: number;
  stockUnit: string;
  ingredientName: string;
  onStockChange: (newStock: number, reason: string, notes: string) => void;
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({
  currentStock,
  stockUnit,
  ingredientName,
  onStockChange,
}) => {
  const [modalType, setModalType] = useState<'add' | 'remove' | 'adjust' | null>(null);

  const handleStockAdjustment = (quantity: number, reason: string, notes: string) => {
    let newStock = currentStock;
    
    if (modalType === 'add') {
      newStock = currentStock + quantity;
    } else if (modalType === 'remove') {
      newStock = Math.max(0, currentStock - quantity);
    } else if (modalType === 'adjust') {
      newStock = quantity;
    }
    
    onStockChange(newStock, reason, notes);
  };

  return (
    <div className="mb-6">
      <div className="p-4 border rounded-lg bg-muted/20">
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Quick Stock Actions
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalType('add')}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Stock
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalType('remove')}
            className="flex-1"
          >
            <Minus className="h-4 w-4 mr-1" />
            Remove Stock
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalType('adjust')}
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Adjust Count
          </Button>
        </div>
      </div>

      {modalType && (
        <StockAdjustmentModal
          isOpen={true}
          onClose={() => setModalType(null)}
          ingredientName={ingredientName}
          currentStock={currentStock}
          unit={stockUnit}
          type={modalType}
          onSubmit={handleStockAdjustment}
        />
      )}
    </div>
  );
};
