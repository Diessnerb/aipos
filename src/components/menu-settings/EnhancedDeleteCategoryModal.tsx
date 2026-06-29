import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
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
import { MenuCategory } from '@/hooks/useMenuCategories';

interface EnhancedDeleteCategoryModalProps {
  category: MenuCategory;
  isOpen: boolean;
  onClose: () => void;
}

const EnhancedDeleteCategoryModal = ({ category, isOpen, onClose }: EnhancedDeleteCategoryModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const deviceLive = useDeviceLiveLayer();

  // Defensive cleanup to ensure closed Radix overlays don't intercept clicks
  const cleanupClosedRadixOverlays = () => {
    try {
      // Let Radix update data-state="closed" before scanning
      setTimeout(() => {
        const nodes = document.querySelectorAll('[data-radix-portal] [data-state="closed"]');
        console.log('🧹 Overlay cleanup - closed nodes:', nodes.length);
        nodes.forEach((n) => {
          (n as HTMLElement).style.pointerEvents = 'none';
        });
      }, 250);
    } catch (e) {
      console.warn('Overlay cleanup error:', e);
    }
  };

  // Force clear any stuck inert attributes and unfreeze pointer events
  const forceUnfreezePage = () => {
    try {
      const inertNodes = document.querySelectorAll('[inert]');
      inertNodes.forEach((n) => (n as HTMLElement).removeAttribute('inert'));
      const closedNodes = document.querySelectorAll('[data-radix-portal] [data-state="closed"]');
      closedNodes.forEach((n) => {
        (n as HTMLElement).style.pointerEvents = 'none';
      });
      const rootEl = document.getElementById('root');
      if (rootEl) (rootEl as HTMLElement).style.pointerEvents = 'auto';
      document.body.style.pointerEvents = 'auto';
      console.log('🧊 Force unfreeze applied', { inertCleared: inertNodes.length, closedOverlays: closedNodes.length });
    } catch (e) {
      console.warn('forceUnfreezePage error:', e);
    }
  };

  // Helper to manually fetch and rebuild category hierarchy when device live layer is active
  const refreshCategoriesFromServerAndSetCache = async () => {
    console.log('🔄 Manually refreshing categories from server for device live layer');
    
    const { data: categories, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    // Rebuild hierarchy manually (same logic as useMenuCategories)
    const mainCategories: MenuCategory[] = [];
    const subcategoryMap = new Map<string, MenuCategory[]>();

    categories?.forEach((cat) => {
      const categoryData: MenuCategory = {
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id,
        display_order: cat.display_order,
        description: cat.description,
        is_active: cat.is_active,
        created_at: cat.created_at,
        updated_at: cat.updated_at,
        company_id: cat.company_id,
        subcategories: [],
      };

      if (cat.parent_id) {
        if (!subcategoryMap.has(cat.parent_id)) {
          subcategoryMap.set(cat.parent_id, []);
        }
        subcategoryMap.get(cat.parent_id)?.push(categoryData);
      } else {
        mainCategories.push(categoryData);
      }
    });

    mainCategories.forEach((cat) => {
      cat.subcategories = subcategoryMap.get(cat.id) || [];
    });

    console.log('✅ Rebuilt category hierarchy:', mainCategories);
    
    // Update cache directly
    queryClient.setQueryData(['menu_categories', companyId], mainCategories);
  };

  const deleteWithCascadeMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      console.log('🗑️ Starting enhanced category deletion for:', categoryId);

      // First, uncategorize all menu items in this category and its subcategories
      const categoryIds = [categoryId];
      
      // If this is a parent category, get all its subcategory IDs
      if (category.subcategories && category.subcategories.length > 0) {
        categoryIds.push(...category.subcategories.map(sub => sub.id));
      }

      // Uncategorize all menu items that belong to this category or its subcategories
      const { error: menuItemsError } = await supabase
        .from('menu_items')
        .update({ category_id: null })
        .in('category_id', categoryIds);

      if (menuItemsError) {
        console.error('Error uncategorizing menu items:', menuItemsError);
        throw menuItemsError;
      }

      // Soft delete all subcategories first (if this is a parent category)
      if (category.subcategories && category.subcategories.length > 0) {
        const { error: subcategoriesError } = await supabase
          .from('menu_categories')
          .update({ is_active: false })
          .in('id', category.subcategories.map(sub => sub.id));

        if (subcategoriesError) {
          console.error('Error deleting subcategories:', subcategoriesError);
          throw subcategoriesError;
        }
      }

      // Finally, soft delete the main category
      const { error: categoryError } = await supabase
        .from('menu_categories')
        .update({ is_active: false })
        .eq('id', categoryId);

      if (categoryError) {
        console.error('Error deleting category:', categoryError);
        throw categoryError;
      }

      console.log('✅ Enhanced category deletion completed successfully');
    },
    onSuccess: async () => {
      const isSubcategory = category.parent_id !== null;
      const subcategoryCount = category.subcategories?.length || 0;
      
      toast({
        title: 'Success',
        description: `${isSubcategory ? 'Subcategory' : 'Category'} deleted successfully${
          subcategoryCount > 0 ? ` along with ${subcategoryCount} subcategories` : ''
        }. Associated menu items have been uncategorized.`,
      });
      
      // Close modal first to prevent UI freeze
      onClose();
      // Defensive: ensure any closed Radix overlays stop intercepting clicks
      cleanupClosedRadixOverlays();
      // Backstop: ensure page is unfrozen
      forceUnfreezePage();
      
      console.log('🔄 Category deleted, refreshing cache and invalidating queries. DeviceLive:', deviceLive);
      
      // Always rebuild hierarchy and update cache immediately
      await refreshCategoriesFromServerAndSetCache();
      
      // Invalidate related queries in the background (no blocking timeouts)
      queryClient.invalidateQueries({ queryKey: ['menu_categories', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete category. Please try again.',
        variant: 'destructive',
      });
      console.error('Error in enhanced category deletion:', error);
      // Ensure dialog closes even if an error occurs to avoid stuck overlays
      onClose();
      // Defensive overlay cleanup
      cleanupClosedRadixOverlays();
      // Backstop: ensure page is unfrozen on error
      forceUnfreezePage();
    },
  });

  const isSubcategory = category.parent_id !== null;
  const subcategoryCount = category.subcategories?.length || 0;
  const hasSubcategories = subcategoryCount > 0;

  const handleDelete = () => {
    // Close dialog first to prevent overlay race conditions
    try { onClose(); } catch {}
    // Immediately clean overlays and unfreeze page
    cleanupClosedRadixOverlays();
    forceUnfreezePage();
    // Defer mutation to next tick to ensure dialog fully closes
    setTimeout(() => {
      deleteWithCascadeMutation.mutate(category.id);
    }, 0);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {isSubcategory ? 'Subcategory' : 'Category'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <strong>{category.name}</strong>?
            </p>
            
            {hasSubcategories && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-yellow-800 font-medium">
                  ⚠️ This will also delete {subcategoryCount} subcategories:
                </p>
                <ul className="list-disc list-inside text-yellow-700 text-sm mt-1">
                  {category.subcategories?.slice(0, 3).map((sub) => (
                    <li key={sub.id}>{sub.name}</li>
                  ))}
                  {subcategoryCount > 3 && (
                    <li>...and {subcategoryCount - 3} more</li>
                  )}
                </ul>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-blue-800 text-sm">
                💡 <strong>Note:</strong> Any menu items currently assigned to this {isSubcategory ? 'subcategory' : 'category'}{hasSubcategories ? ' or its subcategories' : ''} will be moved to "Uncategorized" and can be reassigned later.
              </p>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Categories are soft-deleted and can potentially be restored if needed.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={deleteWithCascadeMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive/90"
            disabled={deleteWithCascadeMutation.isPending}
          >
            {deleteWithCascadeMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EnhancedDeleteCategoryModal;