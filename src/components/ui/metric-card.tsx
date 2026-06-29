import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  clickText?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
  disabled?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  clickText,
  icon,
  onClick,
  isLoading = false,
  isRefreshing = false,
  disabled = false,
  className
}) => {
  return (
    <Card 
      className={cn(
        "transition-all duration-300 ease-in-out",
        onClick && !disabled && "cursor-pointer hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]",
        disabled && "opacity-50 pointer-events-none",
        isRefreshing && "bg-muted/30",
        className
      )}
      onClick={onClick && !disabled ? onClick : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn(
          "transition-colors duration-200",
          isRefreshing && "text-primary animate-pulse"
        )}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold transition-all duration-500 ease-in-out",
          isLoading && "animate-pulse text-muted-foreground",
          isRefreshing && "text-primary/80"
        )}>
          {isLoading ? '...' : value}
        </div>
        <p className="text-xs text-muted-foreground transition-opacity duration-300">
          {description}
        </p>
        {clickText && (
          <p className="text-xs text-blue-600 mt-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {clickText}
          </p>
        )}
      </CardContent>
    </Card>
  );
};