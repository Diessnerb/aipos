import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, ShoppingCart, Truck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInstantData } from '@/hooks/useInstantData';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Ingredient } from '@/types/ingredients';
import { OrderBasket } from './OrderBasket';
import { EditIngredientModal } from '@/components/modals/EditIngredientModal';

interface ManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BasketItem {
  ingredient: Ingredient;
  quantity: number;
  supplierId: string;
  supplierName: string;
}

export const ManualOrderDialog: React.FC<ManualOrderDialogProps> = ({ open, onOpenChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const { getInstantIngredients } = useInstantData();
  const { suppliers } = useSuppliers();

  const ingredients = (getInstantIngredients().data || []) as Ingredient[];

  // Filter ingredients - show all, not just those with suppliers
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(ing => 
      ing.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ingredients, searchQuery]);

  // Group by supplier, including ingredients without suppliers
  const ingredientsBySupplier = useMemo(() => {
    const groups = new Map<string, { supplier: string; items: Ingredient[]; hasSupplier: boolean }>();
    
    filteredIngredients.forEach(ing => {
      let supplierName: string;
      let hasSupplier: boolean;
      
      if (ing.supplier_id) {
        const supplier = suppliers.find(s => s.id === ing.supplier_id);
        supplierName = supplier?.name || 'Unknown Supplier';
        hasSupplier = true;
      } else {
        supplierName = '⚠️ No Supplier Assigned';
        hasSupplier = false;
      }
      
      if (!groups.has(supplierName)) {
        groups.set(supplierName, { supplier: supplierName, items: [], hasSupplier });
      }
      groups.get(supplierName)!.items.push(ing);
    });

    // Sort: suppliers first (alphabetically), then "No Supplier" group at the end
    return Array.from(groups.values()).sort((a, b) => {
      if (a.hasSupplier && !b.hasSupplier) return -1;
      if (!a.hasSupplier && b.hasSupplier) return 1;
      return a.supplier.localeCompare(b.supplier);
    });
  }, [filteredIngredients, suppliers]);

  const handleAddToBasket = (ingredient: Ingredient, quantity: number) => {
    const supplier = suppliers.find(s => s.id === ingredient.supplier_id);
    if (!supplier) return;

    setBasket(prev => {
      const existing = prev.find(item => item.ingredient.id === ingredient.id);
      if (existing) {
        return prev.map(item =>
          item.ingredient.id === ingredient.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, {
        ingredient,
        quantity,
        supplierId: supplier.id,
        supplierName: supplier.name
      }];
    });
  };

  const handleUpdateQuantity = (ingredientId: string, quantity: number) => {
    if (quantity <= 0) {
      setBasket(prev => prev.filter(item => item.ingredient.id !== ingredientId));
    } else {
      setBasket(prev =>
        prev.map(item =>
          item.ingredient.id === ingredientId ? { ...item, quantity } : item
        )
      );
    }
  };

  const handleRemoveItem = (ingredientId: string) => {
    setBasket(prev => prev.filter(item => item.ingredient.id !== ingredientId));
  };

  const handleOrdersCreated = () => {
    setBasket([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl">New Manual Order</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Ingredient Selection */}
          <div className="flex-1 border-r p-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[calc(90vh-220px)]">
              {ingredientsBySupplier.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No ingredients found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {ingredientsBySupplier.map(group => (
                    <div key={group.supplier}>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                        {group.supplier}
                      </h3>
                      <div className="space-y-2">
                        {group.items.map(ingredient => (
                    <IngredientRow
                      key={ingredient.id}
                      ingredient={ingredient}
                      onAdd={handleAddToBasket}
                      onEditSupplier={setEditingIngredient}
                      isInBasket={basket.some(item => item.ingredient.id === ingredient.id)}
                      hasSupplier={group.hasSupplier}
                    />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel - Order Basket */}
          <div className="w-[400px] bg-muted/30 flex flex-col">
            <div className="p-6 border-b bg-background">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <h3 className="font-semibold text-lg">Order Basket</h3>
                <span className="text-muted-foreground text-sm">
                  ({basket.length} {basket.length === 1 ? 'item' : 'items'})
                </span>
              </div>
            </div>
            
            <OrderBasket
              items={basket}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onOrdersCreated={handleOrdersCreated}
            />
          </div>
        </div>
      </DialogContent>

      {editingIngredient && (
        <EditIngredientModal
          isOpen={!!editingIngredient}
          onClose={() => setEditingIngredient(null)}
          ingredient={editingIngredient}
        />
      )}
    </Dialog>
  );
};

interface IngredientRowProps {
  ingredient: Ingredient;
  onAdd: (ingredient: Ingredient, quantity: number) => void;
  onEditSupplier: (ingredient: Ingredient) => void;
  isInBasket: boolean;
  hasSupplier: boolean;
}

const IngredientRow: React.FC<IngredientRowProps> = ({ 
  ingredient, 
  onAdd, 
  onEditSupplier,
  isInBasket, 
  hasSupplier 
}) => {
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    if (quantity > 0) {
      onAdd(ingredient, quantity);
      setQuantity(1);
    }
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors ${hasSupplier ? 'hover:bg-accent/50' : 'opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{ingredient.name}</p>
          {!hasSupplier && (
            <>
              <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                No Supplier
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary hover:text-primary/80 hover:bg-primary/10"
                onClick={() => onEditSupplier(ingredient)}
                title="Assign supplier"
              >
                <Truck className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
          <span>Stock: {ingredient.stock_level || 0} {ingredient.known_as || ingredient.stock_unit || 'units'}</span>
          {ingredient.purchase_price && (
            <span>£{ingredient.purchase_price.toFixed(2)}/{ingredient.known_as || ingredient.stock_unit || 'unit'}</span>
          )}
        </div>
        {!hasSupplier && (
          <p className="text-xs text-destructive mt-1">
            Assign a supplier in Settings → Ingredients to enable ordering
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-20 h-9"
          disabled={!hasSupplier}
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={isInBasket || !hasSupplier}
          className="shrink-0"
          title={!hasSupplier ? 'Assign a supplier first' : ''}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};