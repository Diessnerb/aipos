import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, Clock, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { format } from 'date-fns';
import { getRawPin } from '@/utils/pinAuth';

interface AIStats {
  totalMoves: number;
  successRate: number;
  lastOptimized: string | null;
  dailyMoves: number;
  weeklyMoves: number;
  topStrategies: Array<{ strategy: string; count: number }>;
}

interface AIInsightsDashboardProps {
  className?: string;
  onOpenDetails?: () => void;
}

export const AIInsightsDashboard: React.FC<AIInsightsDashboardProps> = ({ 
  className = '', 
  onOpenDetails 
}) => {
  const { companyId } = useAuth();
  const [stats, setStats] = useState<AIStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      loadAIStats();
    }
  }, [companyId]);

  const loadAIStats = async () => {
    if (!companyId) return;

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get assignment history
      const { data: assignmentHistory } = await supabase
        .from('assignment_history')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Get optimization log
      const { data: optimizationLog } = await supabase
        .from('optimization_log')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Get company settings for last optimization
      const settingsResponse = await supabase.functions.invoke('company-settings-get', {
        body: {
          pin: getRawPin(),
          companyId: companyId,
          isAuthenticatedAdmin: true
        }
      });

      const companySettings = settingsResponse.data?.success ? settingsResponse.data.data : null;

      const allMoves = [...(assignmentHistory || []), ...(optimizationLog || [])];
      const todayMoves = allMoves.filter(move => 
        new Date(move.created_at) >= today
      );

      const strategies = allMoves.reduce((acc, move) => {
        const strategy = 'assignment_strategy' in move 
          ? move.assignment_strategy 
          : 'optimization_type' in move 
            ? move.optimization_type 
            : 'Unknown';
        acc[strategy] = (acc[strategy] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topStrategies = Object.entries(strategies)
        .map(([strategy, count]) => ({ strategy, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const successCount = allMoves.filter(move => 
        'success' in move ? move.success !== false : true
      ).length;
      const successRate = allMoves.length > 0 ? (successCount / allMoves.length) * 100 : 0;

      setStats({
        totalMoves: allMoves.length,
        successRate: Math.round(successRate),
        lastOptimized: companySettings?.last_optimized_at || null,
        dailyMoves: todayMoves.length,
        weeklyMoves: allMoves.length,
        topStrategies
      });
    } catch (error) {
      console.error('Error loading AI stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            AI insights will appear here once the system starts learning from your reservations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (stats.successRate >= 90) return 'bg-green-500';
    if (stats.successRate >= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (stats.successRate >= 90) return 'Excellent';
    if (stats.successRate >= 75) return 'Good';
    return 'Needs Attention';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
            <Badge variant="secondary" className="text-xs">
              {getStatusText()}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Optimising table assignments automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{stats.successRate}%</div>
              <div className="text-muted-foreground text-xs">Success Rate</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{stats.dailyMoves}</div>
              <div className="text-muted-foreground text-xs">Today's Moves</div>
            </div>
          </div>
        </div>

        {stats.lastOptimized && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground text-xs">Last optimised</div>
              <div className="font-medium">
                {format(new Date(stats.lastOptimized), 'MMM d, HH:mm')}
              </div>
            </div>
          </div>
        )}

        {stats.topStrategies.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">Top Strategies</div>
            <div className="space-y-1">
              {stats.topStrategies.map((strategy, index) => (
                <div key={strategy.strategy} className="flex items-center justify-between text-xs">
                  <span className="truncate">{strategy.strategy.replace(/_/g, ' ')}</span>
                  <Badge variant="outline" className="text-xs">
                    {strategy.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {onOpenDetails && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenDetails}
            className="w-full mt-4"
          >
            View Details
          </Button>
        )}
      </CardContent>
    </Card>
  );
};