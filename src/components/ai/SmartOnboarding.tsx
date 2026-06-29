import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { AlishaOrb } from './AlishaOrb';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export const SmartOnboarding: React.FC = () => {
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'profile',
      title: 'Complete your profile',
      description: 'Add your name, photo, and contact details',
      completed: false,
    },
    {
      id: 'tour',
      title: 'Take a quick tour',
      description: 'Learn about key features and where to find things',
      completed: false,
    },
    {
      id: 'first-action',
      title: 'Try your first action',
      description: 'Book a reservation or add a customer',
      completed: false,
    },
    {
      id: 'team',
      title: 'Meet your team',
      description: 'See who else is using the system',
      completed: false,
    },
  ]);

  const completedSteps = steps.filter(s => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  const toggleStep = (id: string) => {
    setSteps(prev =>
      prev.map(step =>
        step.id === id ? { ...step, completed: !step.completed } : step
      )
    );
  };

  return (
    <>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Welcome! Let's get you started</CardTitle>
          </div>
          <CardDescription>
            Your AI assistant is here to guide you through setup. Click the chat icon to ask questions anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completedSteps} of {steps.length} completed</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleStep(step.id)}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium ${step.completed ? 'text-muted-foreground line-through' : ''}`}>
                    {step.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {completedSteps === steps.length ? (
            <div className="text-center space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                🎉 Great job! You're all set up. Your AI assistant is always available if you need help.
              </p>
              <Button>Go to Dashboard</Button>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground pt-4">
              Need help? Click the chat icon in the bottom right to ask your AI assistant anything!
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Assistant is always available */}
      <AlishaOrb />
    </>
  );
};
