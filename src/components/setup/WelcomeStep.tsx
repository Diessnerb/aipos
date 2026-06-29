import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Zap, Star } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="p-8 text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Welcome to Your Restaurant Management System!</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Let's get you set up quickly so you can start managing your restaurant like a pro.
          This should only take a few minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card className="text-center">
          <CardHeader>
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900/20 rounded-lg mx-auto flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg">Quick Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Complete setup in under 5 minutes with our guided wizard
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg mx-auto flex items-center justify-center">
              <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-lg">Smart Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connect your existing POS system or set up manually
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg mx-auto flex items-center justify-center">
              <Star className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-lg">Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Built-in templates and recommendations from industry experts
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 max-w-2xl mx-auto">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          💡 <strong>Pro tip:</strong> You can always change these settings later in your dashboard. 
          This wizard just gets you started with the essentials.
        </p>
      </div>

      <Button 
        onClick={onNext} 
        size="lg"
        className="text-lg px-8 py-3"
      >
        Let's Get Started
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );
};