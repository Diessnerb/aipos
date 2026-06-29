import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface SetupCompleteStepProps {
  setupPath: 'pos' | 'manual' | null;
  onFinish: () => void;
}

export const SetupCompleteStep: React.FC<SetupCompleteStepProps> = ({ 
  setupPath, 
  onFinish 
}) => {
  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="p-8 text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-24 w-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
          <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Setup Complete! 🎉</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your restaurant management system is ready to use. You'll be redirected to your dashboard in a moment.
        </p>
      </div>
      
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 max-w-md mx-auto">
        <p className="text-sm text-green-800 dark:text-green-200">
          🚀 You can access advanced settings and additional features from your dashboard at any time.
        </p>
      </div>

      <Button onClick={onFinish} size="lg">
        Go to Dashboard
      </Button>
    </div>
  );
};