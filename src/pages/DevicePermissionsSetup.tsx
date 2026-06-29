import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Image, Bell, Bluetooth, Check, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CapacitorPermissionManager, PermissionType, PermissionStatus } from '@/device/CapacitorPermissionManager';
import { Capacitor } from '@capacitor/core';

interface PermissionItem {
  type: PermissionType;
  icon: React.ReactNode;
  title: string;
  description: string;
  purpose: string;
}

const PERMISSIONS: PermissionItem[] = [
  {
    type: 'camera',
    icon: <Camera className="w-6 h-6" />,
    title: 'Camera',
    description: 'Take photos of menu items and scan barcodes',
    purpose: 'Required for adding product images and scanning inventory'
  },
  {
    type: 'photos',
    icon: <Image className="w-6 h-6" />,
    title: 'Photo Library',
    description: 'Select existing images from your device',
    purpose: 'Optional - for choosing existing photos for menu items'
  },
  {
    type: 'notifications',
    icon: <Bell className="w-6 h-6" />,
    title: 'Notifications',
    description: 'Receive alerts for new orders and updates',
    purpose: 'Optional - for kitchen alerts and order notifications'
  }
];

export default function DevicePermissionsSetup() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<Record<PermissionType, PermissionStatus>>({
    camera: 'prompt',
    photos: 'prompt',
    notifications: 'prompt'
  });
  const [isRequesting, setIsRequesting] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const results = await CapacitorPermissionManager.checkAllPermissions();
    const statusMap: Record<PermissionType, PermissionStatus> = {
      camera: 'unknown',
      photos: 'unknown',
      notifications: 'unknown'
    };
    
    results.forEach(result => {
      statusMap[result.type] = result.status;
    });
    
    setPermissions(statusMap);
  };

  const requestPermission = async (type: PermissionType) => {
    setIsRequesting(true);
    const status = await CapacitorPermissionManager.requestPermission(type);
    setPermissions(prev => ({ ...prev, [type]: status }));
    setIsRequesting(false);
  };

  const requestAllPermissions = async () => {
    setIsRequesting(true);
    for (const permission of PERMISSIONS) {
      if (permissions[permission.type] !== 'granted') {
        await requestPermission(permission.type);
      }
    }
    setIsRequesting(false);
  };

  const handleContinue = () => {
    // Mark setup as complete in storage
    localStorage.setItem('device_permissions_setup_complete', 'true');
    setSetupComplete(true);
    
    // Navigate to device settings
    setTimeout(() => {
      navigate('/settings/device');
    }, 500);
  };

  const getStatusBadge = (status: PermissionStatus) => {
    switch (status) {
      case 'granted':
        return (
          <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
            <Check className="w-3 h-3 mr-1" />
            Granted
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="destructive" className="bg-red-500/20 text-red-700 border-red-500/30">
            <X className="w-3 h-3 mr-1" />
            Denied
          </Badge>
        );
      case 'prompt':
        return <Badge variant="secondary">Not Requested</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const allGranted = Object.values(permissions).every(status => status === 'granted');
  const cameraGranted = permissions.camera === 'granted';

  if (!CapacitorPermissionManager.isNativePlatform()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Web Platform Detected</CardTitle>
            <CardDescription>
              Permission setup is only needed for native mobile apps. You're running on web, so all features are available by default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/settings/device')} className="w-full">
              Continue to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Device Permissions</h1>
          <p className="text-muted-foreground">
            Grant permissions to enable all features of the app
          </p>
        </div>

        {/* Permission Cards */}
        <div className="space-y-4">
          {PERMISSIONS.map((permission) => (
            <Card key={permission.type}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {permission.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{permission.title}</CardTitle>
                      <CardDescription>{permission.description}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(permissions[permission.type])}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <strong>Purpose:</strong> {permission.purpose}
                </div>
                
                {permissions[permission.type] !== 'granted' && (
                  <Button
                    onClick={() => requestPermission(permission.type)}
                    disabled={isRequesting}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Request Permission
                  </Button>
                )}
                
                {permissions[permission.type] === 'denied' && (
                  <p className="text-xs text-destructive">
                    Permission denied. You can enable it in your device settings.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!allGranted && (
            <Button
              onClick={requestAllPermissions}
              disabled={isRequesting}
              className="w-full"
              size="lg"
            >
              Request All Permissions
            </Button>
          )}
          
          <Button
            onClick={handleContinue}
            variant={cameraGranted ? 'default' : 'outline'}
            className="w-full"
            size="lg"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          {!cameraGranted && (
            <p className="text-xs text-center text-muted-foreground">
              You can continue without granting all permissions, but some features may be limited.
            </p>
          )}
        </div>

        {setupComplete && (
          <div className="text-center text-sm text-green-600 animate-in fade-in">
            ✓ Setup complete! Redirecting...
          </div>
        )}
      </div>
    </div>
  );
}
