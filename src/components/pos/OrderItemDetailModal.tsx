import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, MessageSquare } from 'lucide-react';

interface OrderItemDetailModalProps {
  orderItem: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes?: string;
    modifications?: {
      selectedOptions?: Record<string, string>;
      breakdown?: Array<{
        level: number;
        optionName: string;
        price: number;
        isModifier: boolean;
      }>;
      ingredientModifications?: Array<{
        ingredient_id: string;
        ingredient_name: string;
        modification_type: 'removed' | 'extra';
        quantity: number;
        cost_per_unit: number;
      }>;
    };
    menu_items?: {
      name: string;
      allergens?: string[];
      price?: number;
    };
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderItemDetailModal: React.FC<OrderItemDetailModalProps> = ({
  orderItem,
  isOpen,
  onClose
}) => {
  if (!orderItem) return null;

  // Normalize modifications (handle stringified JSON)
  const parsedModifications = React.useMemo(() => {
    const m: any = (orderItem as any).modifications;
    if (!m) return null;
    if (typeof m === 'string') {
      try {
        return JSON.parse(m);
      } catch (e) {
        console.error('[OrderItemDetailModal] Failed to parse modifications', e);
        return null;
      }
    }
    return m;
  }, [orderItem]);

  // Debug: Check modifications data structure
  console.log('Order Item:', orderItem);
  console.log('Modifications (raw):', (orderItem as any).modifications);
  console.log('Modifications (parsed):', parsedModifications);

  // Extract base price from breakdown
  const basePrice = React.useMemo(() => {
    // Try to get base price from breakdown first
    if (parsedModifications?.breakdown && parsedModifications.breakdown.length > 0) {
      const basePriceItem = parsedModifications.breakdown.find(
        (item: any) => !item.isModifier
      );
      if (basePriceItem?.price !== undefined) {
        return basePriceItem.price;
      }
    }
    
    // Fallback to menu item's base price if no breakdown
    return orderItem.menu_items?.price || null;
  }, [parsedModifications, orderItem.menu_items?.price]);

  // Get modifiers only (excluding base price)
  const modifiers = React.useMemo(() => {
    if (!parsedModifications?.breakdown) return [];
    return parsedModifications.breakdown.filter(
      (item: any) => item.isModifier && item.price > 0
    );
  }, [parsedModifications]);

  const hasIngredientMods = parsedModifications?.ingredientModifications && parsedModifications.ingredientModifications.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orderItem.menu_items?.name || 'Order Item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quantity */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              × {orderItem.quantity}
            </Badge>
          </div>

          {/* Base Price */}
          {basePrice !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Base Price:</span>
              <span className="font-semibold">£{basePrice.toFixed(2)}</span>
            </div>
          )}

          {/* Product Options (Modifiers) */}
          {modifiers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Product Options</h4>
                <div className="space-y-1">
                  {modifiers.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex justify-between items-center text-sm pl-4"
                    >
                      <span className="text-muted-foreground">
                        {item.optionName}
                      </span>
                      <span className="text-muted-foreground">
                        +£{item.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Ingredient Modifications */}
          {hasIngredientMods && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Modifications</h4>
                <div className="space-y-1">
                  {parsedModifications.ingredientModifications.map((mod) => (
                    <div key={mod.ingredient_id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        {mod.modification_type === 'removed' ? (
                          <Minus className="h-3 w-3 text-destructive" />
                        ) : (
                          <Plus className="h-3 w-3 text-emerald-600" />
                        )}
                        <span>
                          {mod.modification_type === 'removed' ? 'No ' : 'Extra '}
                          {mod.ingredient_name}
                          {mod.modification_type === 'extra' && mod.quantity > 1 && ` (×${mod.quantity})`}
                        </span>
                      </div>
                      {mod.modification_type === 'extra' && mod.cost_per_unit > 0 && (
                        <span className="text-muted-foreground">
                          +£{(mod.cost_per_unit * mod.quantity).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Allergens */}
          {orderItem.menu_items?.allergens && orderItem.menu_items.allergens.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Allergens</h4>
                <div className="flex flex-wrap gap-1">
                  {orderItem.menu_items.allergens.map((allergen) => (
                    <Badge key={allergen} variant="outline" className="text-xs">
                      {allergen}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {orderItem.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Notes</h4>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    {orderItem.notes}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Item Total */}
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-semibold">Item Total</span>
            <span className="text-lg font-bold text-emerald-600">
              £{orderItem.subtotal.toFixed(2)}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
