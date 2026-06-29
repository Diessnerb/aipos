import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useQueryClient } from '@tanstack/react-query';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { Settings2, Utensils } from 'lucide-react';
import { ProductLinkBuilder } from '@/components/product-links/ProductLinkBuilder';
import { IngredientsModal } from '@/components/menu-settings/IngredientsModal';

interface MenuItem {
  name: string;
  description: string;
  price: number;
  category_id: string | null;
  tags: string[];
  allergens: string[];
  image_urls: string[];
}

interface AddMenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddMenuItemModal = ({ isOpen, onClose }: AddMenuItemModalProps) => {
  const { toast } = useToast();
  const { categories, isLoading: categoriesLoading } = useMenuCategories();
  const { companyId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<MenuItem>({
    name: '',
    description: '',
    price: 0,
    category_id: null,
    tags: [],
    allergens: [],
    image_urls: [],
  });
  const [showProductLinkBuilder, setShowProductLinkBuilder] = useState(false);
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const [tempMenuItemId, setTempMenuItemId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const canCreate = !authLoading && !!companyId && formData.name.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreate) return;
    
    setIsLoading(true);

    try {
      // If item was already saved (via Configure buttons), just close
      if (tempMenuItemId) {
        toast({ title: "Menu item saved successfully" });
        queryClient.invalidateQueries({ queryKey: ['menu-items-management', companyId] });
        queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
        queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
        
        // Reset state and close
        setTempMenuItemId(null);
        setFormData({
          name: '',
          description: '',
          price: 0,
          category_id: null,
          tags: [],
          allergens: [],
          image_urls: [],
        });
        setTagInput('');
        onClose();
        return;
      }
      
      // Otherwise, save the item for the first time
      // Calculate next display_order to append to end of category
      let nextDisplayOrder = 10; // Default for first item
      if (formData.category_id) {
        const { data: maxOrderItem } = await supabase
          .from('menu_items')
          .select('display_order')
          .eq('category_id', formData.category_id)
          .order('display_order', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        
        if (maxOrderItem?.display_order != null) {
          nextDisplayOrder = maxOrderItem.display_order + 10;
        }
      }

      const { data: insertedItem, error } = await supabase
        .from('menu_items')
        .insert([{
          ...formData,
          company_id: null,
          display_order: nextDisplayOrder,
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      toast({ title: "Menu item added successfully" });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
      
      setFormData({
        name: '',
        description: '',
        price: 0,
        category_id: null,
        tags: [],
        allergens: [],
        image_urls: [],
      });
      setTagInput('');
      onClose();
    } catch (error) {
      console.error('Error creating menu item:', error);
      toast({ 
        title: "Error adding menu item", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndConfigure = async (): Promise<void> => {
    if (!canCreate) {
      toast({
        title: "Cannot save item",
        description: "Please fill in the item name",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Calculate next display_order to append to end of category
      let nextDisplayOrder = 10; // Default for first item
      if (formData.category_id) {
        const { data: maxOrderItem } = await supabase
          .from('menu_items')
          .select('display_order')
          .eq('category_id', formData.category_id)
          .order('display_order', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        
        if (maxOrderItem?.display_order != null) {
          nextDisplayOrder = maxOrderItem.display_order + 10;
        }
      }

      const { data: insertedItem, error } = await supabase
        .from('menu_items')
        .insert([{
          ...formData,
          company_id: null,
          display_order: nextDisplayOrder,
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      if (insertedItem) {
        setTempMenuItemId(insertedItem.id);
        toast({ title: "Menu item saved" });
        queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
        queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
        setShowProductLinkBuilder(true);
      }
    } catch (error) {
      console.error('Error creating menu item:', error);
      toast({ 
        title: "Error saving menu item", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput && !formData.tags.includes(tagInput)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput]
      }));
      setTagInput('');
    }
  };

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

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleCloseModal = () => {
    // Reset state when closing the main modal
    setTempMenuItemId(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      category_id: null,
      tags: [],
      allergens: [],
      image_urls: [],
    });
    setTagInput('');
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showProductLinkBuilder && !showIngredientsModal} onOpenChange={handleCloseModal}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Add New Menu Item</DialogTitle>
          <DialogDescription>
            Add a new item to your menu
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-1">
          <form onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (£)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  placeholder="Leave blank for variant pricing"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank if pricing will be set via Product Links
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Menu Category</Label>
              <Select 
                value={formData.category_id || 'uncategorized'} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value === 'uncategorized' ? null : value }))}
                disabled={isLoading || categoriesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {getAllCategories().map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.parent_name 
                        ? `${category.parent_name} → ${category.name}`
                        : category.name
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Add tag (e.g., vegan, spicy)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  disabled={isLoading}
                />
                <Button type="button" onClick={addTag} disabled={isLoading}>Add</Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="cursor-pointer" 
                      onClick={() => !isLoading && removeTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Configuration Buttons */}
            <div className="pt-4 border-t space-y-3">
              {/* Product Links Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (tempMenuItemId) {
                    setShowProductLinkBuilder(true);
                  } else {
                    handleSaveAndConfigure();
                  }
                }}
                disabled={isLoading || !canCreate}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configure Product Links & Modifiers
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Set up size options, add-ons, and modifiers with custom pricing
              </p>
              
              {/* Ingredients Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (tempMenuItemId) {
                    setShowIngredientsModal(true);
                  } else {
                    handleSaveAndConfigure().then(() => {
                      setShowIngredientsModal(true);
                    });
                  }
                }}
                disabled={isLoading || !canCreate}
              >
                <Utensils className="h-4 w-4 mr-2" />
                Ingredients
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Add and manage ingredients for this menu item
              </p>
            </div>

            {!companyId && !authLoading && (
              <div className="mb-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Unable to create menu items - company context not available.
                </p>
              </div>
            )}
          </form>
        </ScrollArea>

        <div className="flex justify-end space-x-2 flex-shrink-0 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !canCreate} onClick={handleSubmit}>
            {isLoading ? 'Saving...' : tempMenuItemId ? 'Save & Close' : 'Add Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {tempMenuItemId && (
      <>
        <ProductLinkBuilder
          open={showProductLinkBuilder}
          menuItemId={tempMenuItemId}
          menuItemName={formData.name}
          menuItemPrice={formData.price}
          onClose={() => {
            setShowProductLinkBuilder(false);
            
            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
            queryClient.invalidateQueries({ queryKey: ['menu-item-product-links', companyId] });
          }}
        />
        
        <IngredientsModal
          isOpen={showIngredientsModal}
          onClose={() => {
            setShowIngredientsModal(false);
            
            // ✅ Comprehensive invalidation to update ALL views
            queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
            queryClient.invalidateQueries({ queryKey: ['menu-item-ingredients', tempMenuItemId] });
            queryClient.invalidateQueries({ queryKey: ['menu-item-allergens', tempMenuItemId] });
            queryClient.invalidateQueries({ queryKey: ['menu-items-management', companyId] });
            queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
          }}
          menuItemId={tempMenuItemId}
          menuItemName={formData.name}
        />
      </>
    )}
    </>
  );
};
