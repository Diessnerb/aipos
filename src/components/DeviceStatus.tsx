import React from 'react';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { getBoundCompany, isDeviceBound } from '@/utils/deviceBinding';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const DeviceStatus: React.FC = () => {
  const [status, setStatus] = React.useState<any>(null);

  React.useEffect(() => {
    const updateStatus = () => {
      setStatus(DeviceDataManager.debugStatus());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className="p-4 border rounded-lg bg-muted/50">
      <h3 className="font-semibold mb-2">Device Data Manager Status</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span>Device Bound:</span>
          <Badge variant={status.boundCompany ? 'default' : 'secondary'}>
            {status.boundCompany ? 'Yes' : 'No'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <span>Manager Active:</span>
          <Badge variant={status.isActive ? 'default' : 'secondary'}>
            {status.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <span>Company ID:</span>
          <code className="text-xs bg-muted px-1 rounded">
            {status.companyId || 'None'}
          </code>
        </div>
        
        <div className="flex items-center gap-2">
          <span>Subscriptions:</span>
          <Badge variant="outline">{status.subscriptionCount}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <span>Reconnect Attempts:</span>
          <Badge variant="outline">{status.reconnectAttempts}</Badge>
        </div>
        
        {status.boundCompany && (
          <div className="text-sm text-muted-foreground">
            Bound to: {status.boundCompany.company_name}
          </div>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => console.log('🚀 Device Status:', status)}
        >
          Log to Console
        </Button>
      </div>
    </div>
  );
};