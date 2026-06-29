import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Package, PoundSterling, Edit, Trash2, AlertTriangle, RefreshCw, Cloud, CloudOff, Loader2, XCircle, Link2, Search } from 'lucide-react';
import { useCurrencyFormatter } from '@/utils/currencyFormatter';
import { useMenuItemsSync } from '@/hooks/useMenuItemsSync';
import { useMenuItemProductLinks } from '@/hooks/useMenuItemProductLinks';
import { formatMenuItemPrice as formatPrice } from '@/utils/menuItemPriceFormatter';
import EditMenuItemModal from './EditMenuItemModal';
import DeleteMenuItemModal from './DeleteMenuItemModal';
import { MenuItemAllergenDisplay } from '@/components/menu/MenuItemAllergenDisplay';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  tags: string[] | null;
  allergens: string[] | null;
  pos_sync_status?: string;
  external_pos_id?: string;
  last_pos_sync?: string;
}

const MenuItemsManagement = () => {
  const { categories, isLoading: categoriesLoading } = useMenuCategories();
  const { companyId, loading: authLoading } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deviceLive = useDeviceLiveLayer();
  const { data: productLinksMap = {} } = useMenuItemProductLinks(companyId);
  
  // POS sync functionality - COMMENTED OUT FOR NOW
  // const {
  //   syncToPos,
  //   syncFromPos,
  //   syncStatus,
  //   getSyncStatusForItem,
  //   markItemForSync
  // } = useMenuItemsSync();


  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu_items', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('🍽️ No companyId available for menu items management');
        return [];
      }

      console.log('🍽️ Starting fetchMenuItems management with companyId:', companyId);

      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      console.log('🍽️ Menu items management query result:', { 
        dataLength: data?.length, 
        firstItem: data?.[0], 
        error: error 
      });

      if (error) throw error;
      return data;
    },
    enabled: !authLoading && !!companyId,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // COMMENTED OUT FOR NOW - POS sync handler
  // const handleSyncItemToPos = async (item: MenuItem, posSystem: string) => {
  //   try {
  //     await syncToPos({
  //       posSystem,
  //       direction: 'to_pos',
  //       overwriteConflicts: false,
  //       selectedItems: [item.id]
  //     });
  //     
  //     toast({
  //       title: 'Sync Started',
  //       description: `${item.name} is being synced to ${posSystem}`,
  //     });
  //   } catch (error) {
  //     toast({
  //       title: 'Sync Failed',
  //       description: `Failed to sync ${item.name} to ${posSystem}`,
  //       variant: 'destructive',
  //     });
  //   }
  // };

  // COMMENTED OUT FOR NOW - POS sync status badge
  // const getSyncStatusBadge = (item: MenuItem) => {
  //   const status = item.pos_sync_status || 'not_synced';
  //   
  //   switch (status) {
  //     case 'synced':
  //       return (
  //         <Badge variant="default" className="flex items-center gap-1">
  //           <Cloud className="w-3 h-3" />
  //           Synced
  //         </Badge>
  //       );
  //     case 'syncing':
  //       return (
  //         <Badge variant="secondary" className="flex items-center gap-1">
  //           <Loader2 className="w-3 h-3 animate-spin" />
  //           Syncing
  //         </Badge>
  //       );
  //     case 'conflict':
  //       return (
  //         <Badge variant="destructive" className="flex items-center gap-1">
  //           <AlertTriangle className="w-3 h-3" />
  //           Conflict
  //         </Badge>
  //       );
  //     case 'error':
  //       return (
  //         <Badge variant="destructive" className="flex items-center gap-1">
  //           <XCircle className="w-3 h-3" />
  //           Error
  //         </Badge>
  //       );
  //     default:
  //       return (
  //         <Badge variant="outline" className="flex items-center gap-1">
  //           <CloudOff className="w-3 h-3" />
  //           Not Synced
  //         </Badge>
  //       );
  //   }
  // };


  const updateMenuItemCategoryMutation = useMutation({
    mutationFn: async ({ itemId, categoryId }: { itemId: string; categoryId: string | null }) => {
      const { error } = await supabase
        .from('menu_items')
        .update({ category_id: categoryId })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
      toast({
        title: 'Success',
        description: 'Menu item category updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update menu item category',
        variant: 'destructive',
      });
      console.error('Error updating menu item category:', error);
    },
  });

  const getAllCategories = () => {
    const allCategories: Array<{ id: string; name: string; parent_name?: string }> = [];
    
    categories.forEach((category) => {
      allCategories.push({ id: category.id, name: category.name });
      
      if (category.subcategories) {
        category.subcategories.forEach((subcategory) => {
          allCategories.push({
            id: subcategory.id,
            name: subcategory.name,
            parent_name: category.name,
          });
        });
      }
    });
    
    return allCategories;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    
    const allCategories = getAllCategories();
    const category = allCategories.find(cat => cat.id === categoryId);
    
    if (!category) return 'Unknown Category';
    
    return category.parent_name 
      ? `${category.parent_name} → ${category.name}`
      : category.name;
  };

  // Use shared price formatter

  const filteredMenuItems = menuItems.filter((item) => {
    // Apply category filter
    const categoryMatch = 
      selectedCategoryFilter === 'all' ? true :
      selectedCategoryFilter === 'uncategorized' ? !item.category_id :
      item.category_id === selectedCategoryFilter;
    
    // Apply search filter
    const searchMatch = searchQuery.trim() === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return categoryMatch && searchMatch;
  });

  // Hide loading when device live layer is active and we have data
  const shouldShowLoading = (categoriesLoading || itemsLoading || authLoading) && !(deviceLive && menuItems.length >= 0);
  
  if (shouldShowLoading) {
    return <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>;
  }

  const allCategories = getAllCategories();

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            {categories.map((category) => [
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>,
              ...(category.subcategories?.map((subcategory) => (
                <SelectItem key={subcategory.id} value={subcategory.id}>
                  {category.name} → {subcategory.name}
                </SelectItem>
              )) || [])
            ]).flat()}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredMenuItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{item.name}</h4>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <PoundSterling className="h-4 w-4" />
                      {formatPrice(item, productLinksMap[item.id] || [], formatCurrency)}
                    </div>
                    {/* Product Links Indicator */}
                    {productLinksMap[item.id] && productLinksMap[item.id].length > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        Complex Product
                      </Badge>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex gap-1">
                        {item.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                  )}
                  
                  {/* Display allergen information */}
                  <MenuItemAllergenDisplay 
                    menuItemId={item.id} 
                    variant="full"
                    className="mb-3"
                  />

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Category:</span>
                      <Badge variant={item.category_id ? "secondary" : "outline"}>
                        {getCategoryName(item.category_id)}
                      </Badge>
                    </div>
                    
                    {/* POS Sync - COMMENTED OUT FOR NOW */}
                    {/* <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">POS Sync:</span>
                      {getSyncStatusBadge(item)}
                    </div> */}
                  </div>
                </div>
                
                <div className="ml-6 flex items-center gap-2">
                  <Select
                    value={item.category_id || 'uncategorized'}
                    onValueChange={(value) => {
                      const categoryId = value === 'uncategorized' ? null : value;
                      updateMenuItemCategoryMutation.mutate({
                        itemId: item.id,
                        categoryId,
                      });
                    }}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
                      {categories.map((category) => [
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>,
                        ...(category.subcategories?.map((subcategory) => (
                          <SelectItem key={subcategory.id} value={subcategory.id}>
                            {category.name} → {subcategory.name}
                          </SelectItem>
                        )) || [])
                      ]).flat()}
                    </SelectContent>
                  </Select>
                  
                  {/* POS Sync Button - COMMENTED OUT FOR NOW */}
                  {/* <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncItemToPos(item, 'square')}
                    disabled={syncStatus === 'syncing'}
                    title="Sync to Square POS"
                  >
                    {syncStatus === 'syncing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button> */}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingItem(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingItem(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredMenuItems.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Menu Items Found</h3>
              <p className="text-muted-foreground">
                {selectedCategoryFilter === 'all' 
                  ? 'No menu items are available.'
                  : 'No menu items match the selected category filter.'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <EditMenuItemModal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        menuItem={editingItem}
      />

      <DeleteMenuItemModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        menuItem={deletingItem}
      />
    </div>
  );
};

export default MenuItemsManagement;