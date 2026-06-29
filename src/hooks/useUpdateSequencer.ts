import { useCallback, useRef } from 'react';

interface PendingUpdate {
  id: string;
  timestamp: number;
  execute: () => void | Promise<void>;
}

/**
 * Prevents rapid successive updates from interfering with each other
 * by sequencing them and debouncing rapid calls
 */
export const useUpdateSequencer = () => {
  const pendingUpdatesRef = useRef<PendingUpdate[]>([]);
  const isProcessingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const processNextUpdate = useCallback(async () => {
    if (isProcessingRef.current || pendingUpdatesRef.current.length === 0) return;

    isProcessingRef.current = true;
    const update = pendingUpdatesRef.current.shift();
    
    if (update) {
      console.log('🔄 Processing sequenced update:', update.id);
      try {
        await update.execute();
      } catch (error) {
        console.error('❌ Sequenced update failed:', error);
      } finally {
        isProcessingRef.current = false;
        // Process next update after a small delay to prevent race conditions
        setTimeout(processNextUpdate, 50);
      }
    }
  }, []);

  const queueUpdate = useCallback((id: string, updateFn: () => void | Promise<void>) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Remove any existing update with the same ID (latest wins)
    pendingUpdatesRef.current = pendingUpdatesRef.current.filter(u => u.id !== id);

    // Add new update
    const newUpdate: PendingUpdate = {
      id,
      timestamp: Date.now(),
      execute: updateFn
    };

    pendingUpdatesRef.current.push(newUpdate);
    console.log('📝 Queued update:', id, 'Queue size:', pendingUpdatesRef.current.length);

    // Debounce processing to batch rapid updates
    debounceTimerRef.current = setTimeout(() => {
      processNextUpdate();
    }, 100);
  }, [processNextUpdate]);

  const clearQueue = useCallback(() => {
    pendingUpdatesRef.current = [];
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  return {
    queueUpdate,
    clearQueue,
    getPendingCount: () => pendingUpdatesRef.current.length
  };
};