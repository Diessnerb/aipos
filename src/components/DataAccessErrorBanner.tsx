import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { getLastSecureStorageError } from '@/utils/secureStorage';
import { clearPinUser } from '@/utils/pinAuth';
import { isDeviceBound } from '@/utils/deviceBinding';

export const DataAccessErrorBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { pinUser, companyId, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for secure storage decrypt failures
    const handleDecryptFailed = (event: CustomEvent) => {
      console.error('🔐 SecureStorage decrypt failed:', event.detail);
      setErrorMessage('We couldn\'t load your data. Please refresh or log in again.');
      setShowBanner(true);
    };

    window.addEventListener('secureStorageDecryptFailed', handleDecryptFailed as EventListener);

    return () => {
      window.removeEventListener('secureStorageDecryptFailed', handleDecryptFailed as EventListener);
    };
  }, []);

  useEffect(() => {
    // Check for data access issues after auth is loaded
    if (loading) return;

    const lastError = getLastSecureStorageError();
    
    // Show banner if we have secure storage errors
    if (lastError) {
      setErrorMessage('We couldn\'t load your data. Please refresh or log in again.');
      setShowBanner(true);
      return;
    }

    // Show banner if we're in PIN mode but no company ID (data access broken)
    if (pinUser && !companyId) {
      setErrorMessage('We couldn\'t load your data. Please refresh or log in again.');
      setShowBanner(true);
      return;
    }

    // Hide banner if everything looks good
    if (companyId && (pinUser || !isDeviceBound())) {
      setShowBanner(false);
    }
  }, [loading, pinUser, companyId]);

  const handleReauth = () => {
    // Clear corrupted PIN data
    clearPinUser();
    
    // Navigate to appropriate login page
    if (isDeviceBound()) {
      navigate('/login'); // PIN login
    } else {
      navigate('/owner-login'); // Owner login
    }
    
    setShowBanner(false);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!showBanner) return null;

  return (
    <Alert variant="destructive" className="m-4 border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          {errorMessage}
        </div>
        <div className="flex gap-2 ml-4">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="h-8"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleReauth}
            className="h-8"
          >
            <LogIn className="h-3 w-3 mr-1" />
            Re-login
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};