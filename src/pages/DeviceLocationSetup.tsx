import React from 'react';
import { useNavigate } from 'react-router-dom';
import { setDeviceLocation } from '@/utils/deviceBinding';
import { Beer, Users, ChefHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const DeviceLocationSetup: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLocationSelect = (location: 'bar' | 'floor' | 'kitchen') => {
    setDeviceLocation(location);
    
    toast({
      title: "Location Set",
      description: `This tablet is now configured for ${location === 'bar' ? 'Bar' : location === 'floor' ? 'Floor Staff' : 'Kitchen'}`,
    });

    // Navigate to appropriate default page based on location
    const defaultPages = {
      bar: '/pos',
      floor: '/reservations?view=timeline',
      kitchen: '/kitchen'
    };

    navigate(defaultPages[location], { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Where will this tablet be used?
          </h1>
          <p className="text-muted-foreground text-lg">
            Select the location to configure default page and timeout settings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bar Option */}
          <button
            onClick={() => handleLocationSelect('bar')}
            className="group bg-card border-2 border-border hover:border-blue-500 rounded-2xl p-8 transition-all duration-300 hover:scale-105 hover:ring-4 hover:ring-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-blue-500/20 group-hover:bg-blue-500/40 flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                <Beer className="w-12 h-12 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Bar</h2>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Opens POS by default</p>
                <p>Standard screen timeout</p>
                <p>Quick order processing</p>
              </div>
            </div>
          </button>

          {/* Floor Option */}
          <button
            onClick={() => handleLocationSelect('floor')}
            className="group bg-card border-2 border-border hover:border-emerald-500 rounded-2xl p-8 transition-all duration-300 hover:scale-105 hover:ring-4 hover:ring-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/40 flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                <Users className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Floor</h2>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Opens reservations by default</p>
                <p>Standard screen timeout</p>
                <p>Table management focus</p>
              </div>
            </div>
          </button>

          {/* Kitchen Option */}
          <button
            onClick={() => handleLocationSelect('kitchen')}
            className="group bg-card border-2 border-border hover:border-orange-500 rounded-2xl p-8 transition-all duration-300 hover:scale-105 hover:ring-4 hover:ring-orange-500/50 hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-orange-500/20 group-hover:bg-orange-500/40 flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                <ChefHat className="w-12 h-12 text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Kitchen</h2>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Opens kitchen view by default</p>
                <p>No screen timeout</p>
                <p>Always-on display</p>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            You can change this location later in device settings
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeviceLocationSetup;
