import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, BarChart3, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { usePredictiveAssignment } from '@/hooks/usePredictiveAssignment';
import { PredictiveAssignmentIndicator } from './PredictiveAssignmentIndicator';
import { format } from 'date-fns';

interface PredictiveTimelineOptimizerProps {
  date: string;
  companyId: string;
  onOptimizationComplete?: (result: any) => void;
}

export function PredictiveTimelineOptimizer({ 
  date, 
  companyId, 
  onOptimizationComplete 
}: PredictiveTimelineOptimizerProps) {
  const { optimizeDay, isOptimizing, lastResult } = usePredictiveAssignment();
  const [optimizationResults, setOptimizationResults] = useState<any>(null);

  const handleOptimizeDay = async () => {
    const result = await optimizeDay(date);
    if (result) {
      setOptimizationResults(result);
      onOptimizationComplete?.(result);
    }
  };

  const getOptimizationBadge = () => {
    if (!optimizationResults) return null;
    
    if (optimizationResults.movesSuggested === 0) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Optimised</Badge>;
    }
    
    return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
      {optimizationResults.movesSuggested} suggestions
    </Badge>;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Timeline Optimiser</CardTitle>
            {getOptimizationBadge()}
          </div>
          <Button
            onClick={handleOptimizeDay}
            disabled={isOptimizing}
            variant="outline"
            size="sm"
            className="bg-primary/5 border-primary/20 hover:bg-primary/10"
          >
            {isOptimizing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Optimise Day
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Analysing reservations for {format(new Date(date), 'MMMM d, yyyy')} using predictive intelligence
        </div>

        {lastResult && (
          <PredictiveAssignmentIndicator 
            result={lastResult} 
            isActive={true}
          />
        )}

        {optimizationResults && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-foreground">
                  {optimizationResults.movesSuggested}
                </div>
                <div className="text-xs text-muted-foreground">Moves Suggested</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-foreground">
                  {optimizationResults.movesExecuted}
                </div>
                <div className="text-xs text-muted-foreground">Auto-Applied</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div className="text-sm font-medium text-green-600">Improved</div>
                </div>
                <div className="text-xs text-muted-foreground">Efficiency</div>
              </div>
            </div>

            {optimizationResults.details && optimizationResults.details.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Optimisation Details:</div>
                <div className="space-y-1">
                  {optimizationResults.details.slice(0, 3).map((detail: string, index: number) => (
                    <div key={index} className="text-xs text-muted-foreground p-2 bg-muted/50 rounded border">
                      {detail}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Reservations within 30 minutes are protected from automatic moves</span>
        </div>
      </CardContent>
    </Card>
  );
}