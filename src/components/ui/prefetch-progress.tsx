import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface PrefetchProgressProps {
  total: number;
  completed: number;
  currentTask: string;
  isComplete: boolean;
  errors: string[];
}

export const PrefetchProgress: React.FC<PrefetchProgressProps> = ({
  total,
  completed,
  currentTask,
  isComplete,
  errors
}) => {
  const progressPercentage = total > 0 ? (completed / total) * 100 : 0;
  const hasErrors = errors.length > 0;

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          {isComplete ? (
            hasErrors ? (
              <AlertCircle className="w-6 h-6 text-amber-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )
          ) : (
            <Clock className="w-6 h-6 text-primary animate-pulse" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {isComplete ? 'Setup Complete!' : 'Preparing Restaurant Workspace'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isComplete 
            ? hasErrors 
              ? 'Setup completed with some warnings' 
              : 'Verifying device binding and data access...'
            : currentTask || 'Initializing...'
          }
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="text-foreground font-medium">
            {completed}/{total}
          </span>
        </div>
        <Progress 
          value={progressPercentage} 
          className="h-2"
        />
        <div className="text-xs text-muted-foreground text-center">
          {Math.round(progressPercentage)}% complete
        </div>
      </div>

      {hasErrors && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium mb-1">
            Non-critical warnings:
          </p>
          <ul className="text-xs text-destructive/80 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {isComplete && !hasErrors && (
        <div className="text-center text-sm text-green-600 bg-green-50 dark:bg-green-950/20 p-3 rounded-md">
          Restaurant workspace is ready! All data has been preloaded for instant access.
        </div>
      )}
    </div>
  );
};