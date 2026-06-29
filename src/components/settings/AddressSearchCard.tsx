import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddressSearch } from '@/components/ui/address-search';
import { SearchResult } from '@/services/addressSearch';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';
import { useToast } from '@/hooks/use-toast';

interface AddressSearchCardProps {
  onSave?: () => void;
  loading?: boolean;
}

export const AddressSearchCard: React.FC<AddressSearchCardProps> = ({
  onSave,
  loading = false
}) => {
  const { location, createOrUpdateLocation } = useCompanyLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    address_line: '',
    postcode: '',
    city: '',
    county: '',
    country: 'United Kingdom',
    district: '',
    ward: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location) {
      setFormData({
        address_line: location.address_line || '',
        postcode: location.postcode || '',
        city: location.city || '',
        county: location.county || '',
        country: location.country || 'United Kingdom',
        district: location.district || '',
        ward: location.ward || '',
        latitude: location.latitude,
        longitude: location.longitude,
      });
    }
  }, [location]);

  const handleAddressSelect = (address: SearchResult) => {
    setFormData({
      address_line: formData.address_line || '', // Keep manual address line
      postcode: address.postcode,
      city: address.city,
      county: address.county,
      country: address.country,
      district: address.district,
      ward: address.ward,
      latitude: address.latitude,
      longitude: address.longitude,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await createOrUpdateLocation(formData);
      onSave?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save location settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Business Location</h3>
        <p className="text-sm text-muted-foreground">
          Configure your business address and location details
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address_line">Street Address</Label>
          <Input
            id="address_line"
            type="text"
            value={formData.address_line}
            onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
            placeholder="Enter street address"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postcode_search">Postcode Search</Label>
          <AddressSearch
            onAddressSelect={handleAddressSelect}
            placeholder="Search by postcode..."
            initialValue={formData.postcode}
          />
          <p className="text-sm text-muted-foreground">
            Search for your postcode to auto-fill address details
          </p>
        </div>

        {location && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm">
              <strong>Current Address:</strong>
            </p>
            <p className="text-sm mt-1">
              {[
                location.address_line ? location.address_line.split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ') : '',
                location.city ? location.city.split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ') : '',
                location.county ? location.county.split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ') : '',
                location.postcode?.toUpperCase(),
                location.country
              ].filter(Boolean).join(', ')}
            </p>
          </div>
        )}

        <Button 
          type="submit" 
          disabled={loading || saving}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Save Location'}
        </Button>
      </form>
    </div>
  );
};