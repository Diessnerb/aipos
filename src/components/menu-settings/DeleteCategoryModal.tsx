import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMenuCategories, MenuCategory } from '@/hooks/useMenuCategories';

interface DeleteCategoryModalProps {
  category: MenuCategory;
  isOpen: boolean;
  onClose: () => void;
}

const DeleteCategoryModal = ({ category, isOpen, onClose }: DeleteCategoryModalProps) => {
  const { deleteCategory, isDeleting } = useMenuCategories();

  const handleDelete = () => {
    deleteCategory(category.id);
    onClose();
  };

  const isSubcategory = category.parent_id !== null;
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {isSubcategory ? 'Subcategory' : 'Category'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete "{category.name}"? This action cannot be undone.
            </p>
            {hasSubcategories && (
              <p className="text-amber-600 font-medium">
                Warning: This category has {category.subcategories?.length} subcategories. 
                Deleting this category will also delete all its subcategories.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Menu items in this {isSubcategory ? 'subcategory' : 'category'} will become uncategorized.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteCategoryModal;