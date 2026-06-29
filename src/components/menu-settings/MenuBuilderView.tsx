import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, ArrowLeft, ArrowRight, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useCurrencyFormatter } from '@/utils/currencyFormatter';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useAuth } from '@/components/AuthProvider';
import { useMenuItemProductLinks } from '@/hooks/useMenuItemProductLinks';
import { useMenuItems } from '@/hooks/useMenuItems';
import { formatMenuItemPrice } from '@/utils/menuItemPriceFormatter';
import { MenuItemAllergenDisplay } from '@/components/menu/MenuItemAllergenDisplay';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category_id: string | null;
  display_order: number | null;
  card_color: string | null;
  allergens: string[] | null;
  tags: string[] | null;
  slot_position?: number;
}

interface GridSlot {
  id: string;
  type: 'back' | 'subcategory' | 'item';
  content?: MenuItem | any;
  slotIndex: number;
}

interface ReorderingItem {
  id: string;
  type: 'subcategory' | 'item';
  currentOrder: number;
}

type ViewState = 'categories' | 'subcategories' | 'items';

interface NavigationState {
  view: ViewState;
  selectedCategory?: {
    id: string;
    name: string;
    subcategories?: any[];
  };
  selectedSubcategory?: {
    id: string;
    name: string;
  };
}

const MenuBuilderView = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrencyFormatter();
  const { companyId } = useAuth();
  const deviceLive = useDeviceLiveLayer();
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [categoryColorPickerOpen, setCategoryColorPickerOpen] = useState<string | null>(null);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, number>>({});
  const [navigation, setNavigation] = useState<NavigationState>({ view: 'categories' });
  const { categories, updateCategory, reorderCategories } = useMenuCategories();
  const { data: productLinksMap = {} } = useMenuItemProductLinks(companyId);
  const { reorderMenuItems } = useMenuItems();

  const { data: menuItems, isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ['menu_items', companyId],
    queryFn: async () => {
      if (deviceLive) {
        console.log('🚀 MenuBuilderView: Device live - using cached data');
        const cached = queryClient.getQueryData<MenuItem[]>(['menu_items', companyId]);
        if (cached) return cached;
      }
      
      console.log('Fetching menu items for builder...');
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching menu items:', error);
        throw error;
      }
      console.log('Fetched menu items:', data);
      return data as MenuItem[];
    },
    enabled: !deviceLive || !queryClient.getQueryData(['menu_items', companyId]),
    initialData: deviceLive ? () => queryClient.getQueryData<MenuItem[]>(['menu_items', companyId]) : undefined
  });

  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MenuItem> }) => {
      const { error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update menu item",
        variant: "destructive",
      });
    }
  });

  // Update navigation subcategories when categories data changes
  React.useEffect(() => {
    if (navigation.selectedCategory && categories) {
      const updatedCategory = categories.find(cat => cat.id === navigation.selectedCategory?.id);
      if (updatedCategory && updatedCategory.subcategories) {
        setNavigation(prev => ({
          ...prev,
          selectedCategory: {
            ...prev.selectedCategory!,
            subcategories: updatedCategory.subcategories
          }
        }));
      }
    }
  }, [categories, navigation.selectedCategory?.id]);

  // Navigation handlers
  const handleCategoryClick = (category: any) => {
    // Always show items view to display subcategories and items together
    setNavigation({ view: 'items', selectedCategory: category });
  };

  const handleSubcategoryClick = (subcategory: any) => {
    setNavigation({ 
      view: 'items', 
      selectedCategory: navigation.selectedCategory,
      selectedSubcategory: subcategory 
    });
  };

  const handleBackToCategories = () => {
    setNavigation({ view: 'categories' });
    setColorPickerOpen(null);
  };

  const handleBackToSubcategories = () => {
    // Return to the category view (items view without selectedSubcategory)
    setNavigation({ view: 'items', selectedCategory: navigation.selectedCategory });
    setColorPickerOpen(null);
  };

  // Get items for selected category
  const selectedCategoryItems = useMemo(() => {
    if (!menuItems) return [];
    
    if (navigation.selectedSubcategory) {
      // If a subcategory is selected, show only items from that subcategory
      return menuItems
        .filter(item => item.category_id === navigation.selectedSubcategory?.id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  } else if (navigation.selectedCategory) {
    // If a main category is selected (without subcategory), show ONLY items
    // directly assigned to that category (not from subcategories)
    return menuItems
      .filter(item => item.category_id === navigation.selectedCategory.id)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }
    return [];
  }, [menuItems, navigation.selectedCategory, navigation.selectedSubcategory]);

  // Compute a stable ordering even when display_order is null, zero, or duplicated,
  // with local overrides for immediate UI updates
  const orderedItems = useMemo(() => {
    const itemsWithOrder = selectedCategoryItems.map((it, idx) => {
      const override = orderOverrides[it.id];
      if (override !== undefined) {
        return { item: it, order: override, idx };
      }
      const ord = it.display_order;
      const effective = typeof ord === 'number' && ord > 0 ? ord : ((idx + 1) * 10);
      return { item: it, order: effective, idx };
    });
    // Sort by effective order, then by original index for stable ordering
    return itemsWithOrder.sort((a, b) => (a.order - b.order) || (a.idx - b.idx));
  }, [selectedCategoryItems, orderOverrides]);

  // Clear order overrides when navigating to different category/subcategory
  useEffect(() => {
    setOrderOverrides({});
  }, [navigation.selectedCategory?.id, navigation.selectedSubcategory?.id]);

  // Create grid slots for 6-column layout
  const gridSlots = useMemo(() => {
    const SLOTS_PER_ROW = 6;
    const slots: GridSlot[] = [];
    
    // Always include back button in slot 0
    slots.push({
      id: 'back-button',
      type: 'back',
      slotIndex: 0
    });

    // Add subcategories (if we're in category view and not subcategory view)
    const subcategories = !navigation.selectedSubcategory && 
      navigation.selectedCategory?.subcategories || [];
    
    subcategories.forEach((subcategory, index) => {
      slots.push({
        id: `subcategory-${subcategory.id}`,
        type: 'subcategory',
        content: subcategory,
        slotIndex: slots.length
      });
    });

    // Add menu items using orderedItems for correct display order
    orderedItems.forEach(({ item }, index) => {
      slots.push({
        id: `item-${item.id}`,
        type: 'item',
        content: item,
        slotIndex: slots.length
      });
    });

    // Fill remaining slots to complete rows
    const totalRows = Math.ceil(slots.length / SLOTS_PER_ROW);
    const totalSlots = totalRows * SLOTS_PER_ROW;
    
    for (let i = slots.length; i < totalSlots; i++) {
      slots.push({
        id: `empty-${i}`,
        type: 'item', // Empty slots can accept items
        slotIndex: i
      });
    }

    return slots;
  }, [orderedItems, navigation.selectedCategory?.id, navigation.selectedSubcategory?.id]);

  // Move item functions
  const moveItem = (itemId: string, direction: 'left' | 'right') => {
    const idx = orderedItems.findIndex(o => o.item.id === itemId);
    if (idx === -1) return;

    const neighborIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= orderedItems.length) return;

    // Normalize orders to distinct values based on current UI sequence
    const normalizedOrders = orderedItems.map((_o, i) => (i + 1) * 10);
    const current = orderedItems[idx];
    const neighbor = orderedItems[neighborIdx];
    const currentNorm = normalizedOrders[idx];
    const neighborNorm = normalizedOrders[neighborIdx];

    console.log('Moving item:', {
      currentId: current.item.id,
      currentName: current.item.name,
      newOrder: neighborNorm,
      neighborId: neighbor.item.id,
      neighborName: neighbor.item.name,
      neighborNewOrder: currentNorm
    });

    // Optimistically update UI immediately with normalized (distinct) values
    setOrderOverrides(prev => ({
      ...prev,
      [current.item.id]: neighborNorm,
      [neighbor.item.id]: currentNorm,
    }));

    // Persist to database
    reorderMenuItems([
      { id: current.item.id, display_order: neighborNorm },
      { id: neighbor.item.id, display_order: currentNorm },
    ]);
  };

  const canMoveItem = (itemId: string, direction: 'left' | 'right') => {
    const idx = orderedItems.findIndex(o => o.item.id === itemId);
    if (idx === -1) return false;
    return direction === 'left' ? idx > 0 : idx < orderedItems.length - 1;
  };

  // Move subcategory functions
  const moveSubcategory = (subcategoryId: string, direction: 'left' | 'right') => {
    if (!navigation.selectedCategory?.subcategories) return;
    
    const subcategories = navigation.selectedCategory.subcategories;
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    if (!subcategory) return;

    const currentOrder = subcategory.display_order || 0;
    const otherSubcategories = subcategories.filter(sub => sub.id !== subcategoryId);
    
    let targetSubcategory;
    if (direction === 'left') {
      targetSubcategory = otherSubcategories
        .filter(sub => (sub.display_order || 0) < currentOrder)
        .sort((a, b) => (b.display_order || 0) - (a.display_order || 0))[0];
    } else {
      targetSubcategory = otherSubcategories
        .filter(sub => (sub.display_order || 0) > currentOrder)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[0];
    }

    if (!targetSubcategory) return;

    // Swap the display orders
    const updates = [
      { id: subcategoryId, display_order: targetSubcategory.display_order || 0 },
      { id: targetSubcategory.id, display_order: currentOrder }
    ];
    
    reorderCategories(updates);
  };

  const canMoveSubcategory = (subcategoryId: string, direction: 'left' | 'right') => {
    if (!navigation.selectedCategory?.subcategories) return false;
    
    const subcategories = navigation.selectedCategory.subcategories;
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    if (!subcategory) return false;

    const currentOrder = subcategory.display_order || 0;
    const otherSubcategories = subcategories.filter(sub => sub.id !== subcategoryId);
    
    if (direction === 'left') {
      return otherSubcategories.some(sub => (sub.display_order || 0) < currentOrder);
    } else {
      return otherSubcategories.some(sub => (sub.display_order || 0) > currentOrder);
    }
  };

  // Move category functions
  const moveCategory = (categoryId: string, direction: 'left' | 'right') => {
    if (!categories) return;
    
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const currentOrder = category.display_order || 0;
    const otherCategories = categories.filter(cat => cat.id !== categoryId);
    
    let targetCategory;
    if (direction === 'left') {
      targetCategory = otherCategories
        .filter(cat => (cat.display_order || 0) < currentOrder)
        .sort((a, b) => (b.display_order || 0) - (a.display_order || 0))[0];
    } else {
      targetCategory = otherCategories
        .filter(cat => (cat.display_order || 0) > currentOrder)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[0];
    }

    if (!targetCategory) return;

    // Swap the display orders
    const updates = [
      { id: categoryId, display_order: targetCategory.display_order || 0 },
      { id: targetCategory.id, display_order: currentOrder }
    ];
    
    reorderCategories(updates);
  };

  const canMoveCategory = (categoryId: string, direction: 'left' | 'right') => {
    if (!categories) return false;
    
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return false;

    const currentOrder = category.display_order || 0;
    const otherCategories = categories.filter(cat => cat.id !== categoryId);
    
    if (direction === 'left') {
      return otherCategories.some(cat => (cat.display_order || 0) < currentOrder);
    } else {
      return otherCategories.some(cat => (cat.display_order || 0) > currentOrder);
    }
  };

  const handleColorChange = (itemId: string, color: string) => {
    updateMenuItemMutation.mutate({
      id: itemId,
      updates: { card_color: color }
    });
    setColorPickerOpen(null);
  };

  const handleCategoryColorChange = (categoryId: string, color: string) => {
    updateCategory({
      id: categoryId,
      card_color: color
    });
    setCategoryColorPickerOpen(null);
  };

  const predefinedColors = [
    '#ffffff', '#f3f4f6', '#fef3c7', '#fde68a',
    '#fed7d7', '#fbb6ce', '#e9d5ff', '#c7d2fe',
    '#bfdbfe', '#a7f3d0', '#86efac', '#fcd34d'
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error loading menu items: {error.message}</p>
        <Button 
          variant="outline" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] })}
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Render breadcrumb navigation
  const renderBreadcrumb = () => {
    const parts = [];
    
    if (navigation.view === 'categories') {
      parts.push('Menu Builder');
    } else {
      parts.push(
        <Button 
          key="categories"
          variant="ghost" 
          size="sm" 
          onClick={handleBackToCategories}
          className="p-0 h-auto text-primary hover:text-primary/80"
        >
          Menu Builder
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
        {parts.map((part, index) => (
          <div key={index} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {part}
          </div>
        ))}
      </div>
    );
  };

  // Render categories view
  const renderCategories = () => {
    if (!categories || categories.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No categories found. Create some categories first.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {categories.map((category) => (
          <Card 
            key={category.id} 
            className="group relative hover:shadow-md transition-shadow cursor-pointer min-h-[120px]"
            onClick={() => handleCategoryClick(category)}
            style={{ backgroundColor: category.card_color || undefined }}
          >
            {/* Color Picker Button */}
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setCategoryColorPickerOpen(categoryColorPickerOpen === category.id ? null : category.id);
                }}
                className="p-1 h-7 w-7 hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Change color"
              >
                <Palette className="h-4 w-4" />
              </Button>
              
              {categoryColorPickerOpen === category.id && (
                <div className="absolute right-0 top-full mt-1 p-2 bg-background border rounded-lg shadow-lg z-20">
                  <div className="grid grid-cols-4 gap-1 w-24">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        className="w-4 h-4 rounded border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryColorChange(category.id, color);
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[120px]">
              <h3 className="font-semibold text-lg mb-2">{category.name}</h3>
              {category.description && (
                <p className="text-sm text-muted-foreground">{category.description}</p>
              )}
            </CardContent>
            
            {/* Reorder arrows */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!canMoveCategory(category.id, 'left')}
                onClick={(e) => {
                  e.stopPropagation();
                  moveCategory(category.id, 'left');
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!canMoveCategory(category.id, 'right')}
                onClick={(e) => {
                  e.stopPropagation();
                  moveCategory(category.id, 'right');
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // Render subcategories view
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
            <ArrowLeft className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="font-semibold text-lg text-muted-foreground">Back</h3>
          </CardContent>
        </Card>
        
        {navigation.selectedCategory.subcategories.map((subcategory) => (
          <Card 
            key={subcategory.id} 
            className="group relative hover:shadow-md transition-shadow cursor-pointer min-h-[120px]"
            onClick={() => handleSubcategoryClick(subcategory)}
            style={{ backgroundColor: subcategory.card_color || undefined }}
          >
            {/* Color Picker Button */}
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setCategoryColorPickerOpen(categoryColorPickerOpen === subcategory.id ? null : subcategory.id);
                }}
                className="p-1 h-7 w-7 hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Change color"
              >
                <Palette className="h-4 w-4" />
              </Button>
              
              {categoryColorPickerOpen === subcategory.id && (
                <div className="absolute right-0 top-full mt-1 p-2 bg-background border rounded-lg shadow-lg z-20">
                  <div className="grid grid-cols-4 gap-1 w-24">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        className="w-4 h-4 rounded border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryColorChange(subcategory.id, color);
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

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

  // Render items view with 6-slot grid system
  const renderItems = () => {
    const SLOTS_PER_ROW = 6;
    
    if (gridSlots.length <= 1) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No items or subcategories found.</p>
          <p className="text-muted-foreground text-sm mt-2">
            This category doesn't have any content yet.
          </p>
        </div>
      );
    }

    const backHandler = navigation.selectedSubcategory ? handleBackToSubcategories : handleBackToCategories;

    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground mb-6">
          Use the arrow buttons to reorder items within the 6-column grid. Items cannot move in front of subcategories.
        </div>

        <div className="grid grid-cols-6 gap-4 auto-rows-fr">
          {gridSlots.map((slot) => {
            if (slot.type === 'back') {
              return (
                <div key={slot.id} className="min-h-[200px]">
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow border-dashed border-2 border-muted-foreground/30 h-full"
                    onClick={backHandler}
                  >
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                      <ArrowLeft className="h-6 w-6 text-muted-foreground mb-1" />
                      <h3 className="font-semibold text-sm text-muted-foreground">Back</h3>
                    </CardContent>
                  </Card>
                </div>
              );
            }

            if (slot.type === 'subcategory' && slot.content) {
              return (
                <div key={slot.id} className="min-h-[200px] relative">
                  <Card
                    className="hover:shadow-md transition-all cursor-pointer h-full relative group"
                    onClick={() => handleSubcategoryClick(slot.content)}
                    style={{ backgroundColor: slot.content.card_color || undefined }}
                  >
                    {/* Arrow Controls */}
                    <div className="absolute top-1 left-1 flex gap-1 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSubcategory(slot.content.id, 'left');
                        }}
                        disabled={!canMoveSubcategory(slot.content.id, 'left')}
                        className="p-1 h-6 w-6 hover:bg-background/80"
                        title="Move left"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSubcategory(slot.content.id, 'right');
                        }}
                        disabled={!canMoveSubcategory(slot.content.id, 'right')}
                        className="p-1 h-6 w-6 hover:bg-background/80"
                        title="Move right"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Color Picker Button */}
                    <div className="absolute top-1 right-1 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategoryColorPickerOpen(categoryColorPickerOpen === slot.content.id ? null : slot.content.id);
                        }}
                        className="p-1 h-6 w-6 hover:bg-background/80"
                        title="Change color"
                      >
                        <Palette className="h-3 w-3" />
                      </Button>
                      
                      {categoryColorPickerOpen === slot.content.id && (
                        <div className="absolute right-0 top-full mt-1 p-2 bg-background border rounded-lg shadow-lg z-20">
                          <div className="grid grid-cols-4 gap-1 w-24">
                            {predefinedColors.map((color) => (
                              <button
                                key={color}
                                className="w-4 h-4 rounded border border-border hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCategoryColorChange(slot.content.id, color);
                                }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full pt-8">
                      <FolderOpen className="h-6 w-6 text-blue-600 mb-1" />
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{slot.content.name}</h3>
                      {slot.content.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {slot.content.description}
                        </p>
                      )}
                      <Badge variant="secondary" className="text-xs mt-1">
                        Subcategory
                      </Badge>
                    </CardContent>
                  </Card>
                </div>
              );
            }

            if (slot.type === 'item' && slot.content) {
              const item = slot.content;
              return (
                <div key={slot.id} className="min-h-[200px] relative">
                  <Card
                    className="hover:shadow-md transition-all h-full relative"
                    style={{ backgroundColor: item.card_color || undefined }}
                  >
                    {/* Arrow Controls */}
                    <div className="absolute top-1 left-1 flex gap-1 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(item.id, 'left');
                        }}
                        disabled={!canMoveItem(item.id, 'left')}
                        className="p-1 h-6 w-6 hover:bg-background/80"
                        title="Move left"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(item.id, 'right');
                        }}
                        disabled={!canMoveItem(item.id, 'right')}
                        className="p-1 h-6 w-6 hover:bg-background/80"
                        title="Move right"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Color Picker Button */}
                    <div className="absolute top-1 right-1 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setColorPickerOpen(colorPickerOpen === item.id ? null : item.id);
                        }}
                        className="p-1 h-6 w-6 hover:bg-background/80"
                        title="Change color"
                      >
                        <Palette className="h-3 w-3" />
                      </Button>
                      
                      {colorPickerOpen === item.id && (
                        <div className="absolute right-0 top-full mt-1 p-2 bg-background border rounded-lg shadow-lg z-20">
                          <div className="grid grid-cols-4 gap-1 w-24">
                            {predefinedColors.map((color) => (
                              <button
                                key={color}
                                className="w-4 h-4 rounded border border-border hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                                onClick={() => handleColorChange(item.id, color)}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full pt-8 overflow-hidden">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2 min-h-[2rem]">{item.name}</h3>
                      
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2 min-h-[1.5rem]">
                        {item.description || "No description"}
                      </p>
                      
                      <div className="text-sm font-bold text-primary mb-1">
                        {formatMenuItemPrice(item, productLinksMap[item.id] || [], formatCurrency)}
                      </div>
                      
                      <MenuItemAllergenDisplay 
                        menuItemId={item.id} 
                        variant="compact" 
                        className="mb-1"
                      />
                      
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-auto">
                          {item.tags.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              +{item.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            }

            // Empty slot
            return (
              <div key={slot.id} className="min-h-[200px]">
                <Card className="h-full border-dashed border-2 border-muted-foreground/20 bg-muted/5">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                    <div className="text-muted-foreground/50 text-xs">Empty Slot</div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No menu items found. Add some menu items first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderBreadcrumb()}
      
      {navigation.view === 'categories' && renderCategories()}
      {navigation.view === 'subcategories' && renderSubcategories()}
      {navigation.view === 'items' && renderItems()}

      {/* Click outside to close color picker */}
      {(colorPickerOpen || categoryColorPickerOpen) && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => {
            setColorPickerOpen(null);
            setCategoryColorPickerOpen(null);
          }}
        />
      )}
    </div>
  );
};

export default MenuBuilderView;