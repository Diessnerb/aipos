import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Clock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useInstantData } from '@/hooks/useInstantData';
import type { Database } from '@/integrations/supabase/types';

type Reservation = Database['public']['Tables']['reservations']['Row'];

const TimeBasedTrends = () => {
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

  const { data: hourlyTrends, isLoading: hourlyLoading } = useQuery({
    queryKey: ['hourly-trends', companyId],
    queryFn: async () => {
      let data;

      if (isActive) {
        const { data: cachedData } = getInstantReservations();
        data = ((cachedData || []) as Reservation[]).filter(r => 
          r.company_id === companyId &&
          r.status !== 'cancelled' &&
          r.time
        );
      } else {
        const { data: queryData, error } = await supabase
          .from('reservations')
          .select('time')
          .eq('company_id', companyId)
          .neq('status', 'cancelled')
          .not('time', 'is', null);
        
        if (error) throw error;
        data = queryData || [];
      }
      
      const hourlyData = new Array(24).fill(0);
      
      data?.forEach(reservation => {
        if (reservation.time) {
          const hour = parseInt(reservation.time.split(':')[0]);
          if (hour >= 0 && hour < 24) {
            hourlyData[hour]++;
          }
        }
      });
      
      return hourlyData.map((count, hour) => ({
        hour: `${hour}:00`,
        reservations: count
      })).filter(item => item.reservations > 0);
    },
    enabled: !!companyId,
    refetchInterval: isActive ? 2000 : false,
  });

  const { data: weeklyTrends, isLoading: weeklyLoading } = useQuery({
    queryKey: ['weekly-trends', companyId],
    queryFn: async () => {
      let data;

      if (isActive) {
        const { data: cachedData } = getInstantReservations();
        data = ((cachedData || []) as Reservation[]).filter(r => 
          r.company_id === companyId &&
          r.status !== 'cancelled' &&
          r.date
        );
      } else {
        const { data: queryData, error } = await supabase
          .from('reservations')
          .select('date')
          .eq('company_id', companyId)
          .neq('status', 'cancelled')
          .not('date', 'is', null);
        
        if (error) throw error;
        data = queryData || [];
      }
      
      const weeklyData = {
        'Sunday': 0,
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0
      };
      
      data?.forEach(reservation => {
        if (reservation.date) {
          const date = new Date(reservation.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          if (weeklyData.hasOwnProperty(dayName)) {
            weeklyData[dayName as keyof typeof weeklyData]++;
          }
        }
      });
      
      const colors = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#06B6D4', '#8B5CF6'];
      return Object.entries(weeklyData).map(([day, count], index) => ({
        day: day.substring(0, 3),
        reservations: count,
        color: colors[index]
      }));
    },
    enabled: !!companyId,
    refetchInterval: isActive ? 2000 : false,
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-800 mb-1">{label}</p>
          <p className="text-blue-600 font-medium">
            {payload[0].value} reservations
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base">
            <div>Time-Based Trends</div>
            <div className="text-xs font-normal text-muted-foreground">Peak hours and busiest days analysis</div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        <div>
          <h4 className="text-sm font-semibold mb-4 text-slate-700 flex items-center gap-2">
            <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
            Peak Reservation Hours
          </h4>
          {hourlyLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : (
            <div className="bg-gradient-to-t from-blue-50/50 to-transparent p-4 rounded-xl">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={hourlyTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge> 
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="reservations" 
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6, filter: 'url(#glow)' }}
                    activeDot={{ r: 8, stroke: '#3B82F6', strokeWidth: 2, fill: '#ffffff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-4 text-slate-700 flex items-center gap-2">
            <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
            Busiest Days of the Week
          </h4>
          {weeklyLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : (
            <div className="bg-gradient-to-t from-emerald-50/50 to-transparent p-4 rounded-xl">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="reservations" radius={[6, 6, 0, 0]}>
                    {weeklyTrends?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeBasedTrends;
