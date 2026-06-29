import { useState } from 'react';
import { useMenuItems } from '@/hooks/useMenuItems';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SyncOptions {
  posSystem: string;
  direction: 'to_pos' | 'from_pos' | 'bidirectional';
  overwriteConflicts?: boolean;
  selectedItems?: string[];
}

interface SyncConflict {
  entityId: string;
  entityType: 'menu_item' | 'menu_category';
  conflictReason: string;
  localData: any;
  remoteData: any;
  resolution?: 'keep_local' | 'keep_remote' | 'merge';
}

export const useMenuItemsSync = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  const { companyId: effectiveCompanyId } = useCompanyId();
  const { menuItems, refetch, updateMenuItem } = useMenuItems();
  const { toast } = useToast();

  // Note: External POS sync functions removed as we're using internal POS only
  const syncToPos = async (options: SyncOptions) => {
    throw new Error('External POS sync is no longer supported. Using internal POS system.');
  };

  const syncFromPos = async (options: SyncOptions) => {
    throw new Error('External POS sync is no longer supported. Using internal POS system.');
  };

  const resolveSyncConflict = async (conflict: SyncConflict, resolution: 'keep_local' | 'keep_remote' | 'merge') => {
    try {
      let resolvedData: any;

      switch (resolution) {
        case 'keep_local':
          // Keep the local version, mark as resolved
          resolvedData = conflict.localData;
          break;
        
        case 'keep_remote':
          // Accept the remote version
          resolvedData = conflict.remoteData;
          break;
        
        case 'merge':
          // Merge both versions with preference to local for critical fields
          resolvedData = {
            ...conflict.remoteData,
            ...conflict.localData,
            // Keep local pricing and descriptions but accept remote categories
            price: conflict.localData.price,
            description: conflict.localData.description,
            category_id: conflict.remoteData.category_id
          };
          break;
      }

      // Update the item based on resolution
      if (conflict.entityType === 'menu_item') {
        await updateMenuItem(conflict.entityId, resolvedData);
      }

      // Update sync status
      await supabase
        .from(conflict.entityType === 'menu_item' ? 'menu_items' : 'menu_categories')
        .update({
          pos_sync_status: 'synced',
          sync_conflicts: null,
          last_pos_sync: new Date().toISOString()
        })
        .eq('id', conflict.entityId)
        .eq('company_id', effectiveCompanyId);

      // Remove from conflicts list
      setConflicts(prev => prev.filter(c => c.entityId !== conflict.entityId));

      toast({
        title: "Conflict Resolved",
        description: `Successfully resolved conflict for ${conflict.entityType}`,
      });

      return true;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      toast({
        title: "Resolution Failed",
        description: "Failed to resolve the sync conflict",
        variant: "destructive"
      });
      return false;
    }
  };

  const resolveMultipleConflicts = async (resolutions: Array<{ conflict: SyncConflict; resolution: 'keep_local' | 'keep_remote' | 'merge' }>) => {
    let successCount = 0;
    const errors: string[] = [];

    for (const { conflict, resolution } of resolutions) {
      try {
        const success = await resolveSyncConflict(conflict, resolution);
        if (success) successCount++;
      } catch (error) {
        errors.push(`Failed to resolve ${conflict.localData.name}: ${error.message}`);
      }
    }

    toast({
      title: `Resolved ${successCount} Conflicts`,
      description: errors.length > 0 
        ? `${errors.length} conflicts failed to resolve`
        : 'All conflicts resolved successfully',
      variant: errors.length > 0 ? 'destructive' : 'default'
    });

    return { successCount, errors };
  };

  const getSyncStatusForItem = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('pos_sync_status, last_pos_sync, sync_conflicts, external_pos_id')
        .eq('id', itemId)
        .eq('company_id', effectiveCompanyId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return null;
    }
  };

  const markItemForSync = async (itemId: string, posSystem: string) => {
    try {
      await supabase
        .from('menu_items')
        .update({
          pos_sync_status: 'pending'
        })
        .eq('id', itemId)
        .eq('company_id', effectiveCompanyId);

      toast({
        title: "Item Marked for Sync",
        description: "Item will be synced in the next batch operation",
      });
    } catch (error) {
      console.error('Failed to mark item for sync:', error);
      toast({
        title: "Error",
        description: "Failed to mark item for sync",
        variant: "destructive"
      });
    }
  };

  const resetSyncState = () => {
    setSyncStatus('idle');
    setSyncProgress(0);
    setConflicts([]);
    setLastSyncResult(null);
  };

  const getConflictsCount = () => conflicts.length;

  const hasUnresolvedConflicts = () => conflicts.length > 0;

  return {
    // State
    syncStatus,
    syncProgress,
    conflicts,
    lastSyncResult,

    // Actions
    syncToPos,
    syncFromPos,
    resolveSyncConflict,
    resolveMultipleConflicts,
    getSyncStatusForItem,
    markItemForSync,
    resetSyncState,

    // Helpers
    getConflictsCount,
    hasUnresolvedConflicts
  };
};
