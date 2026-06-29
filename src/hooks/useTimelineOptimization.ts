import { useEffect, useCallback, useRef } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { useCompanySettings } from './useCompanySettings';
import { supabase } from '@/integrations/supabase/client';
import { getRawPin } from '@/utils/pinAuth';

interface UseTimelineOptimizationOptions {
  enabled?: boolean;
  interval?: number; // minutes
  strategicInterval?: number; // minutes for strategic optimization
  onOptimizationComplete?: (result: { success: boolean; movesCount: number }) => void;
}

export function useTimelineOptimization(options: UseTimelineOptimizationOptions = {}) {
  const { currentUser: user } = useCurrentUser();
  const { settings: companySettings } = useCompanySettings();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const strategicIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const {
    enabled = true,
    interval = 5, // 5 minutes default for immediate optimization
    strategicInterval = 60, // 1 hour default for strategic optimization
    onOptimizationComplete
  } = options;

  /**
   * HARMONIZED: All optimization through edge function
   * TIER 1: Silent Background Optimization - NO UI notifications when showToast=false
   */
  const runOptimization = useCallback(async (showToast: boolean = false) => {
    if (!user?.company_id || !companySettings) return;
    
    const optimizationMode = companySettings?.optimization_mode || 'disabled';
    const isOptimizationEnabled = optimizationMode !== 'disabled' && 
      (companySettings?.optimization_enabled || companySettings?.auto_assign_tables || false);
    
    if (!isOptimizationEnabled) {
      return;
    }

    isRunningRef.current = true;

    try {
      // Check for global optimization hold
      try {
        const win = window as any;
        const localHold = localStorage.getItem('optimization_hold_until');
        const holdUntilMs = Math.max(
          typeof win.__OPTIMIZATION_HOLD_UNTIL === 'number' ? win.__OPTIMIZATION_HOLD_UNTIL : 0,
          localHold ? new Date(localHold).getTime() : 0
        );
        const nowMs = Date.now();
        if (holdUntilMs && nowMs < holdUntilMs) {
          const waitMs = holdUntilMs - nowMs + 100;
          console.log(`⏸️ OPT_HOLD_DEFERRED (Timeline): Waiting ${waitMs}ms`);
          isRunningRef.current = false;
          setTimeout(() => runOptimization(showToast), waitMs);
          return;
        }
      } catch {}

      console.log('🔧 [TIMELINE-OPT] Starting optimization:', {
        companyId: user.company_id,
        showToast,
        mode: 'immediate',
        source: 'useTimelineOptimization'
      });

      // HARMONIZED: Only call edge function - all logic centralized there
      const response = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId: user.company_id,
          mode: 'immediate',
          pin: getRawPin(),
          isAuthenticatedAdmin: true,
          automated: !showToast
        }
      });

      console.log('🔧 [TIMELINE-OPT] Optimization response:', response);

      const result = response.data || { success: false, movesCount: 0 };

      if (result.movesCount > 0) {
        console.log(`🔧 [TIMELINE-OPT] ${showToast ? 'MANUAL' : 'SILENT'}: Moved ${result.movesCount} reservation(s)`);
      }

      onOptimizationComplete?.(result);

    } catch (error) {
      console.error('[TIMELINE-OPT] Optimization error:', error);
      onOptimizationComplete?.({ success: false, movesCount: 0 });
    } finally {
      isRunningRef.current = false;
    }
  }, [user?.company_id, companySettings, onOptimizationComplete]);

  /**
   * Run strategic optimization during quiet hours
   * HARMONIZED: Uses edge function with 'strategic' mode
   */
  const runStrategicOptimization = useCallback(async () => {
    if (!user?.company_id || isRunningRef.current) {
      return;
    }

    const strategicEnabled = companySettings?.strategic_optimization_enabled ?? true;
    const optimizationMode = companySettings?.optimization_mode || 'disabled';
    
    if (!strategicEnabled || optimizationMode === 'disabled') {
      return;
    }

    isRunningRef.current = true;

    try {
      console.log('🌟 [STRATEGIC-OPT] Starting during quiet hours');
      
      const response = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId: user.company_id,
          mode: 'strategic',  
          pin: getRawPin(),
          isAuthenticatedAdmin: true
        }
      });

      const result = response.data || { success: false, movesCount: 0 };
      
      if (result.movesCount > 0) {
        console.log(`✨ [STRATEGIC-OPT] Completed: ${result.movesCount} moves`);
      }

      onOptimizationComplete?.(result);

    } catch (error) {
      console.error('[STRATEGIC-OPT] Error:', error);
      onOptimizationComplete?.({ success: false, movesCount: 0 });
    } finally {
      isRunningRef.current = false;
    }
  }, [user?.company_id, companySettings, onOptimizationComplete]);

  /**
   * Start Silent Background Optimization System
   */
  const startOptimization = useCallback(() => {
    const optimizationMode = companySettings?.optimization_mode || 'disabled';
    const isOptimizationEnabled = optimizationMode !== 'disabled' && 
      (companySettings?.optimization_enabled || companySettings?.auto_assign_tables || false);
    
    if (!isOptimizationEnabled || !user?.company_id) {
      return;
    }

    intervalRef.current = setInterval(() => {
      runOptimization(false);
    }, interval * 60 * 1000);

    strategicIntervalRef.current = setInterval(() => {
      runStrategicOptimization();
    }, strategicInterval * 60 * 1000);

    console.log(`🔧 [TIMELINE-OPT] Background optimization active`);
    console.log(`   - Immediate: every ${interval} min (silent)`);
    console.log(`   - Strategic: every ${strategicInterval} min`);
  }, [enabled, interval, strategicInterval, runStrategicOptimization, runOptimization, user?.company_id, companySettings]);

  /**
   * Stop continuous optimization
   */
  const stopOptimization = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (strategicIntervalRef.current) {
      clearInterval(strategicIntervalRef.current);
      strategicIntervalRef.current = null;
    }
    
    console.log('🛑 [TIMELINE-OPT] Stopped');
  }, []);

  /**
   * Manual trigger (with toast)
   */
  const triggerOptimization = useCallback(() => {
    runOptimization(true);
  }, [runOptimization]);

  const isRunning = isRunningRef.current;

  const optimizationMode = companySettings?.optimization_mode || 'disabled';
  const isEnabled = optimizationMode !== 'disabled' && 
    (companySettings?.optimization_enabled || companySettings?.auto_assign_tables || false);

  // Auto-start when enabled
  useEffect(() => {
    if (enabled && user?.company_id && isEnabled) {
      startOptimization();
    } else {
      stopOptimization();
    }

    return () => {
      stopOptimization();
    };
  }, [enabled, user?.company_id, isEnabled, startOptimization, stopOptimization]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopOptimization();
    };
  }, [stopOptimization]);

  return {
    isRunning,
    isEnabled,
    triggerOptimization,
    startOptimization,
    stopOptimization,
    runOptimization: triggerOptimization
  };
}
