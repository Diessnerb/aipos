import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MenuCategory } from '@/hooks/useMenuCategories';
import { ALLERGEN_LIST } from '@/utils/allergens';

export interface FilterState {
  selectedAllergens: string[];
  showWithAllergens: boolean;
  selectedCategories: string[];
  selectedSubcategories: string[];
}

interface FilterSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  categories: MenuCategory[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isCollapsed,
  onToggle,
  categories,
  filters,
  onFiltersChange,
  onSearch
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const toggleAllergen = (allergen: string) => {
    const newSelectedAllergens = filters.selectedAllergens.includes(allergen)
      ? filters.selectedAllergens.filter(a => a !== allergen)
      : [...filters.selectedAllergens, allergen];
    
    onFiltersChange({
      ...filters,
      selectedAllergens: newSelectedAllergens
    });
  };

  const toggleCategory = (categoryId: string) => {
    const newSelectedCategories = filters.selectedCategories.includes(categoryId)
      ? filters.selectedCategories.filter(c => c !== categoryId)
      : [...filters.selectedCategories, categoryId];
    
    onFiltersChange({
      ...filters,
      selectedCategories: newSelectedCategories
    });
  };

  const toggleSubcategory = (subcategoryId: string) => {
    const newSelectedSubcategories = filters.selectedSubcategories.includes(subcategoryId)
      ? filters.selectedSubcategories.filter(s => s !== subcategoryId)
      : [...filters.selectedSubcategories, subcategoryId];
    
    onFiltersChange({
      ...filters,
      selectedSubcategories: newSelectedSubcategories
    });
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearAllFilters = () => {
    onFiltersChange({
      selectedAllergens: [],
      showWithAllergens: false,
      selectedCategories: [],
      selectedSubcategories: []
    });
  };

  const hasActiveFilters = filters.selectedAllergens.length > 0 || 
                          filters.selectedCategories.length > 0 || 
                          filters.selectedSubcategories.length > 0;

  if (isCollapsed) {
    return (
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
        <Button
          onClick={onToggle}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-xs"
            >
              Clear All
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Allergens Filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Allergens</CardTitle>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Show items {filters.showWithAllergens ? 'with' : 'without'} selected allergens
                </span>
                <Switch
                  checked={filters.showWithAllergens}
                  onCheckedChange={(checked) => 
                    onFiltersChange({ ...filters, showWithAllergens: checked })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {ALLERGEN_LIST.map((allergen) => (
                <div key={allergen} className="flex items-center space-x-2">
                  <Checkbox
                    id={allergen}
                    checked={filters.selectedAllergens.includes(allergen)}
                    onCheckedChange={() => toggleAllergen(allergen)}
                  />
                  <label
                    htmlFor={allergen}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {allergen}
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Categories Filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((category) => (
                <div key={category.id}>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={category.id}
                      checked={filters.selectedCategories.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <label
                      htmlFor={category.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {category.name}
                    </label>
                    {category.subcategories && category.subcategories.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleCategoryExpansion(category.id)}
                      >
                        {expandedCategories.includes(category.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Subcategories */}
                  {category.subcategories && category.subcategories.length > 0 && expandedCategories.includes(category.id) && (
                    <div className="ml-6 mt-2 space-y-2">
                      {category.subcategories.map((subcategory) => (
                        <div key={subcategory.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={subcategory.id}
                            checked={filters.selectedSubcategories.includes(subcategory.id)}
                            onCheckedChange={() => toggleSubcategory(subcategory.id)}
                          />
                          <label
                            htmlFor={subcategory.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {subcategory.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Search Button */}
      <div className="p-4 border-t border-border">
        <Button 
          onClick={onSearch} 
          className="w-full" 
          size="lg"
          disabled={!hasActiveFilters}
        >
          <Search className="h-4 w-4 mr-2" />
          Apply Filters
          {hasActiveFilters && (
            <span className="ml-2 bg-primary-foreground text-primary px-2 py-1 rounded-full text-xs">
              {filters.selectedAllergens.length + filters.selectedCategories.length + filters.selectedSubcategories.length}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};