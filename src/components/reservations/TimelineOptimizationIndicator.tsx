import { useState, useEffect } from 'react';
import { Zap, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRealtimeOptimization } from '@/hooks/useRealtimeOptimization';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { supabase } from '@/integrations/supabase/client';

interface OptimizationStat {
  recentMoves: number;
  lastOptimized: string | null;
  successRate: number;
}

export function TimelineOptimizationIndicator() {
  const [stats, setStats] = useState<OptimizationStat>({
    recentMoves: 0,
    lastOptimized: null,
    successRate: 0
  });

  const { settings: companySettings } = useCompanySettings();
  const { isRunning, isEnabled, triggerOptimization, isRealtimeActive } = useRealtimeOptimization({
    onOptimizationComplete: (result) => {
      console.log('🎯 Manual optimization completed:', result);
      if (result.success && result.movesCount > 0) {
        loadOptimizationStats(); // Refresh stats after optimization
      }
    }
  });

  // Load optimization statistics
  const loadOptimizationStats = async () => {
    try {
      // Get recent optimization moves (last 24 hours)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data: recentLogs, error: logsError } = await supabase
        .from('optimization_log')
        .select('id, created_at, optimization_session_id')
        .gte('created_at', yesterday.toISOString());

      if (logsError) {
        console.error('Error loading optimization stats:', logsError);
        return;
      }

      const recentMoves = recentLogs?.length || 0;
      
      // Get last optimization time
      const lastOptimized = companySettings?.last_optimized_at || null;

      // Calculate success rate (simplified - assume all logged moves were successful)
      const successRate = recentMoves > 0 ? 100 : 0;

      setStats({
        recentMoves,
        lastOptimized,
        successRate
      });

    } catch (error) {
      console.error('Error loading optimization statistics:', error);
    }
  };

  useEffect(() => {
    loadOptimizationStats();
  }, [companySettings?.last_optimized_at]);

  // Format last optimized time
  const formatLastOptimized = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isEnabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Optimization disabled</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enable auto-assignment or timeline optimization to activate AI optimization</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Status indicator */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              {isRunning ? (
                <>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-blue-500 animate-pulse" />
                    <Badge variant="secondary" className="text-xs">
                      Optimizing...
                    </Badge>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <Badge variant="outline" className="text-xs">
                    Continuous AI
                  </Badge>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p><strong>Continuous AI Optimization</strong></p>
              <p>Status: {isRunning ? 'Running' : 'Active 24/7'}</p>
              <p>Mode: Immediate (5min) + Strategic (60min)</p>
              <p>Coverage: Up to 90 days ahead</p>
              <p>Last run: {formatLastOptimized(stats.lastOptimized)}</p>
              <p>Recent moves: {stats.recentMoves} (24h)</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Stats */}
      {stats.recentMoves > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs">
                {stats.recentMoves} moves
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{stats.recentMoves} optimizations in the last 24 hours</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Manual trigger button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={triggerOptimization}
              disabled={isRunning}
              className="h-8 px-2"
            >
              <Zap className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Run optimization now</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Last optimized time */}
      <span className="text-xs text-muted-foreground">
        Last: {formatLastOptimized(stats.lastOptimized)}
      </span>
    </div>
  );
}