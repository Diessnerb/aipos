import React, { useState, useEffect } from 'react';
import { useIngredients } from '@/hooks/useIngredients';
import { useIngredientsUsage } from '@/hooks/useIngredientUsage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Search } from 'lucide-react';
import { Ingredient } from '@/types/ingredients';
import { EditIngredientModal } from '@/components/modals/EditIngredientModal';
import { DeleteIngredientModal } from '@/components/modals/DeleteIngredientModal';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuItemsUsageBadge } from '@/components/ingredients/MenuItemsUsageBadge';
import { StockLevelBadge } from '@/components/ingredients/StockLevelBadge';

const IngredientsManagement = () => {
  const { ingredients, isLoading } = useIngredients();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch usage data for all ingredients
  const ingredientNames = ingredients.map(i => i.name);
  const { data: usageData } = useIngredientsUsage(ingredientNames);

  // Keep selectedIngredient in sync with latest data from React Query cache
  useEffect(() => {
    if (selectedIngredient) {
      const updatedIngredient = ingredients.find(
        ing => ing.id === selectedIngredient.id
      );
      if (updatedIngredient) {
        setSelectedIngredient(updatedIngredient);
      }
    }
  }, [ingredients, selectedIngredient]);

  const filteredIngredients = ingredients.filter(ingredient =>
    ingredient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (ingredient: Ingredient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIngredient(ingredient);
    setIsEditModalOpen(true);
  };

  const handleDelete = (ingredient: Ingredient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIngredient(ingredient);
    setIsDeleteModalOpen(true);
  };

  const handleRowClick = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setIsEditModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Ingredients List */}
        <div className="border rounded-lg overflow-hidden">
          {filteredIngredients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No ingredients found matching your search.' : 'No ingredients yet. Add your first ingredient to get started.'}
            </div>
          ) : (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {filteredIngredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  onClick={() => handleRowClick(ingredient)}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  <span className="font-medium text-foreground">{ingredient.name}</span>
                  
                  <div className="flex items-center gap-3">
                    {/* Inventory Badges */}
                    <div className="flex items-center gap-2">
                      <MenuItemsUsageBadge
                        count={usageData?.[ingredient.name]?.count || 0}
                        menuItems={usageData?.[ingredient.name]?.items || []}
                      />
                      <StockLevelBadge
                        stockLevel={ingredient.stock_level || 0}
                        stockUnit={ingredient.stock_unit || 'kg'}
                        lastUpdated={ingredient.last_stock_update}
                      />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEdit(ingredient, e)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(ingredient, e)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedIngredient && (
        <>
          <EditIngredientModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedIngredient(null);
            }}
            ingredient={selectedIngredient}
          />
          <DeleteIngredientModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedIngredient(null);
            }}
            ingredient={selectedIngredient}
          />
        </>
      )}
    </>
  );
};

export default IngredientsManagement;
