import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { OpeningHoursManager } from '@/components/settings/OpeningHoursManager';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';
import { OpeningHoursData, DEFAULT_OPERATING_HOURS, DEFAULT_FOOD_SERVICE_HOURS } from '@/types/openingHours';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const OpeningHoursSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { location, loading, createOrUpdateLocation, refetch } = useCompanyLocation();
  const [hours, setHours] = useState<OpeningHoursData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      // Initialize with defaults if no location or hours exist
      if (location?.hours) {
        setHours(location.hours);
      } else {
        setHours({
          operating: DEFAULT_OPERATING_HOURS,
          foodService: DEFAULT_FOOD_SERVICE_HOURS
        });
      }
    }
  }, [location, loading]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      console.log('💾 Saving opening hours:', hours);
      
      const saved = await createOrUpdateLocation({
        name: location?.name || 'Main Location',
        hours: hours || undefined,
      });

      // Ensure we have the latest data from DB and update local state
      await refetch();
      if (saved?.hours) {
        setHours(saved.hours);
      }

      toast({
        title: 'Success',
        description: 'Opening hours saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving opening hours:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save opening hours',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Button>
      </div>

      {/* Page header */}
      <PageHeader
        title="Opening Hours"
        subtitle="Configure your operating hours and food service times"
      />

      {/* Content - left-aligned with max-width */}
      <div className="space-y-6 max-w-4xl">
        <OpeningHoursManager
          value={hours}
          onChange={setHours}
        />

        {/* Save button inline with content */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Opening Hours'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OpeningHoursSettings;
