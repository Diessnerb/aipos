import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bluetooth, Wifi, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BluetoothPrinterService } from '@/device/BluetoothPrinterService';
import { WiFiPrinterService } from '@/device/WiFiPrinterService';
import { CashDrawerService } from '@/device/CashDrawerService';
import { toast } from '@/hooks/use-toast';

export default function HardwareSettings() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);

  const handleBluetoothScan = async () => {
    setIsScanning(true);
    try {
      const devices = await BluetoothPrinterService.discoverPrinters();
      toast({
        title: 'Bluetooth Scan',
        description: `Found ${devices.length} device(s)`,
      });
    } catch (error) {
      toast({
        title: 'Scan Failed',
        description: 'Could not scan for Bluetooth devices',
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestDrawer = async () => {
    if (CashDrawerService.isConnected()) {
      const success = await CashDrawerService.openDrawer();
      toast({
        title: success ? 'Drawer Opened' : 'Failed',
        description: success ? 'Cash drawer opened successfully' : 'Could not open drawer',
        variant: success ? 'default' : 'destructive'
      });
    } else {
      toast({
        title: 'No Drawer',
        description: 'Please connect a cash drawer first',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/settings/device')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Device Settings
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Hardware & Peripherals</h1>
          <p className="text-muted-foreground">Manage printers, cash drawers, and other connected devices</p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Bluetooth className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold">Bluetooth Devices</h3>
              <p className="text-sm text-muted-foreground">
                Scan for nearby Bluetooth printers and peripherals
              </p>
            </div>
            <Button onClick={handleBluetoothScan} disabled={isScanning}>
              {isScanning ? 'Scanning...' : 'Scan'}
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Wifi className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold">Network Printers</h3>
              <p className="text-sm text-muted-foreground">
                {WiFiPrinterService.isConnected() 
                  ? `Connected: ${WiFiPrinterService.getConnectedPrinter()?.name}`
                  : 'No network printer connected'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold">Cash Drawer</h3>
              <p className="text-sm text-muted-foreground">
                {CashDrawerService.isConnected()
                  ? `Connected: ${CashDrawerService.getConnectedDrawer()?.name}`
                  : 'No cash drawer connected'}
              </p>
            </div>
            <Button onClick={handleTestDrawer} variant="outline">
              Test Open
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
