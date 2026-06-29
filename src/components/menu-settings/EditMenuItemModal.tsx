import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useAuth } from '@/components/AuthProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { X, Settings2, Utensils } from 'lucide-react';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { ProductLinkBuilder } from '@/components/product-links/ProductLinkBuilder';
import { IngredientsModal } from '@/components/menu-settings/IngredientsModal';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  tags: string[] | null;
  allergens: string[] | null;
}

interface EditMenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
}

const EditMenuItemModal = ({ isOpen, onClose, menuItem }: EditMenuItemModalProps) => {
  const { categories } = useMenuCategories();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showProductLinkBuilder, setShowProductLinkBuilder] = useState(false);
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);

  useEffect(() => {
    if (menuItem) {
      setFormData({
        name: menuItem.name,
        description: menuItem.description || '',
        price: menuItem.price,
        category_id: menuItem.category_id || '',
        tags: menuItem.tags || [],
      });
    }
  }, [menuItem]);

  const updateMenuItemMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('menu_items')
        .update({
          name: data.name,
          description: data.description || null,
          price: data.price,
          category_id: data.category_id || null,
          tags: data.tags.length > 0 ? data.tags : null,
        })
        .eq('id', menuItem?.id);

      if (error) throw error;
    },
    onMutate: async (data: typeof formData) => {
      await queryClient.cancelQueries({ queryKey: ['menu_items', companyId] });
      const previousItems = queryClient.getQueryData<any[]>(['menu_items', companyId]);

      if (menuItem?.id) {
        queryClient.setQueryData(['menu_items', companyId], (old: any[] = []) =>
          old.map((it) =>
            it.id === menuItem.id
              ? {
                  ...it,
                  name: data.name,
                  description: data.description || null,
                  price: data.price,
                  category_id: data.category_id || null,
                  tags: data.tags.length > 0 ? data.tags : null,
                }
              : it
          )
        );
      }

      return { previousItems };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-product-links', companyId] });
      toast({
        title: 'Success',
        description: 'Menu item updated successfully',
      });
      onClose();
    },
    onError: (error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['menu_items', companyId], context.previousItems);
      }
      toast({
        title: 'Error',
        description: 'Failed to update menu item',
        variant: 'destructive',
      });
      console.error('Error updating menu item:', error);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateMenuItemMutation.mutateAsync(formData);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    if (tagInput && !formData.tags.includes(tagInput)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  return (
    <>
      <Dialog open={isOpen && !showProductLinkBuilder && !showIngredientsModal} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Menu Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="price">Price (£)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    price: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="Leave blank for variant pricing"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank if pricing is set via Product Links
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Enter description (optional)"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category_id || 'uncategorized'}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                category_id: value === 'uncategorized' ? '' : value 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
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
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag"
                className="flex-1"
              />
              <Button type="button" onClick={addTag} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Configuration Buttons */}
          <div className="pt-4 border-t space-y-3">
            {/* Product Links Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowProductLinkBuilder(true)}
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
              onClick={() => setShowIngredientsModal(true)}
            >
              <Utensils className="h-4 w-4 mr-2" />
              Ingredients
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Add and manage ingredients for this menu item
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Updating...' : 'Update Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {menuItem && (
      <>
        <ProductLinkBuilder
          open={showProductLinkBuilder}
          menuItemId={menuItem.id}
          menuItemName={menuItem.name}
          menuItemPrice={formData.price}
          onClose={() => setShowProductLinkBuilder(false)}
        />
        
        <IngredientsModal
          isOpen={showIngredientsModal}
          onClose={() => {
            setShowIngredientsModal(false);
            
            // ✅ Comprehensive invalidation
            queryClient.invalidateQueries({ queryKey: ['menu-item-ingredients', menuItem.id] });
            queryClient.invalidateQueries({ queryKey: ['menu-item-allergens', menuItem.id] });
            queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
            queryClient.invalidateQueries({ queryKey: ['menu-items-management', companyId] });
            queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
          }}
          menuItemId={menuItem.id}
          menuItemName={menuItem.name}
        />
      </>
    )}
    </>
  );
};

export default EditMenuItemModal;
