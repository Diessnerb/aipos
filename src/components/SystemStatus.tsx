import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface SystemHealthData {
  timestamp: string;
  auth_users: number;
  public_users: number;
  companies: number;
  rls_enabled: number;
  status: string;
}

export const SystemStatus: React.FC = () => {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    const checkSystemHealth = async () => {
      try {
        const { data, error } = await supabase.rpc('auth_health_check');
        
        if (error) throw error;
        
        setHealthData(data as unknown as SystemHealthData);
        setError(null);
      } catch (err) {
        console.error('System health check failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    checkSystemHealth();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  const getAuthStatus = () => {
    if (auth.loading) return { status: 'loading', message: 'Checking authentication...' };
    if (auth.pinUser) return { status: 'healthy', message: `PIN User: ${auth.pinUser.full_name} (${auth.pinUser.role})` };
    if (auth.user) return { status: 'healthy', message: `Supabase User: ${auth.user.email}` };
    return { status: 'warning', message: 'No authentication detected' };
  };

  const authStatus = getAuthStatus();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Checking system health...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon(healthData?.status || 'error')}
          System Status
        </CardTitle>
        <CardDescription>
          Authentication, database, and security status overview
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">Error: {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              {getStatusIcon(authStatus.status)}
              Authentication
            </h4>
            <p className="text-sm text-muted-foreground">{authStatus.message}</p>
            <div className="flex gap-2">
              <Badge variant={auth.isOwner ? "default" : "secondary"}>
                {auth.isOwner ? "Owner" : auth.userRole || "No Role"}
              </Badge>
              <Badge variant={auth.companyId ? "default" : "destructive"}>
                {auth.companyId ? "Company Linked" : "No Company"}
              </Badge>
            </div>
          </div>

          {healthData && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                {getStatusIcon(healthData.status)}
                Database Health
              </h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Auth Users:</span>
                  <span className="font-medium">{healthData.auth_users}</span>
                </div>
                <div className="flex justify-between">
                  <span>Public Users:</span>
                  <span className="font-medium">{healthData.public_users}</span>
                </div>
                <div className="flex justify-between">
                  <span>Companies:</span>
                  <span className="font-medium">{healthData.companies}</span>
                </div>
                <div className="flex justify-between">
                  <span>RLS Tables:</span>
                  <span className="font-medium">{healthData.rls_enabled}/5</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Last checked: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'Unknown'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};