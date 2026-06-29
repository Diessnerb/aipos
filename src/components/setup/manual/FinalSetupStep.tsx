import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Circle, ArrowRight, Settings, Users, ChefHat } from 'lucide-react';

interface FinalSetupStepProps {
  onComplete: () => void;
  completedSteps: Set<string>;
}

export const FinalSetupStep: React.FC<FinalSetupStepProps> = ({ onComplete, completedSteps }) => {
  const steps = [
    {
      key: 'tables',
      title: 'Table Setup',
      description: 'Created table layout and seating arrangements',
      icon: Settings
    },
    {
      key: 'menu',
      title: 'Menu Items',
      description: 'Added menu categories and items',
      icon: ChefHat
    },
    {
      key: 'team',
      title: 'Team Members',
      description: 'Set up staff accounts and permissions',
      icon: Users
    }
  ];

  const completedCount = steps.filter(step => completedSteps.has(step.key)).length;
  const allCompleted = completedCount === steps.length;

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Setup Summary</h3>
        <p className="text-muted-foreground">
          Review what you've completed and finish your setup
        </p>
      </div>

      {/* Progress Overview */}
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Setup Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="text-3xl font-bold text-primary">
                {completedCount}/{steps.length}
              </div>
              <div className="ml-2 text-sm text-muted-foreground">
                steps completed
              </div>
            </div>
            
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps Status */}
      <div className="space-y-3 max-w-2xl mx-auto">
        {steps.map((step) => {
          const isCompleted = completedSteps.has(step.key);
          const Icon = step.icon;
          
          return (
            <Card key={step.key} className={`${isCompleted ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : ''}`}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-shrink-0">
                  <Icon className={`h-5 w-5 ${isCompleted ? 'text-green-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-medium ${isCompleted ? 'text-green-800 dark:text-green-200' : 'text-muted-foreground'}`}>
                    {step.title}
                  </div>
                  <div className={`text-sm ${isCompleted ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
                    {step.description}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completion Message */}
      {allCompleted ? (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 max-w-md mx-auto">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div className="text-left">
                <p className="font-medium text-green-800 dark:text-green-200">
                  Great job! All setup steps completed.
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your restaurant is ready to start taking reservations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 max-w-md mx-auto">
          <CardContent className="pt-4">
            <div className="text-left">
              <p className="font-medium text-blue-800 dark:text-blue-200">
                You can still use your system!
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Complete the remaining steps anytime in Settings to unlock full functionality.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      <div className="space-y-4">
        <h4 className="font-medium">What happens next?</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <Card className="text-center p-4">
            <CardContent className="space-y-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-primary font-medium">1</span>
              </div>
              <h5 className="font-medium">Start Taking Reservations</h5>
              <p className="text-xs text-muted-foreground">
                Your system is ready to manage bookings and walk-ins
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-4">
            <CardContent className="space-y-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-primary font-medium">2</span>
              </div>
              <h5 className="font-medium">Train Your Team</h5>
              <p className="text-xs text-muted-foreground">
                Show staff how to use their PIN codes and features
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-4">
            <CardContent className="space-y-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-primary font-medium">3</span>
              </div>
              <h5 className="font-medium">Explore Features</h5>
              <p className="text-xs text-muted-foreground">
                Discover analytics, settings, and advanced options
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Complete Button */}
      <Button 
        onClick={onComplete}
        size="lg"
        className="px-8 flex items-center gap-2"
      >
        Complete Setup & Start Using System
        <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="text-sm text-muted-foreground">
        You can always return to Settings to modify your setup or add more features
      </p>
    </div>
  );
};