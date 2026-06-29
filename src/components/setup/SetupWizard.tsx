import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { WelcomeStep } from './WelcomeStep';
import { ManualSetupWizard } from './ManualSetupWizard';
import { SetupCompleteStep } from './SetupCompleteStep';
import { useSetupWizard } from '@/hooks/useSetupWizard';

export type SetupStep = 'welcome' | 'manual-setup' | 'complete';

interface SetupWizardProps {
  open?: boolean;
  onComplete?: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ 
  open = true, 
  onComplete 
}) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const { completeSetup } = useSetupWizard();

  const handleSetupComplete = async () => {
    await completeSetup();
    setCurrentStep('complete');
  };

  const handleFinalComplete = () => {
    onComplete?.();
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeStep 
            onNext={() => setCurrentStep('manual-setup')} 
          />
        );
      
      case 'manual-setup':
        return (
          <ManualSetupWizard 
            onComplete={handleSetupComplete}
            onBack={() => setCurrentStep('welcome')}
          />
        );
      
      case 'complete':
        return (
          <SetupCompleteStep 
            setupPath="manual"
            onFinish={handleFinalComplete}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-0"
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Setup Wizard</DialogTitle>
        </VisuallyHidden.Root>
        <div className="flex flex-col min-h-0">
          {renderCurrentStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};