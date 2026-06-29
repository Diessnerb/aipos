
import React from 'react';
import { Button } from '@/components/ui/button';

interface TimelineEmptyStateProps {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const TimelineEmptyState: React.FC<TimelineEmptyStateProps> = ({
  title,
  description,
  primaryAction,
  secondaryAction
}) => {
  return (
    <div className="w-full h-full bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-lg font-medium text-foreground">{title}</div>
        <div className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {secondaryAction && (
              <Button 
                onClick={secondaryAction.onClick} 
                variant="outline"
                size="sm"
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button 
                onClick={primaryAction.onClick} 
                variant="default"
                size="sm"
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
