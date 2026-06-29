import React, { useState } from 'react';
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
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useAuth } from '@/components/AuthProvider';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
}

const CreateCategoryModal = ({ isOpen, onClose, parentId }: CreateCategoryModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryType, setCategoryType] = useState<'drinks' | 'starters' | 'mains' | 'desserts'>('mains');
  const { createCategory, isCreating } = useMenuCategories();
  const { companyId, loading: authLoading } = useAuth();

  const canCreate = !authLoading && !!companyId && name.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreate) return;

    createCategory({
      name: name.trim(),
      description: description.trim() || undefined,
      parent_id: parentId || null,
      category_type: categoryType,
    });

    // Reset form and close
    setName('');
    setDescription('');
    setCategoryType('mains');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setCategoryType('mains');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {parentId ? 'Create New Subcategory' : 'Create New Category'}
          </DialogTitle>
          <DialogDescription>
             {parentId 
               ? 'Add a new subcategory to organise your menu items further.'
               : 'Add a new main category to organise your menu items.'
             }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={parentId ? "Enter subcategory name" : "Enter category name"}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-type">Category Type</Label>
            <Select 
              value={categoryType} 
              onValueChange={(value: any) => setCategoryType(value)}
            >
              <SelectTrigger id="category-type">
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

          {!companyId && !authLoading && (
            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Unable to create categories - company context not available.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !canCreate}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCategoryModal;