import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDeviceLocation, setDeviceLocation, isDeviceBound } from '@/utils/deviceBinding';
import { Beer, Users, ChefHat, MapPin, ArrowLeft, Bluetooth, Wifi, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DeviceSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<'bar' | 'floor' | 'kitchen' | null>(null);

  const currentLocation = getDeviceLocation();

  // Redirect if device is not bound
  React.useEffect(() => {
    if (!isDeviceBound()) {
      navigate('/owner-login');
    }
  }, [navigate]);

  const handleLocationClick = (location: 'bar' | 'floor' | 'kitchen') => {
    if (location === currentLocation) return; // Already on this location
    setSelectedLocation(location);
    setShowConfirmDialog(true);
  };

  const handleConfirmChange = () => {
    if (!selectedLocation) return;

    setDeviceLocation(selectedLocation);
    
    const locationNames = {
      bar: 'Bar',
      floor: 'Floor Staff',
      kitchen: 'Kitchen'
    };

    toast({
      title: "Location Updated",
      description: `This tablet is now configured for ${locationNames[selectedLocation]}`,
    });

    setShowConfirmDialog(false);
    setSelectedLocation(null);
  };

  const getLocationIcon = (location: 'bar' | 'floor' | 'kitchen' | null) => {
    switch (location) {
      case 'bar': return <Beer className="w-5 h-5" />;
      case 'floor': return <Users className="w-5 h-5" />;
      case 'kitchen': return <ChefHat className="w-5 h-5" />;
      default: return <MapPin className="w-5 h-5" />;
    }
  };

  const getLocationColor = (location: 'bar' | 'floor' | 'kitchen' | null) => {
    switch (location) {
      case 'bar': return 'text-blue-600';
      case 'floor': return 'text-emerald-600';
      case 'kitchen': return 'text-orange-600';
      default: return 'text-muted-foreground';
    }
  };

  const locationNames = {
    bar: 'Bar',
    floor: 'Floor Staff',
    kitchen: 'Kitchen'
  };

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
        title="Device Settings" 
        subtitle="Manage this tablet's location and configuration" 
      />

      {/* Content - left-aligned with max-width */}
      <div className="space-y-6 max-w-4xl">
        {/* Hardware & Peripherals Card */}
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate('/settings/hardware')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bluetooth className="w-5 h-5" />
              Hardware & Peripherals
            </CardTitle>
            <CardDescription>
              Manage printers, cash drawers, and connected devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  <span>Network printers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bluetooth className="w-4 h-4" />
                  <span>Bluetooth devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Cash drawers</span>
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Current Location Display */}
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Current Location
              </CardTitle>
              <CardDescription>
                This affects which page opens by default and screen timeout behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentLocation ? (
                <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getLocationColor(currentLocation)} bg-muted/50`}>
                  {getLocationIcon(currentLocation)}
                  <div>
                    <p className="font-semibold text-foreground">{locationNames[currentLocation]}</p>
                    <p className="text-sm text-muted-foreground">
                      {currentLocation === 'bar' && 'Opens POS by default, standard timeout'}
                      {currentLocation === 'floor' && 'Opens reservations by default, standard timeout'}
                      {currentLocation === 'kitchen' && 'Opens kitchen view by default, no screen timeout'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No location configured</p>
              )}
            </CardContent>
          </Card>

          {/* Location Selection */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Change Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bar Option */}
              <button
                onClick={() => handleLocationClick('bar')}
                disabled={currentLocation === 'bar'}
                className={`group bg-card hover:bg-blue-600 border-2 ${
                  currentLocation === 'bar' 
                    ? 'border-blue-600 opacity-75 cursor-not-allowed' 
                    : 'border-border hover:border-blue-500'
                } rounded-xl p-6 transition-all duration-300 ${
                  currentLocation !== 'bar' ? 'hover:scale-105 hover:shadow-xl' : ''
                } relative`}
              >
                {currentLocation === 'bar' && (
                  <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    Current
                  </div>
                )}
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 group-hover:bg-blue-500/30 flex items-center justify-center transition-colors">
                    <Beer className="w-8 h-8 text-blue-400 group-hover:text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-white">Bar</h3>
                  <div className="text-xs text-muted-foreground group-hover:text-white space-y-1">
                    <p>• Opens POS by default</p>
                    <p>• Standard screen timeout</p>
                    <p>• Quick order processing</p>
                  </div>
                </div>
              </button>

              {/* Floor Option */}
              <button
                onClick={() => handleLocationClick('floor')}
                disabled={currentLocation === 'floor'}
                className={`group bg-card hover:bg-emerald-600 border-2 ${
                  currentLocation === 'floor' 
                    ? 'border-emerald-600 opacity-75 cursor-not-allowed' 
                    : 'border-border hover:border-emerald-500'
                } rounded-xl p-6 transition-all duration-300 ${
                  currentLocation !== 'floor' ? 'hover:scale-105 hover:shadow-xl' : ''
                } relative`}
              >
                {currentLocation === 'floor' && (
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    Current
                  </div>
                )}
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/30 flex items-center justify-center transition-colors">
                    <Users className="w-8 h-8 text-emerald-400 group-hover:text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-white">Floor</h3>
                  <div className="text-xs text-muted-foreground group-hover:text-white space-y-1">
                    <p>• Opens reservations by default</p>
                    <p>• Standard screen timeout</p>
                    <p>• Table management focus</p>
                  </div>
                </div>
              </button>

              {/* Kitchen Option */}
              <button
                onClick={() => handleLocationClick('kitchen')}
                disabled={currentLocation === 'kitchen'}
                className={`group bg-card hover:bg-orange-600 border-2 ${
                  currentLocation === 'kitchen' 
                    ? 'border-orange-600 opacity-75 cursor-not-allowed' 
                    : 'border-border hover:border-orange-500'
                } rounded-xl p-6 transition-all duration-300 ${
                  currentLocation !== 'kitchen' ? 'hover:scale-105 hover:shadow-xl' : ''
                } relative`}
              >
                {currentLocation === 'kitchen' && (
                  <div className="absolute top-3 right-3 bg-orange-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    Current
                  </div>
                )}
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-orange-500/20 group-hover:bg-orange-500/30 flex items-center justify-center transition-colors">
                    <ChefHat className="w-8 h-8 text-orange-400 group-hover:text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-white">Kitchen</h3>
                  <div className="text-xs text-muted-foreground group-hover:text-white space-y-1">
                    <p>• Opens kitchen view by default</p>
                    <p>• <strong className="text-orange-400 group-hover:text-white">No screen timeout</strong></p>
                    <p>• Always-on display</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Device Location?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change this tablet's location from <strong>{currentLocation ? locationNames[currentLocation] : 'unknown'}</strong> to{' '}
              <strong>{selectedLocation ? locationNames[selectedLocation] : 'unknown'}</strong>? This will affect the default page that opens and screen timeout behavior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedLocation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>Confirm Change</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeviceSettings;
