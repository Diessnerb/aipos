import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, UserX, TrendingDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useInstantData } from '@/hooks/useInstantData';
import type { Database } from '@/integrations/supabase/types';

type Reservation = Database['public']['Tables']['reservations']['Row'];

type TimeRange = '7days' | '1month' | '1year';

const CancellationNoShowRates = () => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('7days');
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
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
      case '7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '1month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '1year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }
    
    return { startDate, endDate };
  };

  const getRangeLabel = (range: TimeRange) => {
    switch (range) {
      case '7days': return 'Last 7 Days';
      case '1month': return 'Last Month';
      case '1year': return 'Last Year';
    }
  };

  const { data: rates, isLoading, error } = useQuery({
    queryKey: ['cancellation-no-show-rates', selectedRange, companyId],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(selectedRange);
      let data;

      if (isActive) {
        // Bound device: use cache
        const { data: cachedData } = getInstantReservations();
        data = ((cachedData || []) as Reservation[]).filter(r => 
          r.company_id === companyId &&
          r.date >= startDate.toISOString().split('T')[0] &&
          r.date <= endDate.toISOString().split('T')[0]
        );
      } else {
        // Web user: add company_id filter
        const { data: queryData, error } = await supabase
          .from('reservations')
          .select('status')
          .eq('company_id', companyId)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (error) throw error;
        data = queryData || [];
      }

      const totalReservations = data?.length || 0;
      const cancelled = data?.filter(r => r.status === 'cancelled').length || 0;
      const noShow = data?.filter(r => r.status === 'no_show').length || 0;

      const cancellationRate = totalReservations > 0 ? (cancelled / totalReservations) * 100 : 0;
      const noShowRate = totalReservations > 0 ? (noShow / totalReservations) * 100 : 0;

      return {
        totalReservations,
        cancelled,
        noShow,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        noShowRate: Math.round(noShowRate * 10) / 10
      };
    },
    enabled: !!companyId,
    refetchInterval: isActive ? 2000 : false,
  });

  return (
    <Card className="shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <CardTitle className="text-base flex-1">
            <div>Cancellation & No-Show Rates</div>
            <div className="text-xs font-normal text-muted-foreground">
              {getRangeLabel(selectedRange)} performance tracking
            </div>
          </CardTitle>
        </div>
        
        {/* Time Range Toggle */}
        <div className="flex gap-1 mt-4">
          <Button
            variant={selectedRange === '7days' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRange('7days')}
            className="h-7 px-3 text-xs"
          >
            7 Days
          </Button>
          <Button
            variant={selectedRange === '1month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRange('1month')}
            className="h-7 px-3 text-xs"
          >
            1 Month
          </Button>
          <Button
            variant={selectedRange === '1year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRange('1year')}
            className="h-7 px-3 text-xs"
          >
            1 Year
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pt-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error || !rates ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Failed to load data</p>
            </div>
          </div>
        ) : rates.totalReservations === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <UserX className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No data available</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cancellation Rate */}
            <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <UserX className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">Cancellations</p>
                  <p className="text-xs text-muted-foreground">{rates.cancelled} of {rates.totalReservations}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-destructive">{rates.cancellationRate}%</p>
              </div>
            </div>

            {/* No-Show Rate */}
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingDown className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">No-Shows</p>
                  <p className="text-xs text-muted-foreground">{rates.noShow} of {rates.totalReservations}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-orange-600">{rates.noShowRate}%</p>
              </div>
            </div>

            {/* Combined Impact */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Combined Impact</p>
                <p className="text-sm font-bold text-muted-foreground">
                  {Math.round((rates.cancellationRate + rates.noShowRate) * 10) / 10}%
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total lost reservations from cancellations and no-shows
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CancellationNoShowRates;