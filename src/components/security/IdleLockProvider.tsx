import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { setUILock } from '@/utils/secureStorage';
import { getDeviceLocation } from '@/utils/deviceBinding';

interface IdleLockContextType {
  resetIdleTimer: () => void;
}

const IdleLockContext = createContext<IdleLockContextType | undefined>(undefined);

export const useIdleLock = () => {
  const context = useContext(IdleLockContext);
  if (!context) {
    throw new Error('useIdleLock must be used within an IdleLockProvider');
  }
  return context;
};

interface IdleLockProviderProps {
  children: React.ReactNode;
}

export const IdleLockProvider: React.FC<IdleLockProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const { pinUser, signOutPin } = useAuth();
  const { settings } = useCompanySettings();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  // Check device location to determine timeout behavior
  const deviceLocation = getDeviceLocation();
  const isKitchenDevice = deviceLocation === 'kitchen';

  // Get idle timeout from settings - wait for settings to load, then use configured timeout
  // Convert seconds to milliseconds, default to 15 minutes (900 seconds) if not set
  // Clamp to minimum 60 seconds to prevent immediate logouts on mobile devices
  // Kitchen devices have no timeout (Infinity)
  const rawTimeoutSeconds = settings?.pin_idle_timeout_seconds || 900;
  const timeoutSeconds = isKitchenDevice ? Infinity : Math.max(60, rawTimeoutSeconds);
  const idleTimeoutMs = timeoutSeconds * 1000;
  
  console.log('🔧 IdleLock timeout configured:', {
    location: deviceLocation || 'unknown',
    timeoutSeconds: isKitchenDevice ? 'disabled (kitchen device)' : timeoutSeconds,
    minutes: isKitchenDevice ? 'N/A' : Math.round(timeoutSeconds / 60),
    isKitchen: isKitchenDevice
  });

  const resetIdleTimer = () => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only set timeout if there's a PIN user (device is in use) and not a kitchen device
    if (pinUser && !isKitchenDevice) {
      timeoutRef.current = setTimeout(() => {
        console.log('🔒 Idle timeout reached, locking UI...');
        // Set UI lock flag BEFORE clearing PIN user
        setUILock(true);
        // Clear PIN user and redirect to login (keep Supabase session)
        signOutPin();
        navigate('/login');
      }, idleTimeoutMs);
    }
  };

  // Activity tracking - only start when settings are loaded
  useEffect(() => {
    // Kitchen devices don't need timeout - exit early
    if (isKitchenDevice) {
      console.log('🍳 Kitchen device - screen timeout disabled (no activity listeners needed)');
      return;
    }

    // Don't start timer until settings are loaded (for non-kitchen devices)
    if (!settings) {
      console.log('🔧 IdleLock waiting for settings to load...');
      return;
    }

    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'touchmove', 'touchend', 'click', 'focus', 'resize'];
    
    const handleActivity = () => {
      resetIdleTimer();
    };

    // Add listeners
    activities.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize timer
    resetIdleTimer();

    return () => {
      // Clean up listeners
      activities.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pinUser, idleTimeoutMs, settings, isKitchenDevice]);

  // Reset timer when PIN user changes
  useEffect(() => {
    resetIdleTimer();
  }, [pinUser]);

  const contextValue = {
    resetIdleTimer
  };

  return (
    <IdleLockContext.Provider value={contextValue}>
      {children}
    </IdleLockContext.Provider>
  );
};
