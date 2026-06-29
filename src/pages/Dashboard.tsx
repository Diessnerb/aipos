import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AnalyticsOverview from '@/components/analytics/AnalyticsOverview';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { AIInsightsDashboard } from '@/components/dashboard/AIInsightsDashboard';
import { SystemStatus } from '@/components/SystemStatus';
import { useAuth } from '@/components/AuthProvider';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { PageHeader } from '@/components/ui/page-header';

export default function Dashboard() {
  const { user } = useAuth();
  const { checkPermission } = usePermissionCheck();

  const canViewAnalytics = checkPermission('/analytics', 'view');
  const canViewSystemStatus = checkPermission('system-status', 'admin');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        subtitle={`Welcome back${user?.email ? `, ${user.email.split('@')[0]}` : ''}. Here's what's happening with your restaurant.`}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {canViewAnalytics && <AnalyticsOverview />}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        
        <div className="space-y-6">
          <AIInsightsDashboard 
            onOpenDetails={() => {
              // Could navigate to a detailed AI insights page
              console.log('Open AI insights details');
            }}
          />
          
          {canViewSystemStatus && (
            <SystemStatus />
          )}
        </div>
      </div>
    </div>
  );
}