import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MenuItem } from '@/types/menu';
import { ProductLink } from '@/types/productLinks';
import { IngredientModification } from '@/types/ingredients';
import { useCurrencyFormatter } from '@/utils/currencyFormatter';
import { AlertTriangle, Info, MessageSquare } from 'lucide-react';
import { ProductLinkSelector } from './ProductLinkSelector';
import { PriceBreakdownCard } from './PriceBreakdownCard';
import { IngredientModifierSection } from './IngredientModifierSection';
import { useMenuItemIngredients } from '@/hooks/useMenuItemIngredients';
import { MenuItemAllergenDisplay } from './MenuItemAllergenDisplay';
import { ItemNotesDialog } from './ItemNotesDialog';
import {
  buildProductLinkTree,
  calculatePrice,
  getPriceBreakdown,
  getPricingMode,
  getPriceRange,
  SelectedOptions,
} from '@/utils/productLinkCalculator';

interface MenuItemDetailModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  productLinks?: ProductLink[];
  onAddToBasket?: (selectedOptions: SelectedOptions, price: number, breakdown: any[], ingredientMods?: IngredientModification[], notes?: string) => void;
  showAddToBasket?: boolean;
  hidePriceExplorer?: boolean;
  hideIngredients?: boolean;
  initialIngredientModifications?: IngredientModification[];
  initialSelectedOptions?: SelectedOptions;
  initialNotes?: string;
  isEditMode?: boolean;
}

export const MenuItemDetailModal: React.FC<MenuItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  productLinks = [],
  onAddToBasket,
  showAddToBasket = false,
  hidePriceExplorer = false,
  hideIngredients = false,
  initialIngredientModifications,
  initialSelectedOptions,
  initialNotes,
  isEditMode = false,
}) => {
  const { formatCurrency } = useCurrencyFormatter();
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});
  const [ingredientModifications, setIngredientModifications] = useState<IngredientModification[]>([]);
  const [itemNotes, setItemNotes] = useState<string>('');
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  
  // Fetch ingredients for this menu item
  const { ingredients } = useMenuItemIngredients(item?.id);
  
  const hasProductLinks = item && productLinks.length > 0;
  
  // Recalculate levelMap whenever selectedOptions changes
  const levelMap = useMemo(() => {
    if (!hasProductLinks) return new Map();
    return buildProductLinkTree(productLinks, selectedOptions);
  }, [hasProductLinks, productLinks, selectedOptions]);
  
  const pricingMode = hasProductLinks ? getPricingMode(productLinks) : 'modifier';
  const priceRange = hasProductLinks && item ? getPriceRange(item, productLinks) : null;
  
  // Auto-select first option in level 1 only on mount, and reset ingredient modifications
  useEffect(() => {
    if (hasProductLinks && isOpen && item) {
      // If we have initial selections (editing mode), use those
      if (initialSelectedOptions && Object.keys(initialSelectedOptions).length > 0) {
        setSelectedOptions(initialSelectedOptions);
      } else {
        // Otherwise auto-select level 1 first option (new item mode)
        const initialSelections: SelectedOptions = {};
        const tree = buildProductLinkTree(productLinks, initialSelections);
        
        // Only auto-select level 1
        const level1Options = tree.get(1);
        if (level1Options && level1Options.length > 0) {
          initialSelections[1] = level1Options[0].id;
        }
        
        setSelectedOptions(initialSelections);
      }
    }
    
    // Reset or pre-populate ingredient modifications and notes when modal opens
    if (isOpen) {
      setIngredientModifications(initialIngredientModifications || []);
      setItemNotes(initialNotes || '');
    }
  }, [hasProductLinks, isOpen, productLinks, item, initialSelectedOptions, initialIngredientModifications, initialNotes]);

  const calculatedPrice = hasProductLinks && item
    ? calculatePrice(item, selectedOptions, productLinks)
    : item?.price || 0;
  
  // Add ingredient modification costs
  const ingredientCost = ingredientModifications.reduce((sum, mod) => {
    return sum + (mod.modification_type === 'extra' ? mod.cost_per_unit * mod.quantity : 0);
  }, 0);
  
  const finalPrice = calculatedPrice + ingredientCost;
  
  const breakdown = hasProductLinks && item
    ? getPriceBreakdown(item, selectedOptions, productLinks)
    : [];

  const handleOptionSelect = (level: number, linkId: string) => {
    setSelectedOptions(prev => {
      const newSelections = { ...prev, [level]: linkId };
      
      // Clear all selections from levels higher than the changed level
      const maxLevel = Math.max(...Object.keys(newSelections).map(Number));
      for (let l = level + 1; l <= maxLevel; l++) {
        delete newSelections[l];
      }
      
      return newSelections;
    });
  };

  const handleClearSelections = () => {
    setSelectedOptions({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!item ? (
          <div className="p-6 text-center text-muted-foreground">
            No item selected
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header with Name and Price */}
            <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-3xl font-bold flex-1">
                {item.name}
              </DialogTitle>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  {formatCurrency(finalPrice)}
                </div>
                {hasProductLinks && priceRange && priceRange.min !== priceRange.max && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Range: {formatCurrency(priceRange.min)} - {formatCurrency(priceRange.max)}
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Allergen Warning Section */}
          <MenuItemAllergenDisplay 
            menuItemId={item.id} 
            variant="full"
            className="pt-4 border-t"
          />

          {/* Ingredient Modifiers Section */}
          {!hideIngredients && ingredients.length > 0 && (
            <IngredientModifierSection
              ingredients={ingredients}
              modifications={ingredientModifications}
              onModificationChange={setIngredientModifications}
              formatCurrency={formatCurrency}
            />
          )}

          {/* Product Links Explorer */}
          {hasProductLinks && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Section 2: Select Type/Size</h3>
                <div className="space-y-5">
                  {Array.from(levelMap.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([level, options]) => (
                      <ProductLinkSelector
                        key={level}
                        level={level}
                        options={options}
                        selectedId={selectedOptions[level]}
                        onSelect={(linkId) => handleOptionSelect(level, linkId)}
                        pricingMode={pricingMode}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                </div>
              </div>

            </div>
          )}




          {/* Add to Basket Button (POS only) */}
          {showAddToBasket && onAddToBasket && (
            <div className="pt-4 border-t space-y-3">
              <Button
                variant="outline"
                onClick={() => setShowNotesDialog(true)}
                className="w-full"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {itemNotes ? 'Edit Notes' : 'Add Notes'}
                {itemNotes && <Badge variant="secondary" className="ml-2">✓</Badge>}
              </Button>
              
              <Button 
                onClick={() => onAddToBasket(selectedOptions, finalPrice, breakdown, ingredientModifications, itemNotes)}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
              >
                {isEditMode ? 'Update Item' : 'Add to Basket'} - {formatCurrency(finalPrice)}
              </Button>
            </div>
          )}
          </div>
        )}
      </DialogContent>
      
      <ItemNotesDialog
        isOpen={showNotesDialog}
        onClose={() => setShowNotesDialog(false)}
        notes={itemNotes}
        onNotesChange={setItemNotes}
      />
    </Dialog>
  );
};
