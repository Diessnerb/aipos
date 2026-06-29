import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Zap, RefreshCw } from 'lucide-react';
import { useVisualEfficiencyAnalytics } from '@/hooks/useVisualEfficiencyAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Separator } from '@/components/ui/separator';

export const VisualEfficiencyDashboard: React.FC = () => {
  const { analytics, loading, error, refreshAnalytics } = useVisualEfficiencyAnalytics();

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return TrendingUp;
      case 'declining': return TrendingDown;
      default: return Minus;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600 dark:text-green-400';
      case 'declining': return 'text-red-600 dark:text-red-400';
      default: return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  const getEfficiencyColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visual Efficiency Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
          <span className="ml-2 text-muted-foreground">Loading efficiency analytics...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visual Efficiency Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            {error || 'No efficiency data available'}
          </p>
          <Button onClick={refreshAnalytics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = getTrendIcon(analytics.efficiencyTrend);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Efficiency</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${getEfficiencyColor(analytics.averageEfficiencyScore)}`}>
                    {analytics.averageEfficiencyScore.toFixed(1)}%
                  </p>
                  <TrendIcon className={`h-4 w-4 ${getTrendColor(analytics.efficiencyTrend)}`} />
                </div>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Visual Assignments</p>
                <p className="text-2xl font-bold">
                  {analytics.visualAssignmentsCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{analytics.totalAssignments}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline">
                  {((analytics.visualAssignmentsCount / analytics.totalAssignments) * 100).toFixed(0)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Efficiency Trend</p>
                <p className={`text-lg font-semibold capitalize ${getTrendColor(analytics.efficiencyTrend)}`}>
                  {analytics.efficiencyTrend}
                </p>
              </div>
              <TrendIcon className={`h-8 w-8 ${getTrendColor(analytics.efficiencyTrend)}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Group Recommendations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Table Group Efficiency Analysis</CardTitle>
            <CardDescription>
              Visual capacity recommendations for optimal seating arrangements
            </CardDescription>
          </div>
          <Button onClick={refreshAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {analytics.recommendations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No table groups configured yet.</p>
              <p className="text-sm mt-2">Create table groups to see efficiency recommendations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {analytics.recommendations.map((recommendation, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{recommendation.groupName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Tables: {recommendation.tableCombination.join(', ')}
                      </p>
                    </div>
                    <Badge 
                      variant={recommendation.efficiencyScore >= 85 ? 'secondary' : 
                               recommendation.efficiencyScore >= 70 ? 'outline' : 'destructive'}
                      className="flex items-center gap-1"
                    >
                      <TrendingUp className="h-3 w-3" />
                      {recommendation.efficiencyScore.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <Separator className="my-3" />
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Recommendations:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {recommendation.recommendations.map((rec, recIndex) => (
                        <li key={recIndex} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};