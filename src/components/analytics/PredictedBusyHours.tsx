import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useInstantData } from '@/hooks/useInstantData';
import type { Database } from '@/integrations/supabase/types';

type Reservation = Database['public']['Tables']['reservations']['Row'];

interface HourData {
  hour: string;
  count: number;
  percentage: number;
}

interface BusyHoursData {
  hourlyFrequency: HourData[];
  peakWindow: string;
  peakCount: number;
}

const PredictedBusyHours = () => {
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

  const { data: busyHoursData, isLoading } = useQuery({
    queryKey: ['predicted-busy-hours', companyId],
    queryFn: async (): Promise<BusyHoursData> => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];

      let data;

      if (isActive) {
        // Bound device: use cache
        const { data: cachedData } = getInstantReservations();
        data = ((cachedData || []) as Reservation[]).filter(r => 
          r.company_id === companyId &&
          r.date >= startDate &&
          !['cancelled', 'no-show'].includes(r.status) &&
          r.time
        );
      } else {
        // Web user: add company_id filter
        const { data: queryData, error } = await supabase
          .from('reservations')
          .select('time, date, status')
          .eq('company_id', companyId)
          .gte('date', startDate)
          .not('status', 'in', '("cancelled","no-show")');

        if (error) throw error;
        data = queryData || [];
      }

      if (!data || data.length === 0) {
        return {
          hourlyFrequency: [],
          peakWindow: '',
          peakCount: 0
        };
      }

      // Process real data
      const hourCounts: Record<string, number> = {};
      data.forEach(reservation => {
        if (reservation.time) {
          const hour = reservation.time.substring(0, 5);
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      });

      const hourlyFrequency = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour, count: Number(count) }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      const maxCount = Math.max(...hourlyFrequency.map(h => h.count));
      
      const frequencyWithPercentage: HourData[] = hourlyFrequency.map(h => ({
        ...h,
        percentage: maxCount > 0 ? Math.round((h.count / maxCount) * 100) : 0
      }));

      const busiestHour = frequencyWithPercentage.reduce((max, current) => 
        current.count > max.count ? current : max
      );

      const calculatePeakWindow = (busiestTime: string): string => {
        const [hours, minutes] = busiestTime.split(':').map(Number);
        let startMinutes = minutes - 15;
        let startHours = hours;
        if (startMinutes < 0) {
          startMinutes += 60;
          startHours -= 1;
          if (startHours < 0) startHours = 0;
        }
        const endHours = hours + 1;
        const endMinutes = minutes;
        const formatTime = (h: number, m: number) => 
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        return `${formatTime(startHours, startMinutes)} - ${formatTime(endHours, endMinutes)}`;
      };

      const peakWindow = calculatePeakWindow(busiestHour.hour);
      const peakCount = busiestHour.count;

      return {
        hourlyFrequency: frequencyWithPercentage,
        peakWindow,
        peakCount
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
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base">
            <div>Predicted Busy Hours</div>
            <div className="text-xs font-normal text-muted-foreground">AI-powered peak time forecasting</div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-6 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : busyHoursData && busyHoursData.hourlyFrequency.length > 0 ? (
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* Peak indicator */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Busiest period: {busyHoursData.peakWindow}
                </span>
              </div>
            </div>

            {/* Hourly breakdown */}
            <ScrollArea className="flex-1 max-h-72 lg:max-h-96 min-h-0">
              <div className="space-y-2 pr-2">
                {busyHoursData.hourlyFrequency.map((hourData, index) => {
                  // Parse peak window to check if current hour falls within range
                  const [peakStart, peakEnd] = busyHoursData.peakWindow.split(' - ');
                  const isPeak = hourData.hour >= peakStart && hourData.hour <= peakEnd;
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded ${
                        isPeak ? 'bg-blue-50 border border-blue-200' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${isPeak ? 'text-blue-800' : ''}`}>
                          {hourData.hour}
                        </span>
                        <div className="flex-1 w-20 bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isPeak ? 'bg-blue-500' : 'bg-muted-foreground'
                            }`}
                            style={{ width: `${hourData.percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${isPeak ? 'text-blue-700' : 'text-muted-foreground'}`}>
                        {hourData.count} reservations
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-6">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No reservation data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PredictedBusyHours;
