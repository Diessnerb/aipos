import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMenuCategories, MenuCategory } from '@/hooks/useMenuCategories';
import { useAuth } from '@/components/AuthProvider';
import { useMenuItemProductLinks } from '@/hooks/useMenuItemProductLinks';
import { formatMenuItemPrice } from '@/utils/menuItemPriceFormatter';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category_id: string | null;
  tags: string[] | null;
  allergens: string[] | null;
}

type ViewState = 'categories' | 'subcategories' | 'items';

interface NavigationState {
  view: ViewState;
  selectedCategory?: MenuCategory;
  selectedSubcategory?: MenuCategory;
}

export const HierarchicalMenuDisplay = () => {
  const [navigation, setNavigation] = useState<NavigationState>({ view: 'categories' });
  const { companyId } = useAuth();
  const { categories, isLoading: categoriesLoading } = useMenuCategories();
  const { data: productLinksMap = {} } = useMenuItemProductLinks(companyId);

  // Fetch menu items
  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const handleCategoryClick = (category: MenuCategory) => {
    if (category.subcategories && category.subcategories.length > 0) {
      setNavigation({ view: 'subcategories', selectedCategory: category });
    } else {
      setNavigation({ view: 'items', selectedCategory: category });
    }
  };

  const handleSubcategoryClick = (subcategory: MenuCategory) => {
    setNavigation({ 
      view: 'items', 
      selectedCategory: navigation.selectedCategory,
      selectedSubcategory: subcategory 
    });
  };

  const handleBackToCategories = () => {
    setNavigation({ view: 'categories' });
  };

  const handleBackToSubcategories = () => {
    setNavigation({ view: 'subcategories', selectedCategory: navigation.selectedCategory });
  };

  const getFilteredItems = () => {
    if (navigation.selectedSubcategory) {
      return menuItems.filter(item => item.category_id === navigation.selectedSubcategory?.id);
    } else if (navigation.selectedCategory) {
      // Get items from the category and all its subcategories
      const categoryIds = [navigation.selectedCategory.id];
      if (navigation.selectedCategory.subcategories) {
        categoryIds.push(...navigation.selectedCategory.subcategories.map(sub => sub.id));
      }
      return menuItems.filter(item => item.category_id && categoryIds.includes(item.category_id));
    }
    return [];
  };

  const renderBreadcrumb = () => {
    const parts = [];
    
    if (navigation.view === 'categories') {
      parts.push('Menu Categories');
    } else {
      parts.push(
        <Button 
          key="categories"
          variant="ghost" 
          size="sm" 
          onClick={handleBackToCategories}
          className="p-0 h-auto text-primary hover:text-primary/80"
        >
          Menu Categories
        </Button>
      );
      
      if (navigation.selectedCategory) {
        if (navigation.view === 'subcategories') {
          parts.push(navigation.selectedCategory.name);
        } else {
          if (navigation.selectedSubcategory) {
            parts.push(
              <Button 
                key="subcategories"
                variant="ghost" 
                size="sm" 
                onClick={handleBackToSubcategories}
                className="p-0 h-auto text-primary hover:text-primary/80"
              >
                {navigation.selectedCategory.name}
              </Button>
            );
            parts.push(navigation.selectedSubcategory.name);
          } else {
            parts.push(navigation.selectedCategory.name);
          }
        }
      }
    }
    
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        {parts.map((part, index) => [
          index > 0 && <span key={`sep-${index}`}>/</span>,
          <span key={`part-${index}`}>{part}</span>
        ]).flat().filter(Boolean)}
      </div>
    );
  };

  const renderCategories = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
      {categories.map((category) => (
        <Card 
          key={category.id} 
          className="hover:shadow-md transition-shadow cursor-pointer min-h-[120px]"
          onClick={() => handleCategoryClick(category)}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[120px]">
            <h3 className="font-semibold text-lg mb-2">{category.name}</h3>
            {category.description && (
              <p className="text-sm text-muted-foreground">{category.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSubcategories = () => {
    if (!navigation.selectedCategory?.subcategories) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {/* Back to Categories Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-dashed border-2 border-muted-foreground/30 min-h-[120px]"
          onClick={handleBackToCategories}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[120px]">
            <ChevronLeft className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="font-semibold text-lg text-muted-foreground">Back</h3>
          </CardContent>
        </Card>
        
        {navigation.selectedCategory.subcategories.map((subcategory) => (
          <Card 
            key={subcategory.id} 
            className="hover:shadow-md transition-shadow cursor-pointer min-h-[120px]"
            onClick={() => handleSubcategoryClick(subcategory)}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[120px]">
              <h3 className="font-semibold text-lg mb-2">{subcategory.name}</h3>
              {subcategory.description && (
                <p className="text-sm text-muted-foreground">{subcategory.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderItems = () => {
    const items = getFilteredItems();
    
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No menu items found.</p>
          <p className="text-muted-foreground text-sm mt-2">
            This category doesn't have any items yet.
          </p>
        </div>
      );
    }

    // Back button uses consistent "Back" text
    const backHandler = navigation.selectedSubcategory ? handleBackToSubcategories : handleBackToCategories;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {/* Back Navigation Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-dashed border-2 border-muted-foreground/30 min-h-[200px]"
          onClick={backHandler}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
            <ChevronLeft className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="font-semibold text-lg text-muted-foreground">Back</h3>
          </CardContent>
        </Card>
        
        {items.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow min-h-[200px]">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
              <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {item.description || 'No description available'}
              </p>
              <div className="text-2xl font-bold text-green-600 mb-3">
                {formatMenuItemPrice(item, productLinksMap[item.id] || [])}
              </div>
              
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center">
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {item.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{item.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const isLoading = categoriesLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 bg-muted rounded"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-3 bg-muted rounded w-20"></div>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderBreadcrumb()}
      
      {navigation.view === 'categories' && renderCategories()}
      {navigation.view === 'subcategories' && renderSubcategories()}
      {navigation.view === 'items' && renderItems()}
    </div>
  );
};