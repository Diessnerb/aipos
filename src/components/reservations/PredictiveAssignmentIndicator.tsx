import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { PredictiveAssignmentResult } from '@/services/predictiveAssignmentService';

interface PredictiveAssignmentIndicatorProps {
  result: PredictiveAssignmentResult | null;
  isActive?: boolean;
}

export function PredictiveAssignmentIndicator({ 
  result, 
  isActive = true 
}: PredictiveAssignmentIndicatorProps) {
  if (!result || !isActive) return null;

  const { insights, riskAssessment, alternativeOptions } = result;

  const getConfidenceColor = (confidence: number = 0) => {
    if (confidence >= 80) return 'bg-green-500/10 text-green-700 border-green-200';
    if (confidence >= 60) return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
    return 'bg-red-500/10 text-red-700 border-red-200';
  };

  const getRiskColor = (risk: string = '') => {
    if (risk.includes('Low risk')) return 'text-green-600';
    if (risk.includes('Moderate risk')) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Predictive Assignment</span>
          {insights && (
            <Badge 
              variant="outline" 
              className={getConfidenceColor(insights.confidence)}
            >
              {insights.confidence.toFixed(0)}% confidence
            </Badge>
          )}
        </div>

        {insights && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Expected volume</span>
              </div>
              <div className="font-medium text-foreground">
                {insights.expectedBookings.toFixed(1)} bookings
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Large party risk</span>
              </div>
              <div className="font-medium text-foreground">
                {(insights.largePartyProbability * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        {riskAssessment && (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Risk Assessment</span>
            </div>
            <div className={`text-xs font-medium ${getRiskColor(riskAssessment)}`}>
              {riskAssessment}
            </div>
          </div>
        )}

        {alternativeOptions && alternativeOptions.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {alternativeOptions.length} alternative option{alternativeOptions.length > 1 ? 's' : ''} available
            </div>
            <div className="flex flex-wrap gap-1">
              {alternativeOptions.slice(0, 3).map((option, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs bg-background"
                >
                  Tables {option.tableNumbers.join(',')} ({option.strategy})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}