import { OfflineStorage } from './OfflineStorageService';
import { supabase } from '@/integrations/supabase/client';

interface QueuedMutation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  companyId: string;
}

class OfflineMutationQueueService {
  private readonly QUEUE_KEY = 'offline-mutation-queue';
  
  /**
   * Queue a mutation for later sync when online
   */
  async queueMutation(
    table: string,
    operation: 'insert' | 'update' | 'delete',
    data: any,
    companyId: string
  ): Promise<void> {
    const mutation: QueuedMutation = {
      id: crypto.randomUUID(),
      table,
      operation,
      data,
      timestamp: Date.now(),
      companyId,
    };
    
    const queue = await this.getQueue(companyId);
    queue.push(mutation);
    
    await OfflineStorage.saveCache(
      [this.QUEUE_KEY, companyId],
      queue,
      companyId
    );
    
    console.log(`📝 Queued ${operation} on ${table} for offline sync`);
  }
  
  /**
   * Get all queued mutations for a company
   */
  async getQueue(companyId: string): Promise<QueuedMutation[]> {
    const queue = await OfflineStorage.loadCache([this.QUEUE_KEY, companyId]);
    return queue || [];
  }
  
  /**
   * Sync all queued mutations when online
   * FIX #3: Enhanced validation for company isolation
   * Enhanced with smart conflict resolution
   */
  async syncQueue(companyId: string): Promise<void> {
    const queue = await this.getQueue(companyId);
    
    if (queue.length === 0) {
      console.log('✅ No offline mutations to sync');
      return;
    }
    
    console.log(`🔄 Syncing ${queue.length} offline mutations with conflict resolution...`);
    
    const failedMutations: QueuedMutation[] = [];
    const resolvedConflicts: string[] = [];
    
    for (const mutation of queue) {
      try {
        // FIX #3: Validate mutation belongs to current company
        if (mutation.companyId !== companyId) {
          console.error(`🚨 SECURITY: Blocked cross-company mutation sync`, {
            mutationCompany: mutation.companyId,
            currentCompany: companyId,
            table: mutation.table
          });
          continue;
        }
        
        // FIX #3: Validate data.company_id if present
        if (mutation.data?.company_id && mutation.data.company_id !== companyId) {
          console.error(`🚨 SECURITY: Blocked mutation with mismatched company_id`, {
            dataCompanyId: mutation.data.company_id,
            currentCompany: companyId,
            table: mutation.table
          });
          continue;
        }
        
        // SMART CONFLICT RESOLUTION for UPDATE operations
        if (mutation.operation === 'update' && mutation.data.id) {
          const conflictResolved = await this.resolveUpdateConflict(
            mutation,
            companyId
          );
          
          if (conflictResolved === 'skip') {
            console.log(`⏭️ Skipped stale update for ${mutation.table}:${mutation.data.id}`);
            resolvedConflicts.push(mutation.id);
            continue;
          } else if (conflictResolved === 'merge') {
            resolvedConflicts.push(mutation.id);
          }
        }
        
        // Execute mutation
        if (mutation.operation === 'insert') {
          await (supabase.from as any)(mutation.table).insert(mutation.data);
        } else if (mutation.operation === 'update') {
          await (supabase.from as any)(mutation.table)
            .update(mutation.data)
            .eq('id', mutation.data.id)
            .eq('company_id', companyId);
        } else if (mutation.operation === 'delete') {
          await (supabase.from as any)(mutation.table)
            .delete()
            .eq('id', mutation.data.id)
            .eq('company_id', companyId);
        }
        
        console.log(`✅ Synced ${mutation.operation} on ${mutation.table}`);
      } catch (error) {
        console.error(`❌ Failed to sync mutation:`, error);
        failedMutations.push(mutation);
      }
    }
    
    // Clear queue or keep only failed mutations for retry
    await OfflineStorage.saveCache(
      [this.QUEUE_KEY, companyId],
      failedMutations,
      companyId
    );
    
    if (resolvedConflicts.length > 0) {
      console.log(`✅ Auto-resolved ${resolvedConflicts.length} conflict(s)`);
    }
    
    if (failedMutations.length > 0) {
      console.warn(`⚠️ ${failedMutations.length} mutations failed - will retry on next sync`);
    } else {
      console.log('✅ Offline mutation queue fully synced');
    }
  }
  
  /**
   * Smart conflict resolution for UPDATE operations
   * Returns: 'skip' = don't apply, 'merge' = apply with merge, 'apply' = apply as-is
   */
  private async resolveUpdateConflict(
    mutation: QueuedMutation,
    companyId: string
  ): Promise<'skip' | 'merge' | 'apply'> {
    try {
      // Fetch current server state
      const { data: serverRecord } = await (supabase.from as any)(mutation.table)
        .select('*')
        .eq('id', mutation.data.id)
        .eq('company_id', companyId)
        .single();
      
      if (!serverRecord) {
        // Record doesn't exist on server, apply as-is
        return 'apply';
      }
      
      // Check if server has newer updated_at
      if (serverRecord.updated_at && mutation.data.updated_at) {
        const serverTime = new Date(serverRecord.updated_at).getTime();
        const localTime = new Date(mutation.data.updated_at).getTime();
        
        if (serverTime > localTime) {
          console.log(`🔄 Server has newer version (${serverTime} > ${localTime})`);
          
          // Apply intelligent merge rules for reservations
          if (mutation.table === 'reservations') {
            return this.mergeReservationConflict(mutation, serverRecord);
          }
          
          // For other tables, skip if server is newer
          return 'skip';
        }
      }
      
      return 'apply';
    } catch (error) {
      console.error('❌ Conflict resolution failed:', error);
      // On error, apply mutation (fail-safe)
      return 'apply';
    }
  }
  
  /**
   * Merge reservation conflicts intelligently
   */
  private mergeReservationConflict(
    mutation: QueuedMutation,
    serverRecord: any
  ): 'skip' | 'merge' | 'apply' {
    const statusProgression = [
      'pending',
      'confirmed',
      'seated',
      'waiting-for-order',
      'order-taken',
      'waiting-for-starters',
      'starters-served',
      'waiting-for-mains',
      'mains-served',
      'completed',
      'cancelled',
      'no-show'
    ];
    
    const localStatus = mutation.data.status;
    const serverStatus = serverRecord.status;
    
    // If server status is further along, skip local update
    const localIndex = statusProgression.indexOf(localStatus);
    const serverIndex = statusProgression.indexOf(serverStatus);
    
    if (serverIndex > localIndex) {
      console.log(`🔄 Server status more advanced: ${serverStatus} > ${localStatus}`);
      return 'skip';
    }
    
    // If local status is further along, apply it
    if (localIndex > serverIndex) {
      console.log(`🔄 Local status more advanced: ${localStatus} > ${serverStatus}`);
      return 'merge';
    }
    
    // Same status - use timestamp (already handled in parent function)
    return 'apply';
  }
  
  /**
   * Clear queue (use when device unbound)
   */
  async clearQueue(companyId: string): Promise<void> {
    await OfflineStorage.saveCache(
      [this.QUEUE_KEY, companyId],
      [],
      companyId
    );
    console.log(`🧹 Cleared mutation queue for company ${companyId}`);
  }
}

export const OfflineMutationQueue = new OfflineMutationQueueService();
