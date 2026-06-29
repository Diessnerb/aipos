
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PinPad } from './PinPad';
import { useToast } from '@/hooks/use-toast';
import { setPinUser } from '@/utils/pinAuth';
import { isDeviceBound, getBoundCompany, isDeviceLocationConfigured, getDeviceLocation, setBoundCompany } from '@/utils/deviceBinding';
import { isUILocked } from '@/utils/secureStorage';
import { useAuth } from '@/components/AuthProvider';
import { stopPreAuthManager, seedPreAuthData } from '@/device/PreAuthBackgroundManager';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { unmaskReservation } from '@/utils/dataSanitizer';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

// Helper function to get default page based on device location
const getDefaultPageForLocation = (): string => {
  const location = getDeviceLocation();
  
  const defaultPages = {
    bar: '/pos',
    floor: '/reservations?view=timeline',
    kitchen: '/kitchen'
  };
  
  return defaultPages[location || 'floor'] || '/reservations?view=timeline'; // Fallback to floor
};

export const PinLoginWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pinUser } = useAuth();
  const queryClient = useQueryClient();
  const dataFetchTriggered = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    console.log('🔄 PinLoginWrapper - checking redirect conditions:', { 
      isDeviceBound: isDeviceBound(), 
      pinUser: !!pinUser, 
      isUILocked: isUILocked() 
    });
    
    if (!isDeviceBound()) {
      navigate('/owner-login');
      return;
    }
    
    // Only redirect if PIN user exists AND UI is not locked
    if (pinUser && !isUILocked()) {
      // Check if device location is configured
      if (!isDeviceLocationConfigured()) {
        console.info('🔄 No device location configured, redirecting to setup');
        navigate('/device-location-setup');
        return;
      }
      
      console.info('🔄 Already logged in with PIN and UI unlocked, redirecting to default page');
      const defaultPage = getDefaultPageForLocation();
      navigate(defaultPage);
    }
  }, [navigate, pinUser]);

  // Listen for UI lock changes to handle immediate redirects
  useEffect(() => {
    const handleUILockChange = () => {
      console.log('🔐 UI lock state changed in PinLoginWrapper');
      
      // If UI gets unlocked and we have a PIN user, redirect immediately
      if (!isUILocked() && pinUser) {
        if (!isDeviceLocationConfigured()) {
          navigate('/device-location-setup');
          return;
        }
        
        console.info('🔄 UI unlocked with existing PIN user, redirecting to default page');
        const defaultPage = getDefaultPageForLocation();
        navigate(defaultPage);
      }
    };

    window.addEventListener('uiLockChanged', handleUILockChange);
    return () => window.removeEventListener('uiLockChanged', handleUILockChange);
  }, [navigate, pinUser]);

  // Trigger data fetch when first PIN digit is entered
  const handleFirstDigit = async () => {
    if (dataFetchTriggered.current) return;
    dataFetchTriggered.current = true;

    const boundCompany = getBoundCompany();
    if (!boundCompany) {
      console.error('❌ Cannot fetch data - no bound company');
      return;
    }

    console.log('🎯 First digit entered - fetching data immediately');
    
    try {
      // Use seedPreAuthData for one-time data loading
      await seedPreAuthData(queryClient);
      
      console.log('✅ Data pre-fetched successfully');
    } catch (error) {
      console.error('❌ Error pre-fetching data:', error);
    }
  };

  const handlePinSuccess = async (userData: any) => {
    console.info('🎉 PIN login success for user:', userData.user_id);
    
    // Stop pre-auth manager immediately
    stopPreAuthManager();
    
    // Layout is already locked from first digit - keep it locked during unmask
    console.log('🔒 Layout remains locked during data unmask');
    
    // Patch company_id from bound device if missing (for owner PINs)
    const boundCompany = getBoundCompany();
    if (!userData.company_id && boundCompany?.company_id) {
      console.log('🔧 Patching userData company_id from bound device');
      userData.company_id = boundCompany.company_id;
    }
    
    // Store user data - this dispatches pinUserChanged event
    setPinUser(userData);
    
    // Wait for AuthProvider to confirm context is ready before navigating
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Context sync timeout, proceeding anyway');
        resolve();
      }, 1000); // 1 second max wait
      
      const handleContextReady = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail.userId === userData.user_id) {
          console.log('✅ Context ready, proceeding with navigation');
          clearTimeout(timeout);
          window.removeEventListener('pinUserContextReady', handleContextReady);
          resolve();
        }
      };
      
      window.addEventListener('pinUserContextReady', handleContextReady);
    });
    
    // Show success toast
    toast({
      title: "Login successful",
      description: `Welcome, ${userData.full_name}!`,
    });
    
    // Navigate immediately - don't wait for data unmask
    const defaultPage = getDefaultPageForLocation();
    navigate(defaultPage, { replace: true });
    
    // Fetch full (unmasked) reservation data in background (non-blocking)
    setTimeout(async () => {
      const boundCompany = getBoundCompany();
      if (boundCompany) {
        const today = new Date();
      const dates = [
        format(subDays(today, 1), 'yyyy-MM-dd'),
        format(today, 'yyyy-MM-dd'),
        format(addDays(today, 1), 'yyyy-MM-dd'),
      ];

      try {
        const { data: fullReservations } = await supabase
          .from('reservations')
          .select('*')
          .eq('company_id', boundCompany.company_id)
          .in('date', dates);

        // Batch unmask and cache updates for instant transition
        if (fullReservations) {
          const today_str = format(today, 'yyyy-MM-dd');
          const updates: Array<[readonly string[], any]> = [];
          
          dates.forEach(date => {
            const dateKey = ['reservations-date', boundCompany.company_id, date] as const;
            const legacyKey = ['reservations', boundCompany.company_id, date] as const;

            const cached = (queryClient.getQueryData(dateKey) as any) 
              || (queryClient.getQueryData(legacyKey) as any);

            const dateFullData = fullReservations.filter(r => r.date === date);
            const baseData = cached?.reservations ?? dateFullData;

            const unmaskedData = baseData.map((sanitized: any) => {
              const full = dateFullData.find((f: any) => f.id === sanitized.id);
              return full ? unmaskReservation(sanitized, full as any) : sanitized;
            });

            const payload = {
              date,
              reservations: unmaskedData,
              lastUpdated: Date.now(),
              isToday: date === today_str,
              preAuthMode: false,
            };

            // Collect updates for batch processing
            updates.push([legacyKey, payload]);
            updates.push([dateKey, payload]);
          });
          
          // Batch all cache updates together for instant transition
          updates.forEach(([key, payload]) => {
            queryClient.setQueryData(key, payload);
          });
        }
      } catch (error) {
        console.error('❌ Failed to unmask reservations:', error);
      }
      }
    }, 0); // End of setTimeout - data unmask happens in background
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Refreshing bound company context...');
      
      const boundCompany = getBoundCompany();
      if (!boundCompany) {
        toast({
          title: "Device not bound",
          description: "Please bind device through owner login",
          variant: "destructive"
        });
        navigate('/owner-login');
        return;
      }

      // Re-save bound company to ensure latest format
      setBoundCompany(boundCompany);
      
      toast({
        title: "Refreshing...",
        description: "Reloading company context",
      });

      // Hard reload to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('❌ Error refreshing:', error);
      toast({
        title: "Refresh failed",
        description: "Please try owner login if issue persists",
        variant: "destructive"
      });
      setIsRefreshing(false);
    }
  };

  return (
    <div className="relative h-full">
      <PinPad 
        onSuccess={handlePinSuccess}
        onFirstDigit={handleFirstDigit}
      />
      
      {/* Unobtrusive refresh button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="absolute bottom-3 right-3 opacity-50 hover:opacity-80 transition-opacity text-xs text-muted-foreground border-0"
      >
        <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
};
