
import React, { useEffect } from 'react';
import { PinLoginWrapper } from '@/components/auth/PinLoginWrapper';
import { useDeviceScreenChecker } from '@/hooks/useDeviceScreenChecker';
import { isDeviceBound } from '@/utils/deviceBinding';
import { useInstantData } from '@/hooks/useInstantData';
import { useUltraFastDataPrefetch } from '@/hooks/useUltraFastDataPrefetch';
import { resetAuthenticationState } from '@/utils/resetAuth';
import { ForcedPasswordChangeModal } from '@/components/auth/ForcedPasswordChangeModal';
import { useForcePasswordChange } from '@/hooks/useForcePasswordChange';

const Login: React.FC = () => {
  const { getInstantReservations, getInstantTables } = useInstantData();
  const { showModal, handlePasswordChanged } = useForcePasswordChange();
  
  // One-time storage clear check (removes itself after running)
  useEffect(() => {
    const needsStorageClear = sessionStorage.getItem('needsStorageClear');
    if (needsStorageClear === 'true') {
      sessionStorage.removeItem('needsStorageClear');
      resetAuthenticationState();
    }
  }, []);
  
  // Initialize device screen checker
  useDeviceScreenChecker();
  
  // Initialize ultra-fast data prefetch in background, only when device is bound
  useUltraFastDataPrefetch();

  useEffect(() => {
    document.title = 'PIN Login | Restaurant Access';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Enter your 4-digit PIN to access the restaurant system.');
  }, []);

  return (
    <div className="h-screen overflow-hidden">
      <PinLoginWrapper />
      <ForcedPasswordChangeModal 
        isOpen={showModal} 
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );
};

export default Login;
