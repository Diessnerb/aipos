import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Loader2 } from 'lucide-react';
import { useRealtimeOptimization } from '@/hooks/useRealtimeOptimization';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCompanyId } from '@/hooks/useCompanyId';
import { supabase } from '@/integrations/supabase/client';
import { getRawPin } from '@/utils/pinAuth';

interface ManualOptimizationTriggerProps {
  selectedDate: string;
  onOptimizationComplete?: () => void;
}

export const ManualOptimizationTrigger: React.FC<ManualOptimizationTriggerProps> = ({
  selectedDate,
  onOptimizationComplete
}) => {
  const [isManualRun, setIsManualRun] = useState(false);
  const { currentUser } = useCurrentUser();
  const { companyId: effectiveCompanyId } = useCompanyId();
  
  const { isEnabled, isRealtimeActive } = useRealtimeOptimization({
    onOptimizationComplete: (result) => {
      if (result.success && result.movesCount > 0) {
        onOptimizationComplete?.();
      }
    }
  });

  const handleManualOptimization = async () => {
    if (!effectiveCompanyId) {
      console.error('No company ID found');
      return;
    }

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
        const waitSec = Math.ceil((holdUntilMs - nowMs) / 1000);
        console.log(`⏸️ Optimization hold active: ${waitSec}s remaining`);
        return;
      }
    } catch {}

    setIsManualRun(true);
    try {
      console.log('🚀 [MANUAL-OPT] Manual optimization triggered', {
        source: 'ManualOptimizationTrigger',
        selectedDate
      });
      
      // HARMONIZED: All optimization through edge function
      const response = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId: effectiveCompanyId,
          mode: 'immediate',
          targetDate: selectedDate,
          pin: getRawPin(),
          isAuthenticatedAdmin: true,
          forceOptimization: true,
          automated: false
        }
      });

      const result = response.data || { success: false, movesCount: 0 };
      
      console.log('🚀 [MANUAL-OPT] Result:', result);
      
      if (result.success && result.movesCount > 0) {
        onOptimizationComplete?.();
      }
    } catch (error) {
      console.error('Manual optimization error:', error);
    } finally {
      setIsManualRun(false);
    }
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="h-6 px-2 text-xs">
        {isRealtimeActive ? (
          <>
            <Zap className="w-3 h-3 mr-1 text-green-500" />
            Real-time Active
          </>
        ) : (
          'Optimization Ready'
        )}
      </Badge>
      
      <Button
        onClick={handleManualOptimization}
        disabled={isManualRun}
        size="sm"
        className="h-7 px-3 text-xs"
      >
        {isManualRun ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Optimizing...
          </>
        ) : (
          <>
            <Zap className="w-3 h-3 mr-1" />
            Optimize Now
          </>
        )}
      </Button>
    </div>
  );
};