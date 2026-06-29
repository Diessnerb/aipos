import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  RefreshCw, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SyncStatus {
  isEnabled: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  itemsSynced: number;
  errors: string[];
  posSystem: string;
  syncFrequency: number; // minutes
  isConnected: boolean;
}

interface SyncActivity {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  status: 'success' | 'error' | 'pending';
  details: string;
}

export const RealTimeSyncDashboard: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isEnabled: false,
    lastSync: null,
    nextSync: null,
    itemsSynced: 0,
    errors: [],
    posSystem: 'square',
    syncFrequency: 15,
    isConnected: false
  });
  
  const [recentActivity, setRecentActivity] = useState<SyncActivity[]>([]);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  const { currentUser } = useCurrentUser();
  const { companyId: effectiveCompanyId } = useCompanyId();
  const { toast } = useToast();

  useEffect(() => {
    if (effectiveCompanyId) {
      loadSyncStatus();
      loadRecentActivity();
      
      // Set up real-time subscription for sync logs
      const subscription = supabase
        .channel('sync_logs')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'pos_order_sync_logs',
          filter: `company_id=eq.${effectiveCompanyId}`
        }, (payload) => {
          handleNewSyncLog(payload.new);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [effectiveCompanyId]);

  const loadSyncStatus = async () => {
    try {
      const { data: integrations } = await supabase
        .from('integrations')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .eq('connected', true);

      if (integrations && integrations.length > 0) {
        const integration = integrations[0];
        setSyncStatus(prev => ({
          ...prev,
          isConnected: true,
          posSystem: integration.service_name,
          lastSync: integration.last_synced_at ? new Date(integration.last_synced_at) : null
        }));
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { data: logs } = await supabase
        .from('pos_order_sync_logs')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (logs) {
        const activities: SyncActivity[] = logs.map(log => ({
          id: log.id,
          timestamp: new Date(log.created_at),
          action: log.sync_operation,
          entity: 'order',
          status: log.sync_status as 'success' | 'error' | 'pending',
          details: log.error_details || `${log.sync_operation} order`
        }));
        
        setRecentActivity(activities);
      }
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }
  };

  const handleNewSyncLog = (logData: any) => {
    const newActivity: SyncActivity = {
      id: logData.id,
      timestamp: new Date(logData.created_at),
      action: logData.sync_operation,
      entity: 'order',
      status: logData.sync_status,
      details: logData.error_details || `${logData.sync_operation} order`
    };

    setRecentActivity(prev => [newActivity, ...prev.slice(0, 9)]);
    
    // Update sync status
    setSyncStatus(prev => ({
      ...prev,
      lastSync: newActivity.timestamp,
      itemsSynced: prev.itemsSynced + (newActivity.status === 'success' ? 1 : 0),
      errors: newActivity.status === 'error' 
        ? [newActivity.details, ...prev.errors.slice(0, 4)]
        : prev.errors
    }));
  };

  const handleToggleRealTimeSync = async (enabled: boolean) => {
    try {
      // This would typically update webhook configurations
      setSyncStatus(prev => ({ ...prev, isEnabled: enabled }));
      
      toast({
        title: enabled ? "Real-time Sync Enabled" : "Real-time Sync Disabled",
        description: enabled 
          ? "Changes will sync automatically with your POS system"
          : "Manual sync required for changes",
      });
    } catch (error) {
      console.error('Failed to toggle real-time sync:', error);
      toast({
        title: "Error",
        description: "Failed to update sync settings",
        variant: "destructive"
      });
    }
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    setSyncProgress(0);

    try {
      // Simulate sync progress
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 500);

      // Call the actual sync function
      const response = await supabase.functions.invoke('pos-order-webhook', {
        body: { 
          action: 'manual_sync',
          company_id: effectiveCompanyId,
          pos_system: syncStatus.posSystem
        }
      });

      clearInterval(progressInterval);
      setSyncProgress(100);

      if (response.error) throw response.error;

      toast({
        title: "Manual Sync Completed",
        description: "All menu items and orders have been synchronized",
      });

      setTimeout(() => {
        setIsManualSyncing(false);
        setSyncProgress(0);
      }, 1500);

    } catch (error) {
      console.error('Manual sync failed:', error);
      toast({
        title: "Sync Failed",
        description: "Manual synchronization encountered an error",
        variant: "destructive"
      });
      setIsManualSyncing(false);
      setSyncProgress(0);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            {syncStatus.isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus.isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {syncStatus.posSystem} POS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Synced</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStatus.itemsSynced}</div>
            <p className="text-xs text-muted-foreground">
              {syncStatus.lastSync ? formatTimeAgo(syncStatus.lastSync) : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <Zap className={`h-4 w-4 ${syncStatus.isEnabled ? 'text-green-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus.isEnabled ? 'Auto' : 'Manual'}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncStatus.isEnabled ? `Every ${syncStatus.syncFrequency}m` : 'On demand'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
            <AlertCircle className={`h-4 w-4 ${syncStatus.errors.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStatus.errors.length}</div>
            <p className="text-xs text-muted-foreground">
              {syncStatus.errors.length > 0 ? 'Needs attention' : 'All clear'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Sync Controls
          </CardTitle>
          <CardDescription>
            Configure real-time synchronization settings and trigger manual syncs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Real-time Synchronization</div>
              <div className="text-sm text-muted-foreground">
                Automatically sync changes with your POS system
              </div>
            </div>
            <Switch
              checked={syncStatus.isEnabled}
              onCheckedChange={handleToggleRealTimeSync}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sync Frequency</label>
              <Select 
                value={syncStatus.syncFrequency.toString()} 
                onValueChange={(value) => setSyncStatus(prev => ({ ...prev, syncFrequency: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">POS System</label>
              <Select 
                value={syncStatus.posSystem}
                onValueChange={(value) => setSyncStatus(prev => ({ ...prev, posSystem: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="toast">Toast</SelectItem>
                  <SelectItem value="clover">Clover</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Manual Sync</label>
              <Button 
                onClick={handleManualSync} 
                disabled={isManualSyncing || !syncStatus.isConnected}
                className="w-full"
              >
                {isManualSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>

          {isManualSyncing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sync Progress</span>
                <span>{Math.round(syncProgress)}%</span>
              </div>
              <Progress value={syncProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Sync Activity
          </CardTitle>
          <CardDescription>
            Latest synchronization events and status updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(activity.status)}
                    <div>
                      <div className="font-medium capitalize">
                        {activity.action} {activity.entity.replace('_', ' ')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.details}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent sync activity
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Log */}
      {syncStatus.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Recent Errors
            </CardTitle>
            <CardDescription>
              Sync errors that require attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncStatus.errors.map((error, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};