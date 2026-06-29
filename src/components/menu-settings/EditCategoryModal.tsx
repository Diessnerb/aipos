import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMenuCategories, MenuCategory } from '@/hooks/useMenuCategories';

interface EditCategoryModalProps {
  category: MenuCategory;
  isOpen: boolean;
  onClose: () => void;
}

const EditCategoryModal = ({ category, isOpen, onClose }: EditCategoryModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryType, setCategoryType] = useState<'drinks' | 'starters' | 'mains' | 'desserts'>('mains');
  const { updateCategory, isUpdating } = useMenuCategories();

  // Helper to clean up stuck Radix overlays
  const cleanupClosedRadixOverlays = () => {
    setTimeout(() => {
      document.querySelectorAll('[data-radix-portal]').forEach(portal => {
        const overlay = portal.querySelector('[data-state="closed"]');
        if (overlay instanceof HTMLElement) {
          overlay.style.pointerEvents = 'none';
        }
      });
    }, 100);
  };

  // Force unfreeze the page
  const forceUnfreezePage = () => {
    setTimeout(() => {
      document.querySelectorAll('[inert]').forEach(el => el.removeAttribute('inert'));
      const body = document.body;
      const root = document.getElementById('root');
      if (body) body.style.pointerEvents = 'auto';
      if (root) root.style.pointerEvents = 'auto';
      document.querySelectorAll('[data-radix-portal] [data-state="closed"]').forEach(el => {
        if (el instanceof HTMLElement) el.style.pointerEvents = 'none';
      });
    }, 50);
  };

  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description || '');
      setCategoryType(category.category_type || 'mains');
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    // Close modal immediately
    onClose();
    cleanupClosedRadixOverlays();
    forceUnfreezePage();

    // Defer the update to next tick so dialog fully closes before cache rebuild
    setTimeout(() => {
      updateCategory({
        id: category.id,
        name: name.trim(),
        description: description.trim() || null,
        category_type: categoryType,
      });
    }, 0);
  };

  const handleClose = () => {
    setName(category.name);
    setDescription(category.description || '');
    setCategoryType(category.category_type || 'mains');
    onClose();
    cleanupClosedRadixOverlays();
    forceUnfreezePage();
  };

  const isSubcategory = category.parent_id !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Edit {isSubcategory ? 'Subcategory' : 'Category'}
          </DialogTitle>
          <DialogDescription>
            Update the {isSubcategory ? 'subcategory' : 'category'} details.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSubcategory ? "Enter subcategory name" : "Enter category name"}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-category-type">Category Type</Label>
            <Select 
              value={categoryType} 
              onValueChange={(value: any) => setCategoryType(value)}
            >
              <SelectTrigger id="edit-category-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drinks">🔵 Drinks (No Kitchen)</SelectItem>
                <SelectItem value="starters">🟢 Starters</SelectItem>
                <SelectItem value="mains">🟠 Mains</SelectItem>
                <SelectItem value="desserts">🟣 Desserts</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Drinks will not appear in the kitchen display
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating || !name.trim()}>
              {isUpdating ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCategoryModal;
