import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { TableSetupStep } from './manual/TableSetupStep';
import { MenuSetupStep } from './manual/MenuSetupStep';
import { TeamSetupStep } from './manual/TeamSetupStep';
import { FinalSetupStep } from './manual/FinalSetupStep';

interface ManualSetupWizardProps {
  onComplete: () => void;
  onBack: () => void;
}

type ManualStep = 'intro' | 'tables' | 'menu' | 'team' | 'final';

export const ManualSetupWizard: React.FC<ManualSetupWizardProps> = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState<ManualStep>('intro');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const steps = [
    { key: 'intro', title: 'Getting Started', description: 'Overview of manual setup' },
    { key: 'tables', title: 'Table Setup', description: 'Create your table layout' },
    { key: 'menu', title: 'Menu Items', description: 'Add your menu categories and items' },
    { key: 'team', title: 'Team Members', description: 'Set up staff accounts' },
    { key: 'final', title: 'Final Steps', description: 'Complete your setup' }
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(steps[nextIndex].key as ManualStep);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key as ManualStep);
    } else {
      onBack();
    }
  };

  const handleStepComplete = (stepKey: string) => {
    setCompletedSteps(prev => new Set([...prev, stepKey]));
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div className="space-y-6 text-center">
            <h3 className="text-xl font-semibold">Manual Setup Overview</h3>
            <p className="text-muted-foreground">
              We'll guide you through setting up your restaurant step by step. 
              Each step can be customized to fit your specific needs.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {steps.slice(1).map((step, index) => (
                <Card key={step.key} className="text-left">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> You can skip any step and come back to it later in your settings
            </p>
          </div>
        );
      
      case 'tables':
        return (
          <TableSetupStep 
            onComplete={() => handleStepComplete('tables')}
            isCompleted={completedSteps.has('tables')}
          />
        );
      
      case 'menu':
        return (
          <MenuSetupStep 
            onComplete={() => handleStepComplete('menu')}
            isCompleted={completedSteps.has('menu')}
          />
        );
      
      case 'team':
        return (
          <TeamSetupStep 
            onComplete={() => handleStepComplete('team')}
            isCompleted={completedSteps.has('team')}
          />
        );
      
      case 'final':
        return (
          <FinalSetupStep 
            onComplete={onComplete}
            completedSteps={completedSteps}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header with Progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handlePrevious} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="text-center">
            <h2 className="text-2xl font-bold">Manual Setup</h2>
            <p className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex]?.title}
            </p>
          </div>
          <div className="w-20" />
        </div>
        
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-1">
                {completedSteps.has(step.key) ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <div className={`h-3 w-3 rounded-full ${
                    index <= currentStepIndex ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      {currentStep !== 'final' && (
        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleNext}
            className="flex items-center gap-2"
          >
            {currentStep === 'intro' ? 'Start Setup' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};