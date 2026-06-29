import { useEffect, useCallback, useRef, useState } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { useCompanySettings } from './useCompanySettings';
import { supabase } from '@/integrations/supabase/client';
import { getRawPin } from '@/utils/pinAuth';

interface UseRealtimeOptimizationOptions {
  enabled?: boolean;
  debounceMs?: number;
  contextDate?: string; // Pass target date for optimization
  onOptimizationComplete?: (result: { success: boolean; movesCount: number }) => void;
}

export function useRealtimeOptimization(options: UseRealtimeOptimizationOptions = {}) {
  const { currentUser: user } = useCurrentUser();
  const { settings: companySettings } = useCompanySettings();
  const optimizationQueueRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  const subscriptionRef = useRef<any>(null);
  const initialOptimizationDoneRef = useRef(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  const {
    enabled = true,
    debounceMs = 800, // 800ms debounce for faster response
    contextDate, // Target date for optimization
    onOptimizationComplete
  } = options;

  /**
   * Silent real-time optimization - triggers instantly on changes
   */
  const runOptimization = useCallback(async (reason = 'real-time trigger') => {
    // Global HOLD: if a manual drop recently occurred, defer optimization until hold expires
    try {
      const win = window as any;
      const localHold = localStorage.getItem('optimization_hold_until');
      const holdUntilMs = Math.max(
        typeof win.__OPTIMIZATION_HOLD_UNTIL === 'number' ? win.__OPTIMIZATION_HOLD_UNTIL : 0,
        localHold ? new Date(localHold).getTime() : 0
      );
      const nowMs = Date.now();
      if (holdUntilMs && nowMs < holdUntilMs) {
        const waitMs = holdUntilMs - nowMs + 100; // small buffer
        console.log(`⏸️ Optimization held for ${waitMs}ms (reason: ${reason})`);
        setTimeout(() => runOptimization('post-hold'), waitMs);
        return;
      }
    } catch {}

    // CRITICAL: Validate company context before proceeding
    if (!user?.company_id) {
      console.error('❌ Cannot run optimization: user.company_id is missing', { user });
      return;
    }

    if (isRunningRef.current) {
      console.log('⏭️ Optimization already running, skipping...');
      return;
    }

    const optimizationMode = companySettings?.optimization_mode || 'continuous';
    const isOptimizationEnabled = optimizationMode !== 'disabled' && 
      (companySettings?.optimization_enabled || companySettings?.auto_assign_tables || false);
    
    if (!isOptimizationEnabled) {
      console.log('⏭️ Optimization disabled for company:', user.company_id);
      return;
    }

    isRunningRef.current = true;

    try {
      console.log(`🚀 REAL-TIME OPTIMIZATION: ${reason}`, {
        companyId: user.company_id,
        contextDate,
        optimizationMode
      });

      const pin = getRawPin();
      console.log(`🔑 [REALTIME-OPT] Using PIN: ${pin ? 'present' : 'missing'}, company: ${user.company_id}`);

      // CRITICAL: Ensure companyId is valid before calling edge function
      if (!user.company_id || user.company_id === 'undefined') {
        console.error('❌ [REALTIME-OPT] Invalid companyId, aborting:', user.company_id);
        isRunningRef.current = false;
        return;
      }

      // PHASE 4: Ensure companyId is always passed and validated
      if (!user.company_id) {
        console.error('❌ Cannot optimize: user.company_id is undefined');
        isRunningRef.current = false;
        return;
      }
      
      const response = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId: user.company_id, // PHASE 4: Explicitly validated
          mode: 'immediate',
          targetDate: contextDate,
          pin: pin,
          isAuthenticatedAdmin: true,
          automated: true
        }
      });

      if (response.error) {
        console.error('📞 Function error:', response.error);
        // If PIN is missing, retry with admin fallback
        if (response.error.message?.includes('PIN') && !pin) {
          console.log('🔄 Retrying with admin-only fallback...');
          
          // Validate companyId again before retry
          if (!user.company_id || user.company_id === 'undefined') {
            console.error('❌ Cannot retry: Invalid companyId:', user.company_id);
            isRunningRef.current = false;
            return;
          }
          
          const retryResponse = await supabase.functions.invoke('continuous-optimizer', {
            body: {
              companyId: user.company_id, // Explicitly pass validated companyId
              mode: 'immediate',
              targetDate: contextDate,
              isAuthenticatedAdmin: true
            }
          });
          if (retryResponse.data) {
            console.log(`📞 Retry success: ${retryResponse.data.movesCount || 0} moves`);
            onOptimizationComplete?.(retryResponse.data);
            return;
          }
        }
      }

      console.log(`📞 Function response:`, response.error ? `Error: ${response.error.message}` : `Success with ${response.data?.movesCount || 0} moves`);

      const result = response.data || { success: false, movesCount: 0 };

      // Silent background logging only
      if (result.movesCount > 0) {
        console.log(`✨ REAL-TIME: Optimized ${result.movesCount} reservation(s) - ${reason}`);
      }

      onOptimizationComplete?.(result);
      
      // Force refresh company settings to update last_optimized_at display
      if (result.movesCount > 0) {
        // Trigger a refetch via the realtime subscription or manual query invalidation
        // The existing realtime subscription in useCompanySettings will handle the update
      }

    } catch (error) {
      console.error('Real-time optimization error:', error);
      onOptimizationComplete?.({ success: false, movesCount: 0 });
    } finally {
      isRunningRef.current = false;
    }
  }, [user?.company_id, companySettings, onOptimizationComplete]);

  /**
   * Debounced optimization trigger - batches rapid changes
   */
  const triggerOptimization = useCallback((reason = 'reservation change') => {
    // Clear existing timeout to restart debounce period
    if (optimizationQueueRef.current) {
      clearTimeout(optimizationQueueRef.current);
    }

    // Queue optimization with debounce
    optimizationQueueRef.current = setTimeout(() => {
      runOptimization(reason);
    }, debounceMs);
  }, [runOptimization, debounceMs]);

  /**
   * Set up real-time subscription to reservations table
   */
  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.company_id || !enabled) {
      return;
    }

    console.log('🔄 Setting up real-time optimization subscription...');

    // Subscribe to changes for this company
    const channel = supabase
      .channel('reservation-optimization')
      // Listen to reservation changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `company_id=eq.${user.company_id}`
        },
        (payload) => {
          const eventType = payload.eventType;
          const reservation = payload.new || payload.old;
          
          // Type guard to ensure reservation has expected properties
          const reservationId = (reservation && typeof reservation === 'object' && 'id' in reservation) 
            ? (reservation as any).id 
            : 'unknown';
          
          console.log(`📡 REAL-TIME EVENT: ${eventType} - Reservation ${reservationId}`);
          
          // Trigger optimization based on event type
          switch (eventType) {
            case 'INSERT':
              triggerOptimization('new reservation created');
              break;
            case 'UPDATE':
          // Check if it's a meaningful change that affects optimization
          const oldReservation = payload.old;
          const newReservation = payload.new;
          
          // Skip optimization if reservation has a temporary lock (manual move within last 10 seconds)
          const hasTemporaryLock = newReservation?.locked_until && 
            new Date(newReservation.locked_until) > new Date();
          
          if (hasTemporaryLock) {
            const lockExpiryTime = new Date(newReservation.locked_until).getTime();
            const currentTime = new Date().getTime();
            const remainingMs = lockExpiryTime - currentTime;
            
            console.log(`⏳ Skipping optimization - reservation ${newReservation.id} temporarily locked until ${newReservation.locked_until}`);
            
            // Schedule post-lock optimization as fallback
            if (remainingMs > 0 && remainingMs < 30000) { // Only if reasonable duration
              setTimeout(() => {
                console.log(`🕐 POST-LOCK OPTIMIZATION TRIGGERED for reservation ${newReservation.id}`);
                runOptimization('post-lock (subscription)');
              }, remainingMs + 100); // Small buffer after lock expires
            }
            return;
          }
          
          if (
            oldReservation?.table_number !== newReservation?.table_number ||
            oldReservation?.time !== newReservation?.time ||
            oldReservation?.party_size !== newReservation?.party_size ||
            oldReservation?.status !== newReservation?.status
          ) {
            triggerOptimization('reservation updated');
          }
              break;
            case 'DELETE':
              triggerOptimization('reservation cancelled');
              break;
          }
        }
      )
      // Listen to table changes (availability, status)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `company_id=eq.${user.company_id}`
        },
        (payload) => {
          console.log(`📡 TABLE CHANGE: ${payload.eventType}`);
          triggerOptimization('table availability changed');
        }
      )
      // Listen to table group changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_groups',
          filter: `company_id=eq.${user.company_id}`
        },
        (payload) => {
          console.log(`📡 TABLE GROUP CHANGE: ${payload.eventType}`);
          triggerOptimization('table groups updated');
        }
      )
      // Listen to table group membership changes
      // Note: table_group_memberships doesn't have company_id directly,
      // so we can't filter by company at the subscription level.
      // Instead, we verify company_id through group_id in the handler.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_group_memberships'
        },
        async (payload) => {
          // CRITICAL: Verify this change belongs to our company before optimizing
          const newData = payload.new as any;
          const oldData = payload.old as any;
          const groupId = newData?.group_id || oldData?.group_id;
          
          if (groupId) {
            // Check if this group belongs to our company
            const { data: group } = await supabase
              .from('table_groups')
              .select('company_id')
              .eq('id', groupId)
              .maybeSingle();
            
            if (group?.company_id === user.company_id) {
              console.log(`📡 TABLE GROUP MEMBERSHIP CHANGE: ${payload.eventType} (verified our company)`);
              triggerOptimization('table group membership changed');
            } else {
              console.log(`⏭️ TABLE GROUP MEMBERSHIP CHANGE: ${payload.eventType} (other company, skipping)`);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time optimization subscription active');
          setIsRealtimeActive(true);
          
          // One-time optimization when subscription becomes active
          if (!initialOptimizationDoneRef.current && contextDate) {
            console.log('🚀 Initial optimization trigger for date:', contextDate);
            initialOptimizationDoneRef.current = true;
            setTimeout(() => {
              runOptimization('initial_load');
            }, 1000);
          }
        } else if (status === 'CLOSED') {
          console.log('🔌 Real-time optimization subscription closed');
          setIsRealtimeActive(false);
        }
      });

    subscriptionRef.current = channel;
  }, [user?.company_id, enabled, triggerOptimization]);

  /**
   * Clean up subscription
   */
  const cleanupSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
      console.log('🧹 Real-time optimization subscription cleaned up');
    }

    if (optimizationQueueRef.current) {
      clearTimeout(optimizationQueueRef.current);
      optimizationQueueRef.current = null;
    }
  }, []);

  /**
   * Manual optimization trigger (for UI buttons)
   */
  const manualTrigger = useCallback(() => {
    // Clear debounce and run immediately for manual triggers
    if (optimizationQueueRef.current) {
      clearTimeout(optimizationQueueRef.current);
      optimizationQueueRef.current = null;
    }
    runOptimization('manual trigger');
  }, [runOptimization]);

  // Setup and cleanup subscription
  useEffect(() => {
    const optimizationMode = companySettings?.optimization_mode || 'continuous';
    const isOptimizationEnabled = optimizationMode !== 'disabled' && 
      (companySettings?.optimization_enabled || companySettings?.auto_assign_tables || false);

    if (enabled && user?.company_id && isOptimizationEnabled) {
      setupRealtimeSubscription();
    } else {
      cleanupSubscription();
    }

    return cleanupSubscription;
  }, [enabled, user?.company_id, companySettings, setupRealtimeSubscription, cleanupSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanupSubscription;
  }, [cleanupSubscription]);

  const optimizationMode = companySettings?.optimization_mode || 'continuous';
  const isEnabled = optimizationMode !== 'disabled' && 
    (companySettings?.optimization_enabled || companySettings?.auto_assign_tables || false);

  return {
    isRunning: isRunningRef.current,
    isEnabled,
    triggerOptimization: manualTrigger,
    isRealtimeActive
  };
}