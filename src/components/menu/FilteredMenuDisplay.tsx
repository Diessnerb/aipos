import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Search } from 'lucide-react';
import { useMenuItemsQuery } from '@/hooks/useMenuItemsQuery';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useAuth } from '@/components/AuthProvider';
import { useMenuItemProductLinks } from '@/hooks/useMenuItemProductLinks';
import { formatMenuItemPrice } from '@/utils/menuItemPriceFormatter';
import { FilterSidebar, FilterState } from './FilterSidebar';
import { MenuItem, MenuCategory } from '@/types/menu';
import { MenuItemDetailModal } from './MenuItemDetailModal';
import { MenuItemAllergenDisplay } from './MenuItemAllergenDisplay';

type ViewState = 'categories' | 'items' | 'filtered';

interface NavigationState {
  view: ViewState;
  selectedCategory?: MenuCategory;
  selectedSubcategory?: MenuCategory;
}

export const FilteredMenuDisplay = () => {
  const [navigation, setNavigation] = useState<NavigationState>({ view: 'categories' });
  const [isFilterSidebarCollapsed, setIsFilterSidebarCollapsed] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    selectedAllergens: [],
    showWithAllergens: false,
    selectedCategories: [],
    selectedSubcategories: []
  });
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const deviceLive = useDeviceLiveLayer();
  const { companyId } = useAuth();
  const { categories, isLoading: categoriesLoading } = useMenuCategories();
  const { menuItems, loading: itemsLoading } = useMenuItemsQuery();
  const { data: productLinksMap = {} } = useMenuItemProductLinks(companyId);

  const handleCategoryClick = (category: MenuCategory) => {
    setNavigation({ view: 'items', selectedCategory: category });
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

  const handleBackToCategory = () => {
    setNavigation({ view: 'items', selectedCategory: navigation.selectedCategory });
  };

  const handleSearch = () => {
    setNavigation({ view: 'filtered' });
    setIsFilterSidebarCollapsed(true);
  };

  const handleItemClick = (item: MenuItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
  };

  // Helper function to get all category IDs including subcategories
  const getAllCategoryIds = (selectedCategoryIds: string[], allCategories: MenuCategory[]): string[] => {
    const result = new Set<string>(selectedCategoryIds);
    
    selectedCategoryIds.forEach(catId => {
      const category = allCategories.find(c => c.id === catId);
      if (category?.subcategories) {
        category.subcategories.forEach(sub => result.add(sub.id));
      }
    });
    
    return Array.from(result);
  };

  const getFilteredItems = () => {
    if (navigation.view === 'filtered') {
      return (menuItems as MenuItem[]).filter(item => {
        // Category filter - include parent category and all its subcategories
        const allCategoryIdsToMatch = getAllCategoryIds(filters.selectedCategories, categories);
        const categoryMatch = filters.selectedCategories.length === 0 || 
          (item.category_id && allCategoryIdsToMatch.includes(item.category_id));

        // Subcategory filter
        const subcategoryMatch = filters.selectedSubcategories.length === 0 ||
          (item.category_id && filters.selectedSubcategories.includes(item.category_id));

        // Allergen filter - check item.allergens array
        const allergenMatch = filters.selectedAllergens.length === 0 ||
          (() => {
            const itemAllergens = item.allergens || [];
            const hasSelectedAllergen = filters.selectedAllergens.some(allergen =>
              itemAllergens.some(itemAllergen => itemAllergen.toLowerCase() === allergen.toLowerCase())
            );
            return filters.showWithAllergens ? hasSelectedAllergen : !hasSelectedAllergen;
          })();

        return categoryMatch && subcategoryMatch && allergenMatch;
      });
    }

    if (navigation.selectedSubcategory) {
      return (menuItems as MenuItem[]).filter(item => item.category_id === navigation.selectedSubcategory?.id);
    } else if (navigation.selectedCategory) {
      // Only get items directly from the selected category (not subcategories)
      return (menuItems as MenuItem[]).filter(item => item.category_id === navigation.selectedCategory?.id);
    }
    return [];
  };

  const renderBreadcrumb = () => {
    const parts = [];
    
    if (navigation.view === 'categories') {
      parts.push('Menu Categories');
    } else if (navigation.view === 'filtered') {
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
      parts.push('Filtered Results');
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
        if (navigation.selectedSubcategory) {
          parts.push(
            <Button 
              key="category"
              variant="ghost" 
              size="sm" 
              onClick={handleBackToCategory}
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
    
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        {parts.map((part, index) => (
          <div key={index} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {part}
          </div>
        ))}
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
          style={{ backgroundColor: category.card_color || undefined }}
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
    const hasSubcategories = navigation.selectedCategory?.subcategories && navigation.selectedCategory.subcategories.length > 0;
    
    // Show empty state only if no items AND no subcategories
    if (items.length === 0 && !hasSubcategories) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {navigation.view === 'filtered' ? 'No items match your filters.' : 'No menu items found.'}
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            {navigation.view === 'filtered' 
              ? 'Try adjusting your filter criteria.'
              : 'This category doesn\'t have any items yet.'
            }
          </p>
        </div>
      );
    }

    // Back button logic
    const backHandler = navigation.view === 'filtered' 
      ? handleBackToCategories
      : navigation.selectedSubcategory 
        ? handleBackToCategory 
        : handleBackToCategories;
    
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
        
        {/* Render subcategories as navigable cards */}
        {hasSubcategories && !navigation.selectedSubcategory && navigation.selectedCategory.subcategories.map((subcategory) => (
          <Card 
            key={`sub-${subcategory.id}`} 
            className="hover:shadow-md transition-shadow cursor-pointer min-h-[200px]"
            onClick={() => handleSubcategoryClick(subcategory)}
            style={{ backgroundColor: subcategory.card_color || undefined }}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
              <h3 className="font-semibold text-lg mb-2">{subcategory.name}</h3>
              {subcategory.description && (
                <p className="text-sm text-muted-foreground">
                  {subcategory.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        
        {/* Render menu items */}
        {items.map((item) => (
          <Card 
            key={item.id} 
            className="hover:shadow-md transition-shadow cursor-pointer min-h-[200px]"
            onClick={() => handleItemClick(item)}
            style={{
              backgroundColor: item.card_color || undefined
            }}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
              <h3 className="font-semibold text-2xl mb-2">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="text-lg font-bold text-primary mb-3">
                {formatMenuItemPrice(item, productLinksMap[item.id] || [])}
              </div>
              
              <MenuItemAllergenDisplay menuItemId={item.id} />
              
              {/* Tags */}
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

  // Don't show loading when device is live - data should be instant
  if (isLoading && !deviceLive) {
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
    <div className="relative">
      {/* Main Content */}
      <div className={`space-y-6 transition-all duration-300 ${!isFilterSidebarCollapsed ? 'mr-80' : ''}`}>
        {renderBreadcrumb()}
        
        {navigation.view === 'categories' && renderCategories()}
        {(navigation.view === 'items' || navigation.view === 'filtered') && renderItems()}
      </div>

      {/* Filter Sidebar */}
      <FilterSidebar
        isCollapsed={isFilterSidebarCollapsed}
        onToggle={() => setIsFilterSidebarCollapsed(!isFilterSidebarCollapsed)}
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={handleSearch}
      />

      {/* Overlay for mobile */}
      {!isFilterSidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsFilterSidebarCollapsed(true)}
        />
      )}

      {/* Menu Item Detail Modal */}
      <MenuItemDetailModal
        item={selectedItem}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        productLinks={selectedItem ? productLinksMap[selectedItem.id] || [] : []}
      />
    </div>
  );
};