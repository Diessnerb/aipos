import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Minus, ChevronDown } from 'lucide-react';
import { MenuItemIngredient, IngredientModification } from '@/types/ingredients';
import { cn } from '@/lib/utils';

interface IngredientModifierSectionProps {
  ingredients: MenuItemIngredient[];
  modifications: IngredientModification[];
  onModificationChange: (modifications: IngredientModification[]) => void;
  formatCurrency: (amount: number) => string;
}

export const IngredientModifierSection: React.FC<IngredientModifierSectionProps> = ({
  ingredients,
  modifications,
  onModificationChange,
  formatCurrency,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const getIngredientStatus = (ingredient: MenuItemIngredient) => {
    const mod = modifications.find(m => m.ingredient_id === ingredient.id);
    
    if (mod) {
      if (mod.modification_type === 'removed') {
        return { 
          label: 'Removed', 
          variant: 'destructive' as const, 
          totalQuantity: 0 
        };
      } else {
        const totalQty = ingredient.quantity + mod.quantity;
        return { 
          label: 'Extra', 
          variant: 'default' as const, 
          totalQuantity: totalQty 
        };
      }
    }
    
    return ingredient.is_included 
      ? { 
          label: 'Included', 
          variant: 'outline' as const, 
          totalQuantity: ingredient.quantity 
        }
      : { 
          label: 'Not Included', 
          variant: 'secondary' as const, 
          totalQuantity: 0 
        };
  };

  const handleDecrease = (ingredient: MenuItemIngredient) => {
    const currentMod = modifications.find(m => m.ingredient_id === ingredient.id);
    
    if (!currentMod && ingredient.is_included) {
      // Mark as removed
      onModificationChange([
        ...modifications,
        {
          ingredient_id: ingredient.id,
          ingredient_name: ingredient.ingredient_name,
          modification_type: 'removed',
          quantity: 0,
          cost_per_unit: 0,
        },
      ]);
    } else if (currentMod && currentMod.modification_type === 'extra' && currentMod.quantity > 1) {
      // Decrease extra count
      onModificationChange(
        modifications.map(m =>
          m.ingredient_id === ingredient.id
            ? { ...m, quantity: m.quantity - 1 }
            : m
        )
      );
    } else if (currentMod && currentMod.modification_type === 'extra' && currentMod.quantity === 1) {
      // Remove modification (back to default)
      onModificationChange(modifications.filter(m => m.ingredient_id !== ingredient.id));
    }
  };

  const handleIncrease = (ingredient: MenuItemIngredient) => {
    const currentMod = modifications.find(m => m.ingredient_id === ingredient.id);
    
    if (currentMod && currentMod.modification_type === 'removed') {
      // Change from removed to default (remove modification)
      onModificationChange(modifications.filter(m => m.ingredient_id !== ingredient.id));
    } else if (currentMod && currentMod.modification_type === 'extra') {
      // Increase extra count
      onModificationChange(
        modifications.map(m =>
          m.ingredient_id === ingredient.id
            ? { ...m, quantity: m.quantity + 1 }
            : m
        )
      );
    } else {
      // Add first extra
      onModificationChange([
        ...modifications,
        {
          ingredient_id: ingredient.id,
          ingredient_name: ingredient.ingredient_name,
          modification_type: 'extra',
          quantity: 1,
          cost_per_unit: ingredient.add_on_cost,
        },
      ]);
    }
  };

  if (ingredients.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-muted/30">
        <CardContent className="pt-6 space-y-4">
          <CollapsibleTrigger className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
            <h3 className="text-lg font-semibold">Section 1: Customize Ingredients</h3>
            <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", isOpen && "rotate-180")} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-3">
            <div className="space-y-3">
              {ingredients.map(ingredient => {
            const status = getIngredientStatus(ingredient);
            const currentMod = modifications.find(m => m.ingredient_id === ingredient.id);
            const canDecrease = status.totalQuantity > 0 || (currentMod?.modification_type === 'removed');
            
            return (
              <div
                key={ingredient.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {ingredient.quantity > 1 && (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {ingredient.quantity}×
                      </span>
                    )}
                    <span className="font-medium">{ingredient.ingredient_name}</span>
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                  </div>
                  {ingredient.add_on_cost > 0 && (
                    <span className="text-xs text-muted-foreground">
                      +{formatCurrency(ingredient.add_on_cost)} per extra
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDecrease(ingredient)}
                    disabled={!canDecrease}
                    className="h-8 w-8"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center justify-center min-w-[32px] h-8 px-2 text-sm font-semibold">
                    {status.totalQuantity}
                  </div>
                  
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleIncrease(ingredient)}
                    className="h-8 w-8"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
