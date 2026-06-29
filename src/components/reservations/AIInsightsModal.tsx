import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, Activity, Clock, Target, Settings, TrendingUp, Loader2 } from 'lucide-react';
import { useTimelineOptimization } from '@/hooks/useTimelineOptimization';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface AIInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onOptimizationTrigger: () => void;
  isOptimizationRunning: boolean;
}

interface OptimizationLog {
  id: string;
  company_id: string;
  reservation_id: string;
  optimization_type: string;
  reason: string;
  old_table_number: number | null;
  new_table_number: number | null;
  gap_reduction_score: number | null;
  created_at: string;
  customer_name?: string; // We'll join this data
}

export const AIInsightsModal: React.FC<AIInsightsModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onOptimizationTrigger,
  isOptimizationRunning
}) => {
  const [recentMoves, setRecentMoves] = useState<OptimizationLog[]>([]);
  const [stats, setStats] = useState({ totalMoves: 0, successRate: 0 });
  const [loading, setLoading] = useState(true);
  
  const { currentUser: user } = useCurrentUser();
  const { settings: companySettings } = useCompanySettings();
  const { isEnabled } = useTimelineOptimization();

  useEffect(() => {
    if (isOpen && user?.company_id) {
      loadOptimizationData();
    }
  }, [isOpen, user?.company_id]); // Only refresh when modal opens or user changes

  // Separate effect to refresh data after manual optimization completes
  useEffect(() => {
    if (!isOptimizationRunning && user?.company_id && isOpen) {
      // Small delay to ensure the optimization log is written
      const timer = setTimeout(() => {
        loadOptimizationData();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isOptimizationRunning, user?.company_id, isOpen]);

  const loadOptimizationData = async () => {
    if (!user?.company_id) return;
    
    setLoading(true);
    try {
      // Get recent optimization moves with customer names
      const { data: moves, error: movesError } = await supabase
        .from('optimization_log')
        .select(`
          *,
          reservations(customer_name)
        `)
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (movesError) throw movesError;

      // Get optimization stats for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: statsData, error: statsError } = await supabase
        .from('optimization_log')
        .select('id')
        .eq('company_id', user.company_id)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (statsError) throw statsError;

      // Transform moves to include customer names
      const transformedMoves = moves?.map(move => ({
        ...move,
        customer_name: (move as any).reservations?.customer_name
      })) || [];

      setRecentMoves(transformedMoves);
      
      // All optimization log entries are successful (they only get logged on success)
      const totalMoves = statsData?.length || 0;
      setStats({
        totalMoves,
        successRate: totalMoves > 0 ? 100 : 0 // All logged moves are successful
      });
    } catch (error) {
      console.error('Error loading optimization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOptimizationStatus = () => {
    if (isOptimizationRunning) {
      return { status: 'Running', color: 'bg-blue-500', icon: Loader2 };
    }
    if (isEnabled) {
      return { status: 'Active', color: 'bg-green-500', icon: Brain };
    }
    return { status: 'Disabled', color: 'bg-gray-500', icon: Brain };
  };

  const { status, color, icon: StatusIcon } = getOptimizationStatus();
  const lastOptimized = companySettings?.last_optimized_at;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Timeline Optimisation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="font-medium">{status}</span>
                  {isOptimizationRunning && (
                    <StatusIcon className="h-4 w-4 animate-spin" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {lastOptimized && (
                    <>Last run: {formatDistanceToNow(parseISO(lastOptimized), { addSuffix: true })}</>
                  )}
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{stats.totalMoves}</div>
                  <div className="text-sm text-muted-foreground">Moves (7 days)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.successRate}%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">5m</div>
                  <div className="text-sm text-muted-foreground">Check Interval</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manual Optimization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Manual Optimisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Trigger an immediate optimisation check for {selectedDate}
                  </p>
                </div>
                <Button 
                  onClick={onOptimizationTrigger}
                  disabled={isOptimizationRunning || !isEnabled}
                  className="min-w-32"
                >
                  {isOptimizationRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Optimising...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Optimise Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Moves */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recent AI Moves
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : recentMoves.length > 0 ? (
                <div className="space-y-3">
                  {recentMoves.slice(0, 5).map((move) => (
                    <div key={move.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium">
                          {move.customer_name && `${move.customer_name}: `}
                          Table {move.old_table_number} → Table {move.new_table_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {move.reason}
                          {move.gap_reduction_score && ` • Score: ${move.gap_reduction_score.toFixed(1)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">
                          Success
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(parseISO(move.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {recentMoves.length > 5 && (
                    <div className="text-center text-sm text-muted-foreground">
                      And {recentMoves.length - 5} more moves...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent optimisation moves found
                </div>
              )}
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                How AI Optimisation Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">1</Badge>
                <div>
                  <p className="font-medium">Continuous Monitoring</p>
                  <p className="text-sm text-muted-foreground">
                    AI checks table assignments every 5 minutes for optimisation opportunities
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">2</Badge>
                <div>
                  <p className="font-medium">Smart Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    Considers accessibility needs, party size matching, and timeline gaps
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">3</Badge>
                <div>
                  <p className="font-medium">Safe Execution</p>
                  <p className="text-sm text-muted-foreground">
                    Only moves reservations 30+ minutes away to avoid disrupting current service
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};