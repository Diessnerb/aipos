import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { TypewriterLoading } from '@/components/ui/typewriter-loading';
import { Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PermissionGuardProps {
  children: React.ReactNode;
  route: string;
  requiredPermission?: 'view' | 'growth' | 'edit' | 'admin';
  fallbackRoute?: string;
  showAccessDenied?: boolean;
}

const AccessDeniedView = ({ route, requiredPermission }: { route: string; requiredPermission: string }) => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-xl">Access Denied</CardTitle>
        <CardDescription>
          You don't have permission to access this page
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Required Permission:</strong> {requiredPermission}</p>
          <p><strong>Page:</strong> {route}</p>
        </div>
        <Button 
          onClick={() => window.history.back()} 
          variant="outline"
          className="w-full"
        >
          Go Back
        </Button>
      </CardContent>
    </Card>
  </div>
);

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  route,
  requiredPermission = 'view',
  fallbackRoute = '/settings',
  showAccessDenied = true
}) => {
  const { checkPermission, loading, isOwner } = usePermissionCheck();

  // CRITICAL: Owner bypass - render immediately if user is owner
  if (isOwner) {
    console.log('🚀 Owner bypass activated for route:', route);
    return <>{children}</>;
  }

  // Show loading while checking permissions (only for non-owners)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <TypewriterLoading />
      </div>
    );
  }

  // Check if user has required permission
  const hasPermission = checkPermission(route, requiredPermission);

  // Debug logging
  console.log('🛡️ PermissionGuard:', {
    route,
    requiredPermission,
    hasPermission,
    isOwner,
    loading
  });

  // If user doesn't have permission
  if (!hasPermission) {
    if (showAccessDenied) {
      return <AccessDeniedView route={route} requiredPermission={requiredPermission} />;
    } else {
      return <Navigate to={fallbackRoute} replace />;
    }
  }

  // User has permission, render children
  return <>{children}</>;
};

export default PermissionGuard;