import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { getRawPin } from '@/utils/pinAuth';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';

import { OpeningHoursData } from '@/types/openingHours';

interface LocationData {
  id?: string;
  name?: string;
  address?: string;
  address_line?: string;
  postcode?: string;
  full_address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  hours?: OpeningHoursData;
  status?: string;
  city?: string;
  county?: string;
  country?: string;
  district?: string;
  ward?: string;
}

interface CompanyLocationHook {
  location: LocationData | null;
  loading: boolean;
  createOrUpdateLocation: (locationData: Partial<LocationData>) => Promise<LocationData | null>;
  refetch: () => Promise<void>;
}

export const useCompanyLocation = (): CompanyLocationHook => {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const deviceLive = useDeviceLiveLayer();
  
  let authContext;
  try {
    authContext = useAuth();
  } catch (error) {
    console.error('AuthProvider not available in useCompanyLocation:', error);
    return { 
      location: null, 
      loading: false, 
      createOrUpdateLocation: () => Promise.resolve(null),
      refetch: () => Promise.resolve()
    };
  }
  
  const { companyId } = authContext;

  const fetchLocation = async () => {
    try {
      setLoading(true);
      
      if (!companyId) {
        setLoading(false);
        return;
      }

      // If device live, use cached data
      if (deviceLive) {
        const cachedLocations = queryClient.getQueryData<LocationData[]>(['locations', companyId]) || [];
        const cachedLocation = cachedLocations.length > 0 ? cachedLocations[0] : null;
        console.log('📍 Using cached location from device live layer');
        setLocation(cachedLocation);
        setLoading(false);
        return;
      }

      console.log('📍 Fetching location from database');

      const rawPin = getRawPin();
      const hasAdminSession = authContext?.user && !rawPin;
      
      // Use edge function for PIN sessions, direct access for admin sessions
      let settings = null;
      
      if (rawPin && !hasAdminSession) {
        const response = await supabase.functions.invoke('company-settings-get', {
          body: {
            pin: rawPin,
            companyId: companyId,
            isAuthenticatedAdmin: false
          }
        });

        if (response.error || !response.data?.success) {
          console.error('Error fetching company settings for location:', response.error);
          return;
        }

        settings = response.data.settings;
      } else if (hasAdminSession) {
        const { data: settingsData } = await supabase
          .from('company_settings')
          .select('default_location_id')
          .eq('company_id', companyId)
          .single();

        settings = settingsData;
      }

      // Fetch location
      let query = supabase
        .from('locations')
        .select('*')
        .eq('company_id', companyId);

      // If we have a default location ID, use it
      if (settings?.default_location_id) {
        query = query.eq('id', settings.default_location_id);
      }

      const { data: locationData, error: locationError } = await query;

      if (locationError) {
        console.error('Error fetching location:', locationError);
        throw locationError;
      }

      if (locationData && locationData.length > 0) {
        setLocation(locationData[0] as unknown as LocationData);
        // Update cache for device live layer
        queryClient.setQueryData(['locations', companyId], locationData);
      } else {
        setLocation(null);
      }
    } catch (error: any) {
      console.error('Error in fetchLocation:', error);
      toast({
        title: "Error",
        description: "Failed to load location data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateLocation = async (locationData: Partial<LocationData>): Promise<LocationData | null> => {
    try {
      if (!companyId) {
        throw new Error('No company ID available');
      }

      // Construct full address
      const fullAddress = [
        locationData.address_line,
        locationData.city,
        locationData.county,
        locationData.postcode,
        locationData.country
      ].filter(Boolean).join(', ');

      const locationPayload: any = {
        company_id: companyId,
        full_address: fullAddress,
        name: locationData.name || location?.name || 'Main Location', // Ensure name is always set
      };

      // Only add fields that are present in locationData
      if (locationData.address_line) locationPayload.address_line = locationData.address_line;
      if (locationData.city) locationPayload.city = locationData.city;
      if (locationData.county) locationPayload.county = locationData.county;
      if (locationData.postcode) locationPayload.postcode = locationData.postcode;
      if (locationData.country) locationPayload.country = locationData.country;
      if (locationData.phone) locationPayload.phone = locationData.phone;
      if (locationData.email) locationPayload.email = locationData.email;
      if (locationData.hours !== undefined) locationPayload.hours = locationData.hours;

      let savedLocation: LocationData | null = null;

      if (location?.id) {
        // Update existing location
        const { data, error } = await supabase
          .from('locations')
          .update(locationPayload)
          .eq('id', location.id)
          .select()
          .single();

        if (error) throw error;
        savedLocation = data as unknown as LocationData;
      } else {
        // Create new location
        const { data, error } = await supabase
          .from('locations')
          .insert([locationPayload])
          .select()
          .single();

        if (error) throw error;
        savedLocation = data as unknown as LocationData;

        // Set as default location in company settings
        if (savedLocation?.id) {
          const { error: settingsError } = await supabase
            .from('company_settings')
            .upsert({
              company_id: companyId,
              default_location_id: savedLocation.id
            }, {
              onConflict: 'company_id'
            });

          if (settingsError) {
            console.error('Error setting default location:', settingsError);
          }
        }
      }

      setLocation(savedLocation);
      
      // Update cache
      if (savedLocation) {
        queryClient.setQueryData(['locations', companyId], [savedLocation]);
      }
      
      toast({
        title: "Success",
        description: "Location saved successfully"
      });

      return savedLocation;
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast({
        title: "Error",
        description: "Failed to save location. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const refetch = async () => {
    await fetchLocation();
  };

  useEffect(() => {
    fetchLocation();
  }, [companyId, deviceLive]);

  return {
    location,
    loading,
    createOrUpdateLocation,
    refetch
  };
};

export type { LocationData };
