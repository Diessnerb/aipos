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
import { useIngredients } from '@/hooks/useIngredients';
import { Ingredient } from '@/types/ingredients';

interface DeleteIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: Ingredient;
}

export const DeleteIngredientModal = ({ isOpen, onClose, ingredient }: DeleteIngredientModalProps) => {
  const { deleteIngredient } = useIngredients();

  const handleDelete = async () => {
    await deleteIngredient.mutateAsync(ingredient.id);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Ingredient</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{ingredient.name}</strong>? This action will hide the ingredient from your library but won't affect existing menu items using it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
