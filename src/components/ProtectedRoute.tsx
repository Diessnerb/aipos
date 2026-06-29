
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { TypewriterLoading } from '@/components/ui/typewriter-loading';
import { getBoundCompany, isDeviceBound, isDeviceLocationConfigured } from '@/utils/deviceBinding';
import { isUILocked, SecureStorage } from '@/utils/secureStorage';
import { useSetupWizard } from '@/hooks/useSetupWizard';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { needsSetup, isLoading: setupLoading } = useSetupWizard();
  
  let authContext;
  
  try {
    authContext = useAuth();
  } catch (error) {
    console.error('AuthProvider not available:', error);
    return <Navigate to="/owner-login" replace />;
  }
  
  const { user, pinUser, loading } = authContext;

  // Check device binding status for instant navigation
  const deviceIsBound = isDeviceBound();
  const uiIsLocked = isUILocked();
  const boundCompany = getBoundCompany();
  
  // For bound devices with data ready, skip all loading states for instant navigation
  const shouldSkipLoading = deviceIsBound && !uiIsLocked && boundCompany;
  
  // Only show loading for non-bound devices or during actual auth/setup operations
  if ((loading || setupLoading) && !shouldSkipLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <TypewriterLoading />
      </div>
    );
  }

  // If device is not bound, redirect to owner login
  if (!boundCompany) {
    console.log('🔒 Redirecting to owner-login: Device not bound to company');
    return <Navigate to="/owner-login" replace />;
  }

  // Check if setup wizard is needed (for new owners)
  if (needsSetup) {
    console.log('🔒 Redirecting to setup-wizard: Setup not completed');
    return <Navigate to="/setup-wizard" replace />;
  }

  // Check if device location is configured (required for PIN users)
  if (!isDeviceLocationConfigured() && pinUser) {
    console.log('🔒 Redirecting to device-location-setup: location not configured');
    return <Navigate to="/device-location-setup" replace />;
  }
  
  // Check if UI is locked (idle timeout or manual logout)
  if (isUILocked()) {
    console.log('🔒 Redirecting to login: UI is locked (idle timeout or manual logout)');
    return <Navigate to="/login" replace />;
  }
  
  // Enhanced fail-safe: if no PIN user but there's stored PIN data and UI isn't locked,
  // trigger sync event but don't show loading for bound devices (instant navigation)
  const hasStoredPinData = !!SecureStorage.getItem('pinUser');
  if (!pinUser && hasStoredPinData && !isUILocked()) {
    // Trigger a PIN user change event to force sync
    window.dispatchEvent(new CustomEvent('pinUserChanged'));
    
    // For bound devices, continue rendering to avoid flash
    if (!shouldSkipLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <TypewriterLoading text="Synchronizing..." />
        </div>
      );
    }
  }
  
  // If device is bound but no PIN user, require PIN login (keep Supabase session)
  if (!pinUser) {
    console.log('🔒 Redirecting to login: No PIN user authenticated');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
