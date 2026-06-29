import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { useCompanyId } from './useCompanyId';
import { getBoundCompany } from '@/utils/deviceBinding';

export interface CompanyFeature {
  feature_name: string;
  enabled: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useCompanyFeatures = (companyId?: string) => {
  const [features, setFeatures] = useState<CompanyFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { companyId: effectiveCompanyId } = useCompanyId();
  const { currentUser } = useCurrentUser();
  
  // Circuit breaker state
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);
  const [lastFailureTime, setLastFailureTime] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Debouncing state
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestCountRef = useRef(0);

  const fetchFeatures = useCallback(async (withTimeout = 8000) => {
    const targetCompanyId = companyId || effectiveCompanyId;
    
    if (!targetCompanyId) {
      setLoading(false);
      return;
    }

    console.log('🏢 Company Features - Using Company ID:', {
      targetCompanyId,
      source: effectiveCompanyId ? 'useCompanyId' : 'prop',
      isBound: getBoundCompany() !== null
    });

    // Circuit breaker check
    if (circuitBreakerOpen && lastFailureTime) {
      const timeSinceFailure = Date.now() - lastFailureTime;
      if (timeSinceFailure < 30000) { // 30 second cooldown
        console.log('Circuit breaker open, skipping request');
        return;
      } else {
        setCircuitBreakerOpen(false);
        setLastFailureTime(null);
      }
    }

    // Increment request counter
    requestCountRef.current++;
    const currentRequestId = requestCountRef.current;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setError(null);
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), withTimeout)
      );
      
      const dataPromise = supabase
        .from('company_subscription_features')
        .select('*')
        .eq('company_id', targetCompanyId)
        .abortSignal(abortControllerRef.current?.signal);

      const { data, error } = await Promise.race([dataPromise, timeoutPromise]);

      // Check if this is still the latest request
      if (currentRequestId !== requestCountRef.current) {
        console.log('Stale request, ignoring result');
        return;
      }

      if (error) {
        console.error('Error fetching company features:', error);
        setError(error.message);
        setRetryCount(prev => prev + 1);
        
        // Open circuit breaker on repeated failures
        if (retryCount >= 2) {
          setCircuitBreakerOpen(true);
          setLastFailureTime(Date.now());
        }
        
        setFeatures([]);
      } else {
        setFeatures(data || []);
        setRetryCount(0); // Reset on success
        setError(null);
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || currentRequestId !== requestCountRef.current) {
        console.log('Request cancelled or superseded');
        return;
      }
      
      console.error('Error fetching company features:', error);
      setError(error.message || 'Failed to fetch features');
      setRetryCount(prev => prev + 1);
      
      // Open circuit breaker on repeated failures  
      if (retryCount >= 2) {
        setCircuitBreakerOpen(true);
        setLastFailureTime(Date.now());
      }
      
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveCompanyId, circuitBreakerOpen, lastFailureTime, retryCount]);

  useEffect(() => {
    const targetCompanyId = companyId || effectiveCompanyId;
    
    // Only fetch if we have a company ID and circuit breaker is closed
    if (targetCompanyId && !circuitBreakerOpen) {
      // Debounce the fetch to prevent rapid successive calls
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        fetchFeatures();
      }, 200); // Reduced debounce time for real-time scenarios
    } else {
      setLoading(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [companyId, effectiveCompanyId, circuitBreakerOpen, fetchFeatures]);

  // Real-time subscription effect
  useEffect(() => {
    const targetCompanyId = companyId || effectiveCompanyId;
    if (!targetCompanyId) return;

    const channel = supabase
      .channel('company-features-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_subscription_features',
          filter: `company_id=eq.${targetCompanyId}`
        },
        (payload) => {
          console.log('Real-time feature update:', payload);
          // Refresh features when changes are detected
          fetchFeatures(3000); // Shorter timeout for real-time updates
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, effectiveCompanyId, fetchFeatures]);

  const hasFeature = (featureName: string): boolean => {
    const feature = features.find(f => f.feature_name === featureName);
    if (!feature) return false;
    
    // Check if feature is enabled and not expired
    if (!feature.enabled) return false;
    
    if (feature.expires_at) {
      const expirationDate = new Date(feature.expires_at);
      const now = new Date();
      if (now > expirationDate) return false;
    }
    
    return true;
  };

  const updateFeature = useCallback(async (featureName: string, enabled: boolean, expiresAt?: string) => {
    // Prevent multiple simultaneous updates
    if (loading) {
      return { success: false, error: 'Another operation is in progress' };
    }

    if (circuitBreakerOpen) {
      return { success: false, error: 'Service temporarily unavailable' };
    }

    setLoading(true);
    try {
      // Create timeout for update operation
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Update timeout')), 10000)
      );
      
      const updatePromise = supabase
        .from('company_subscription_features')
        .upsert({
          company_id: companyId || effectiveCompanyId,
          feature_name: featureName,
          enabled: enabled,
          expires_at: expiresAt || null,
          updated_at: new Date().toISOString()
        })
        .select();

      const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

      if (error) {
        console.error('Error updating feature:', error);
        setError(error.message);
        return { success: false, error: error.message };
      }

      // Refresh features after update (with shorter timeout)
      await fetchFeatures(5000);
      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating feature:', error);
      const errorMessage = error.message || 'Failed to update feature';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveCompanyId, loading, circuitBreakerOpen, fetchFeatures]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    features,
    loading,
    error,
    hasFeature,
    updateFeature,
    refetch: fetchFeatures,
    circuitBreakerOpen,
    retryCount
  };
};