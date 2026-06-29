import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft } from 'lucide-react';
import { useMenuItemsQuery } from '@/hooks/useMenuItemsQuery';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useMenuItemProductLinks } from '@/hooks/useMenuItemProductLinks';
import { useOrderBasket } from '@/contexts/OrderBasketContext';
import { formatMenuItemPrice } from '@/utils/menuItemPriceFormatter';
import { MenuItem, MenuCategory } from '@/types/menu';
import { MenuItemDetailModal } from '@/components/menu/MenuItemDetailModal';
import { SelectedOptions } from '@/utils/productLinkCalculator';
import { MenuItemAllergenDisplay } from '@/components/menu/MenuItemAllergenDisplay';
import { supabase } from '@/integrations/supabase/client';
import { usePOSFontSizing } from '@/hooks/usePOSFontSizing';

type ViewState = 'categories' | 'items';

interface NavigationState {
  view: ViewState;
  selectedCategory?: MenuCategory;
  selectedSubcategory?: MenuCategory;
}

export const POSMenuDisplay = () => {
  const [navigation, setNavigation] = useState<NavigationState>({ view: 'categories' });
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { isActive: deviceLive } = useDeviceLiveLayer();
  const { companyId } = useCompanyId();
  const { addToBasket } = useOrderBasket();
  const { categories, isLoading: categoriesLoading } = useMenuCategories();
  const { menuItems, loading: itemsLoading } = useMenuItemsQuery();
  const { data: productLinksMap = {}, isLoading: productLinksLoading } = useMenuItemProductLinks(companyId);
  const { fontStyles, cardStyles } = usePOSFontSizing();

  // Log when product links map updates
  useEffect(() => {
    console.log('🔄 [POS-MENU] Product links map updated:', {
      isLoading: productLinksLoading,
      mapKeys: Object.keys(productLinksMap),
      totalItems: Object.keys(productLinksMap).length,
      mapContents: Object.entries(productLinksMap).map(([id, links]) => ({
        menuItemId: id,
        linkCount: links.length
      }))
    });
  }, [productLinksMap, productLinksLoading]);

  // Log when menu items load
  useEffect(() => {
    const items = menuItems as MenuItem[] | undefined;
    console.log('📜 [POS-MENU] Menu items loaded:', {
      isLoading: itemsLoading,
      itemCount: items?.length || 0,
      sampleItems: items?.slice(0, 3).map(i => ({ id: i.id, name: i.name }))
    });
  }, [menuItems, itemsLoading]);

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

  const handleItemClick = async (item: MenuItem) => {
    console.log('🖱️ [POS-MENU] Item clicked:', {
      itemName: item.name,
      itemId: item.id,
      itemPrice: item.price
    });
    
    // Don't allow clicks if product links are still loading
    if (productLinksLoading) {
      console.log('⏳ [POS-MENU] BLOCKED - Product links still loading');
      return;
    }
    
    const productLinks = productLinksMap[item.id] || [];
    
    // Fetch ingredients to determine if modal should open
    const { data: ingredients, error: ingErr } = await supabase
      .from('menu_item_ingredients')
      .select('id')
      .eq('menu_item_id', item.id)
      .eq('company_id', companyId);
    
    if (ingErr) {
      console.warn('⚠️ [POS-MENU] Ingredient check failed, opening modal by default:', ingErr);
      setSelectedItem(item);
      setIsDetailModalOpen(true);
      return;
    }
    
    const hasIngredients = (ingredients?.length || 0) > 0;
    const hasProductLinks = productLinks.length > 0;
    
    console.log('🔍 [POS-MENU] Item configuration:', {
      hasProductLinks,
      hasIngredients,
      productLinkCount: productLinks.length,
      ingredientCount: ingredients?.length || 0
    });
    
    // If no product links AND no ingredients, add directly to basket
    if (!hasProductLinks && !hasIngredients) {
      console.log('➕ [POS-MENU] No options or ingredients - adding directly to basket');
      addToBasket(item, item.price || 0);
      return;
    }
    
    // Otherwise, open modal for customization
    console.log('📱 [POS-MENU] Opening modal for customization');
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
  };

  const handleAddToBasket = (selectedOptions: SelectedOptions, price: number, breakdown: any[], ingredientMods?: any[], notes?: string) => {
    if (!selectedItem) return;

    const productLinks = productLinksMap[selectedItem.id] || [];
    
    if (productLinks.length > 0 || (ingredientMods && ingredientMods.length > 0)) {
      addToBasket(selectedItem, price, {
        selectedOptions,
        breakdown,
        ingredientModifications: ingredientMods
      }, undefined, notes);
    } else {
      // Simple item with no product links or ingredients
      addToBasket(selectedItem, selectedItem.price || 0, undefined, undefined, notes);
    }
    
    handleCloseDetailModal();
  };

  const getFilteredItems = () => {
    let items: MenuItem[] = [];
    
    if (navigation.selectedSubcategory) {
      items = (menuItems as MenuItem[]).filter(item => item.category_id === navigation.selectedSubcategory?.id);
    } else if (navigation.selectedCategory) {
      items = (menuItems as MenuItem[]).filter(item => item.category_id === navigation.selectedCategory?.id);
    }
    
    // Sort by display_order to match Menu Builder order
    return items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  };

  const renderCategories = () => (
    <div className="grid grid-cols-6 gap-4">
      {[...categories]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((category) => (
        <Card 
          key={category.id} 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => handleCategoryClick(category)}
          style={{ 
            backgroundColor: category.card_color || undefined,
            ...cardStyles
          }}
        >
          <CardContent className="p-2 flex flex-col items-center justify-center text-center h-full" style={cardStyles}>
            <h3 
              className="font-semibold leading-tight mb-1 w-full whitespace-normal"
              style={{
                ...fontStyles.cardTitle,
                hyphens: 'auto',
                overflowWrap: 'break-word',
                wordBreak: 'normal',
              }}
            >
              {category.name}
            </h3>
            {category.description && (
              <p 
                className="text-muted-foreground leading-tight w-full whitespace-normal"
                style={{
                  ...fontStyles.description,
                  hyphens: 'auto',
                  overflowWrap: 'break-word',
                  wordBreak: 'normal',
                }}
              >
                {category.description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderItems = () => {
    const items = getFilteredItems();
    const hasSubcategories = navigation.selectedCategory?.subcategories && navigation.selectedCategory.subcategories.length > 0;
    
    const backHandler = navigation.selectedSubcategory 
      ? handleBackToCategory 
      : handleBackToCategories;
    
    return (
      <div className="grid grid-cols-6 gap-4">
        {/* Back Navigation Card - ALWAYS SHOWN */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-dashed border-2 border-muted-foreground/30"
          onClick={backHandler}
          style={cardStyles}
        >
          <CardContent className="p-2 flex flex-col items-center justify-center text-center h-full" style={cardStyles}>
            <ChevronLeft className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="font-semibold text-lg text-muted-foreground">Back</h3>
          </CardContent>
        </Card>
        
        {/* Render subcategories */}
        {hasSubcategories && !navigation.selectedSubcategory && [...navigation.selectedCategory.subcategories]
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((subcategory) => (
          <Card 
            key={`sub-${subcategory.id}`} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleSubcategoryClick(subcategory)}
            style={{ 
              backgroundColor: subcategory.card_color || undefined,
              ...cardStyles
            }}
          >
            <CardContent className="p-2 flex flex-col items-center justify-center text-center h-full" style={cardStyles}>
              <h3 
                className="font-semibold leading-tight mb-1 w-full whitespace-normal"
                style={{
                  ...fontStyles.cardTitle,
                  hyphens: 'auto',
                  overflowWrap: 'break-word',
                  wordBreak: 'normal',
                }}
              >
                {subcategory.name}
              </h3>
              {subcategory.description && (
                <p 
                  className="text-muted-foreground leading-tight w-full whitespace-normal"
                  style={{
                    ...fontStyles.description,
                    hyphens: 'auto',
                    overflowWrap: 'break-word',
                    wordBreak: 'normal',
                  }}
                >
                  {subcategory.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        
        {/* Render menu items */}
        {items.map((item) => {
          const productLinks = productLinksMap[item.id] || [];
          const hasOptions = productLinks.length > 0;
          
          return (
            <Card 
              key={item.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                productLinksLoading ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={() => handleItemClick(item)}
              style={{ 
                backgroundColor: item.card_color || undefined,
                ...cardStyles
              }}
            >
              <CardContent className="p-2 flex flex-col items-center justify-center text-center h-full" style={cardStyles}>
                <h3 
                  className="font-semibold leading-tight mb-2 w-full whitespace-normal"
                  style={{
                    ...fontStyles.cardTitle,
                    hyphens: 'auto',
                    overflowWrap: 'break-word',
                    wordBreak: 'normal',
                  }}
                >
                  {item.name}
                </h3>
                <div 
                  className="font-bold text-primary mb-2 leading-tight w-full whitespace-normal"
                  style={{
                    ...fontStyles.price,
                    overflowWrap: 'break-word',
                    wordBreak: 'normal',
                  }}
                >
                  {formatMenuItemPrice(item, productLinks, undefined, false)}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center max-w-full">
                    {item.tags.slice(0, 3).map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="truncate max-w-[80px]"
                        style={fontStyles.badge}
                      >
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 3 && (
                      <Badge 
                        variant="outline" 
                        className="whitespace-nowrap"
                        style={fontStyles.badge}
                      >
                        +{item.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const isLoading = categoriesLoading || itemsLoading || productLinksLoading;

  if (isLoading && !deviceLive) {
    return (
      <div className="space-y-4">
        {/* Loading message */}
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">
            {productLinksLoading ? 'Loading pricing data...' : 'Loading menu...'}
          </p>
        </div>
        
        {/* Skeleton cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <Card key={i} className="animate-pulse min-h-[120px]">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {navigation.view === 'categories' && renderCategories()}
        {navigation.view === 'items' && renderItems()}
      </div>

      {/* Menu Item Detail Modal with Add to Basket */}
      <MenuItemDetailModal
        item={selectedItem}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        productLinks={selectedItem ? productLinksMap[selectedItem.id] || [] : []}
        onAddToBasket={handleAddToBasket}
        showAddToBasket={true}
        hidePriceExplorer={true}
        hideIngredients={false}
      />
    </>
  );
};
