import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettingsPermissions } from '@/hooks/useSettingsPermissions';
import { Shield, Lock } from 'lucide-react';

interface IntegrationsGuardProps {
  children: React.ReactNode;
  fallbackComponent?: React.ReactNode;
}

export const IntegrationsGuard: React.FC<IntegrationsGuardProps> = ({ 
  children, 
  fallbackComponent 
}) => {
  const { canAccessIntegrations, isLoading } = useSettingsPermissions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
          <CardDescription>Checking permissions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!canAccessIntegrations) {
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }

    return (
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-muted">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>Admin Access Required</CardTitle>
          <CardDescription>
            Only administrators can manage integrations and platform connections
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button disabled variant="secondary" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Contact Administrator
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Ask your administrator to configure platform integrations or grant you admin access
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};