
import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReservationAnalyticsOverview from '@/components/analytics/ReservationAnalyticsOverview';
import ReservationLoad from '@/components/analytics/ReservationLoad';
import PredictedBusyHours from '@/components/analytics/PredictedBusyHours';
import TimeBasedTrends from '@/components/analytics/TimeBasedTrends';
import CancellationNoShowRates from '@/components/analytics/CancellationNoShowRates';
import { RevenueAnalyticsDashboard } from '@/components/analytics/RevenueAnalyticsDashboard';
import { EnhancedPOSAnalytics } from '@/components/pos/EnhancedPOSAnalytics';
import { RealTimeSyncDashboard } from '@/components/pos/RealTimeSyncDashboard';
import { PredictiveInventoryDashboard } from '@/components/pos/PredictiveInventoryDashboard';

const Analytics = () => {
  const { isAdmin, isManager } = useAuth();
  
  // Check if user has access to analytics (admin or manager)
  if (!isAdmin && !isManager) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600">This page is only accessible to administrators and managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="w-full">
        <div className="space-y-6">
          <PageHeader 
            title="Analytics" 
            subtitle="Monitor reservations and revenue performance for optimal restaurant operations." 
          />
          
          <Tabs defaultValue="reservations" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reservations">Reservations</TabsTrigger>
              <TabsTrigger value="revenue" disabled className="opacity-50 cursor-not-allowed">Revenue & POS</TabsTrigger>
            </TabsList>
            
            <TabsContent value="reservations" className="space-y-6 mt-6">
              {/* Reservation Metrics Overview */}
              <ReservationAnalyticsOverview />
              
              {/* Current Operations Section */}
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">Current Operations</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                  <ReservationLoad />
                  <PredictedBusyHours />
                  <CancellationNoShowRates />
                </div>
              </div>

              {/* Performance Analysis Section */}
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">Performance Analysis</h2>
                <div className="grid grid-cols-1 gap-6">
                  <TimeBasedTrends />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="revenue" className="space-y-6 mt-6">
              <RevenueAnalyticsDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
