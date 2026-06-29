import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisualEfficiencyIndicatorProps {
  efficiencyScore?: number;
  visualCapacityUsed?: boolean;
  seatLoss?: number;
  totalSeats?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const VisualEfficiencyIndicator: React.FC<VisualEfficiencyIndicatorProps> = ({
  efficiencyScore,
  visualCapacityUsed = false,
  seatLoss = 0,
  totalSeats,
  size = 'sm',
  showDetails = false
}) => {
  if (!visualCapacityUsed && !efficiencyScore) {
    return null;
  }

  const getEfficiencyColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getEfficiencyIcon = (score: number) => {
    if (score >= 85) return TrendingUp;
    if (score >= 70) return Minus;
    return TrendingDown;
  };

  const getBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 85) return 'secondary';
    if (score >= 70) return 'outline';
    return 'destructive';
  };

  if (!efficiencyScore) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "flex items-center gap-1",
          size === 'sm' && "text-xs h-5",
          size === 'md' && "text-sm h-6",
          size === 'lg' && "text-base h-7"
        )}
      >
        <Zap className={cn(
          size === 'sm' && "h-3 w-3",
          size === 'md' && "h-4 w-4", 
          size === 'lg' && "h-5 w-5"
        )} />
        Visual Assignment
      </Badge>
    );
  }

  const Icon = getEfficiencyIcon(efficiencyScore);
  const colorClass = getEfficiencyColor(efficiencyScore);
  const variant = getBadgeVariant(efficiencyScore);

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={variant}
        className={cn(
          "flex items-center gap-1",
          size === 'sm' && "text-xs h-5",
          size === 'md' && "text-sm h-6",
          size === 'lg' && "text-base h-7"
        )}
      >
        <Icon className={cn(
          colorClass,
          size === 'sm' && "h-3 w-3",
          size === 'md' && "h-4 w-4",
          size === 'lg' && "h-5 w-5"
        )} />
        {efficiencyScore.toFixed(1)}% efficiency
      </Badge>
      
      {showDetails && totalSeats && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{totalSeats} seats</span>
          {seatLoss > 0 && (
            <span className="text-orange-600 dark:text-orange-400">
              (-{seatLoss} lost)
            </span>
          )}
        </div>
      )}
    </div>
  );
};