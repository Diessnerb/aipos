import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { useSetupWizard } from '@/hooks/useSetupWizard';
import { ForcedPasswordChangeModal } from '@/components/auth/ForcedPasswordChangeModal';
import { useForcePasswordChange } from '@/hooks/useForcePasswordChange';

const SetupWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { needsSetup, isLoading } = useSetupWizard();
  const { showModal, handlePasswordChanged } = useForcePasswordChange();

  const handleComplete = () => {
    // Aller directement à la configuration de l'appareil après le setup
    navigate('/device-location-setup');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (!needsSetup) {
    navigate('/login');
    return null;
  }

  return (
    <>
      <SetupWizard onComplete={handleComplete} />
      <ForcedPasswordChangeModal 
        isOpen={showModal} 
        onPasswordChanged={handlePasswordChanged}
      />
    </>
  );
};

export default SetupWizardPage;