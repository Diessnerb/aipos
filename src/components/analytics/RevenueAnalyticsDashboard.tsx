import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRevenueAnalytics } from '@/hooks/useRevenueAnalytics';
import { TableRevenueCard } from './TableRevenueCard';
import { DailyRevenueChart } from './DailyRevenueChart';
import { PerformanceMetrics } from './PerformanceMetrics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TrendingUp, DollarSign, Users, Clock } from 'lucide-react';

export const RevenueAnalyticsDashboard: React.FC = () => {
  const { 
    dailyAnalytics, 
    tableMetrics, 
    isLoading, 
    totalRevenue, 
    totalOrders, 
    averageOrderValue,
    peakHours 
  } = useRevenueAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalRevenue?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">Today's earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">Orders processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{averageOrderValue?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">Per order value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peakHours || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">Busiest period</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyRevenueChart data={dailyAnalytics} />
        <PerformanceMetrics tableMetrics={tableMetrics} />
      </div>

      {/* Table Revenue Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Table Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tableMetrics?.map((table) => (
            <TableRevenueCard
              key={`table-${table.table_number}`}
              tableNumber={table.table_number}
              revenue={table.total_revenue}
              orders={table.total_orders}
              utilizationRate={table.utilization_rate}
              turnoverCount={table.turnover_count}
            />
          ))}
        </div>
      </div>
    </div>
  );
};