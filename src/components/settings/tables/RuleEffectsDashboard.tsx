import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { AssignmentRule } from '@/types/table';

interface RuleStats {
  ruleId: string;
  ruleName: string;
  timesApplied: number;
  successRate: number;
  avgScore: number;
  lastUsed: string | null;
  affectedReservations: number;
}

interface RuleEffectsDashboardProps {
  rules: AssignmentRule[];
}

export function RuleEffectsDashboard({ rules }: RuleEffectsDashboardProps) {
  const { currentUser } = useCurrentUser();

  const { data: ruleStats, isLoading } = useQuery({
    queryKey: ['rule-effects', currentUser?.company_id],
    queryFn: async () => {
      if (!currentUser?.company_id) return [];

      // Get assignment history for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: history, error } = await supabase
        .from('assignment_history')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) {
        console.error('Error fetching assignment history:', error);
        return [];
      }

      // Calculate stats for each rule
      const stats: RuleStats[] = rules.map(rule => {
        const ruleHistory = history?.filter(h => h.rule_applied === rule.rule_name) || [];
        const successfulAssignments = ruleHistory.filter(h => h.success);
        
        return {
          ruleId: rule.id,
          ruleName: rule.rule_name,
          timesApplied: ruleHistory.length,
          successRate: ruleHistory.length > 0 ? (successfulAssignments.length / ruleHistory.length) * 100 : 0,
          avgScore: 0, // Would need to calculate from actual assignment scores
          lastUsed: ruleHistory.length > 0 
            ? ruleHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
            : null,
          affectedReservations: ruleHistory.length
        };
      });

      return stats;
    },
    enabled: !!currentUser?.company_id && rules.length > 0
  });

  const { data: overallStats } = useQuery({
    queryKey: ['overall-assignment-stats', currentUser?.company_id],
    queryFn: async () => {
      if (!currentUser?.company_id) return null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: history, error } = await supabase
        .from('assignment_history')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) return null;

      const totalAssignments = history?.length || 0;
      const successfulAssignments = history?.filter(h => h.success).length || 0;
      const rulesUsed = new Set(history?.map(h => h.rule_applied).filter(Boolean)).size;
      const conflictsDetected = history?.filter(h => h.conflict_detected).length || 0;

      return {
        totalAssignments,
        successRate: totalAssignments > 0 ? (successfulAssignments / totalAssignments) * 100 : 0,
        rulesUsed,
        conflictsDetected
      };
    },
    enabled: !!currentUser?.company_id
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading rule statistics...</div>;
  }

  if (!ruleStats || ruleStats.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Assignment Data Yet</h3>
          <p className="text-muted-foreground">
            Start making reservations to see how your rules are performing
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatLastUsed = (dateStr: string | null) => {
    if (!dateStr) return 'Never used';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      {overallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{overallStats.totalAssignments}</p>
                  <p className="text-xs text-muted-foreground">Total Assignments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{overallStats.successRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{overallStats.rulesUsed}</p>
                  <p className="text-xs text-muted-foreground">Active Rules</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{overallStats.conflictsDetected}</p>
                  <p className="text-xs text-muted-foreground">Conflicts Found</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Individual Rule Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rule Performance (Last 30 Days)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            See how often each rule is being used and how well it's working
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ruleStats.map((stat) => (
            <div key={stat.ruleId} className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">{stat.ruleName}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant={stat.timesApplied > 0 ? 'default' : 'secondary'}>
                    {stat.timesApplied > 0 ? 'Active' : 'Unused'}
                  </Badge>
                  {stat.successRate > 80 && stat.timesApplied > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      High Performance
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Times Used</p>
                  <p className="text-lg font-semibold">{stat.timesApplied}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-lg font-semibold">
                    {stat.timesApplied > 0 ? `${stat.successRate.toFixed(0)}%` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Used</p>
                  <p className="text-sm">{formatLastUsed(stat.lastUsed)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Impact</p>
                  <p className="text-sm">
                    {stat.affectedReservations > 0 
                      ? `${stat.affectedReservations} reservations`
                      : 'No impact yet'
                    }
                  </p>
                </div>
              </div>
              
              {/* Success Rate Progress Bar */}
              {stat.timesApplied > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Success Rate</span>
                    <span>{stat.successRate.toFixed(0)}%</span>
                  </div>
                  <Progress value={stat.successRate} className="h-2" />
                </div>
              )}
              
              {/* Recommendations */}
              {stat.timesApplied === 0 && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-sm text-muted-foreground">
                  💡 This rule hasn't been used yet. Consider adjusting its conditions or priority.
                </div>
              )}
              
              {stat.timesApplied > 0 && stat.successRate < 50 && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                  ⚠️ Low success rate. This rule might be too restrictive or conflicting with others.
                </div>
              )}
              
              {stat.timesApplied > 10 && stat.successRate > 90 && (
                <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                  ✅ Excellent performance! This rule is working very well.
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}