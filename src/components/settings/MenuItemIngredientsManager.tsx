import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, X } from 'lucide-react';
import { useMenuItemIngredients } from '@/hooks/useMenuItemIngredients';
import { useIngredients } from '@/hooks/useIngredients';
import { useAuth } from '@/components/AuthProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IngredientSelector } from '@/components/menu-settings/IngredientSelector';
import { Ingredient } from '@/types/ingredients';

interface MenuItemIngredientsManagerProps {
  menuItemId: string;
}

export const MenuItemIngredientsManager: React.FC<MenuItemIngredientsManagerProps> = ({
  menuItemId,
}) => {
  const { companyId } = useAuth();
  const { ingredients, isLoading, createIngredient, updateIngredient, deleteIngredient } = useMenuItemIngredients(menuItemId);
  
  const [editingCosts, setEditingCosts] = useState<Record<string, string>>({});
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});
  const [selectedMasterIngredient, setSelectedMasterIngredient] = useState<Ingredient | null>(null);
  const [addQuantity, setAddQuantity] = useState('1.0');

  // Helper to format quantity display (remove unnecessary trailing zeros)
  const formatQuantity = (qty: number): string => {
    return qty % 1 === 0 ? qty.toFixed(0) : qty.toString();
  };

  const handleAddFromLibrary = () => {
    if (!selectedMasterIngredient || !companyId) return;
    
    const quantityValue = parseFloat(addQuantity) || 1;
    
    // Snapshot data from master ingredient
    createIngredient({
      menu_item_id: menuItemId,
      company_id: companyId,
      ingredient_name: selectedMasterIngredient.name,
      is_included: true,
      add_on_cost: selectedMasterIngredient.sale_price,
      quantity: quantityValue,
      display_order: ingredients.length,
      allergens: selectedMasterIngredient.allergens || [],
    });

    // Reset selection
    setSelectedMasterIngredient(null);
    setAddQuantity('1.0');
  };



  if (isLoading) {
    return <div className="text-center py-4">Loading ingredients...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Base Ingredients & Add-on Pricing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing Ingredients List */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Current Ingredients</Label>
          <ScrollArea className="h-[400px] border rounded-md">
            <div className="space-y-2 p-4">
              {ingredients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No ingredients defined yet. Add your first ingredient below.
                </p>
              ) : (
                ingredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border hover:bg-muted transition-colors"
                  >
                    {/* Name (read-only) */}
                    <span className="font-medium text-sm min-w-[140px]">
                      {ingredient.ingredient_name}
                    </span>
                    
                    {/* Quantity (editable inline) */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Quantity:</span>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={editingQuantities[ingredient.id] ?? ingredient.quantity}
                        onChange={(e) =>
                          setEditingQuantities({
                            ...editingQuantities,
                            [ingredient.id]: e.target.value,
                          })
                        }
                        onBlur={() => {
                          const newQty = editingQuantities[ingredient.id];
                          if (newQty !== undefined) {
                            const qtyValue = parseFloat(newQty) || 0.1;
                            if (qtyValue !== ingredient.quantity) {
                              updateIngredient({
                                id: ingredient.id,
                                quantity: qtyValue,
                              });
                            }
                          }
                          const { [ingredient.id]: _, ...rest } = editingQuantities;
                          setEditingQuantities(rest);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-20 h-8 text-center text-sm"
                      />
                      <span className="text-xs text-muted-foreground">× per serving</span>
                    </div>
                    
                    {/* Price (editable inline) */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Price for add on:</span>
                      <span className="text-sm font-medium">£</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingCosts[ingredient.id] ?? ingredient.add_on_cost}
                        onChange={(e) =>
                          setEditingCosts({
                            ...editingCosts,
                            [ingredient.id]: e.target.value,
                          })
                        }
                        onBlur={() => {
                          const newCost = editingCosts[ingredient.id];
                          if (newCost !== undefined) {
                            const parsedCost = parseFloat(newCost);
                            const finalCost = isNaN(parsedCost) ? 0 : parsedCost;
                            
                            if (finalCost !== ingredient.add_on_cost) {
                              updateIngredient({
                                id: ingredient.id,
                                add_on_cost: finalCost,
                              });
                            }
                          }
                          const { [ingredient.id]: _, ...rest } = editingCosts;
                          setEditingCosts(rest);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                    
                    {/* Allergens (read-only inline badges) */}
                    <div className="flex-1 flex flex-wrap gap-1.5 min-w-[200px]">
                      {ingredient.allergens && ingredient.allergens.length > 0 ? (
                        ingredient.allergens.map((allergen, idx) => (
                          <Badge key={idx} variant="destructive" className="text-xs py-0.5 px-2">
                            {allergen}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No allergens</span>
                      )}
                    </div>
                    
                    
                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      onClick={() => deleteIngredient(ingredient.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Add Ingredient from Library */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-semibold">Add Ingredient from Library</Label>
          
          {/* Ingredient Selector */}
          <IngredientSelector
            onSelect={setSelectedMasterIngredient}
            value={selectedMasterIngredient?.id}
            placeholder="Search for an ingredient..."
          />
          
          {/* Selected Ingredient Preview */}
          {selectedMasterIngredient && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{selectedMasterIngredient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    £{selectedMasterIngredient.sale_price.toFixed(2)} / {selectedMasterIngredient.portion_type}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedMasterIngredient(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Allergens Display */}
              {selectedMasterIngredient.allergens && selectedMasterIngredient.allergens.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Allergens:</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedMasterIngredient.allergens.map((allergen, idx) => (
                      <Badge key={idx} variant="destructive" className="text-xs">
                        {allergen}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Quantity Input */}
              <div className="space-y-1">
                <Label className="text-xs">Quantity per Serving</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="w-32"
                  placeholder="e.g., 1 or 12.5"
                />
                <p className="text-xs text-muted-foreground">
                  Use whole numbers (1, 2, 3) or decimals (0.5, 12.5, 37.5)
                </p>
              </div>
            </div>
          )}
          
          {/* Add Button */}
          <Button
            onClick={handleAddFromLibrary}
            disabled={!selectedMasterIngredient}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Menu Item
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">💡 How Ingredient Quantities Work:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li><strong>Whole numbers</strong>: Use for countable items (e.g., "2" eggs, "3" bacon strips)</li>
            <li><strong>Decimals</strong>: Use for measured items (e.g., "12.5" ml vodka, "0.5" portions)</li>
            <li><strong>Example</strong>: A Pornstar Martini might have 12.5ml vodka + 50ml passoa + 12.5ml sugar syrup</li>
            <li>Customers can add <strong>extras</strong> which multiply the base quantity</li>
            <li><strong>Allergens</strong> from included ingredients automatically display on the menu item</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

