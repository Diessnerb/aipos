import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useInstantData } from '@/hooks/useInstantData';
import type { Database } from '@/integrations/supabase/types';

type Reservation = Database['public']['Tables']['reservations']['Row'];

type TimeRange = 'today' | 'tomorrow' | 'week' | 'month';

const ReservationLoad = () => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('today');
  const { companyId } = useAuth();
  const { isActive } = useDeviceLiveLayer();
  const { getInstantReservations } = useInstantData();

  if (!companyId) {
    return (
      <Card className="shadow-sm h-full flex flex-col">
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">Loading company data...</p>
        </CardContent>
      </Card>
    );
  }

  const getDateRange = (range: TimeRange) => {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (range) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'tomorrow':
        startDate = new Date(today);
        startDate.setDate(today.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'week':
        // Calculate Monday-Sunday of current week
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days; else go back (day - 1) days
        
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysFromMonday); // Go back to Monday
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Add 6 days to get to Sunday
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'month':
        // First day of current month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        
        // Last day of current month
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }
    
    return { startDate, endDate };
  };

  const getRangeLabel = (range: TimeRange) => {
    switch (range) {
      case 'today': return 'Today';
      case 'tomorrow': return 'Tomorrow';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
    }
  };

  const { data: reservationData, isLoading, error } = useQuery({
    queryKey: ['reservation-load', selectedRange, companyId],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(selectedRange);
      let data;

      if (isActive) {
        // Bound device: use cache
        const { data: cachedData } = getInstantReservations();
        data = ((cachedData || []) as Reservation[]).filter(r => 
          r.company_id === companyId &&
          r.date >= startDate.toISOString().split('T')[0] &&
          r.date <= endDate.toISOString().split('T')[0] &&
          r.status !== 'cancelled'
        );
      } else {
        // Web user: add company_id filter
        const { data: queryData, error } = await supabase
          .from('reservations')
          .select('status')
          .eq('company_id', companyId)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
          .neq('status', 'cancelled');

        if (error) throw error;
        data = queryData || [];
      }

      const statusCounts = {
        confirmed: 0,
        pending: 0,
        completed: 0,
        no_show: 0
      };

      data?.forEach(reservation => {
        const status = reservation.status as keyof typeof statusCounts;
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });

      const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

      return {
        total,
        statusCounts,
        percentages: {
          confirmed: total > 0 ? Math.round((statusCounts.confirmed / total) * 100) : 0,
          pending: total > 0 ? Math.round((statusCounts.pending / total) * 100) : 0,
          completed: total > 0 ? Math.round((statusCounts.completed / total) * 100) : 0,
          no_show: total > 0 ? Math.round((statusCounts.no_show / total) * 100) : 0,
        }
      };
    },
    enabled: !!companyId,
    refetchInterval: isActive ? 2000 : false,
  });

  const statusConfig = [
    { key: 'confirmed', label: 'Confirmed', color: '#22C55E', textColor: 'text-green-600' },
    { key: 'pending', label: 'Pending', color: '#F59E0B', textColor: 'text-amber-600' },
    { key: 'completed', label: 'Completed', color: '#3B82F6', textColor: 'text-blue-600' },
    { key: 'no_show', label: 'No Show', color: '#EF4444', textColor: 'text-red-600' },
  ];

  const chartData = statusConfig
    .map(config => ({
      name: config.label,
      value: reservationData?.statusCounts[config.key as keyof typeof reservationData.statusCounts] || 0,
      color: config.color,
      percentage: reservationData?.percentages[config.key as keyof typeof reservationData.percentages] || 0
    }))
    .filter(item => item.value > 0);

  return (
    <Card className="shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base flex-1">
            <div>Reservation Load</div>
            <div className="text-xs font-normal text-muted-foreground">
              {getRangeLabel(selectedRange)} status breakdown
            </div>
          </CardTitle>
        </div>
        
        {/* Time Range Toggle */}
        <div className="flex gap-1 mt-4 flex-wrap">
          <Button
            variant={selectedRange === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRange('today')}
            className="h-7 px-3 text-xs"
          >
            Today
          </Button>
          <Button
            variant={selectedRange === 'tomorrow' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRange('tomorrow')}
            className="h-7 px-3 text-xs"
          >
            Tomorrow
          </Button>
          <Button
            variant={selectedRange === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRange('week')}
            className="h-7 px-3 text-xs"
          >
            This Week
          </Button>
          <Button
            variant={selectedRange === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRange('month')}
            className="h-7 px-3 text-xs"
          >
            This Month
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pt-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-full mx-auto" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ) : error || !reservationData ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Failed to load data</p>
            </div>
          </div>
        ) : reservationData.total === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No reservations found</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{reservationData.total}</p>
              <p className="text-sm text-muted-foreground">Total Reservations</p>
            </div>

            {chartData.length > 0 && (
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any) => [`${value} reservations`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-3">
              {statusConfig.map(config => {
                const count = reservationData.statusCounts[config.key as keyof typeof reservationData.statusCounts];
                const percentage = reservationData.percentages[config.key as keyof typeof reservationData.percentages];
                
                if (count === 0) return null;
                
                return (
                  <div key={config.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${config.textColor}`}>
                        {count} ({percentage}%)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReservationLoad;