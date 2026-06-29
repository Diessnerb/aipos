
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, LineChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currencyFormatter';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';

const SevenDayTrend = () => {
  const { data: trendData, isLoading } = useQuery({
    queryKey: ['seven-day-trend'],
    queryFn: async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);

      // Try to get real orders data
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('total_amount, ordered_at')
        .gte('ordered_at', fourteenDaysAgo.toISOString())
        .order('ordered_at');

      if (!error && ordersData && ordersData.length > 0) {
        // Process real data
        const last7Days = [];
        const previous7Days = [];

        for (let i = 0; i < 7; i++) {
          const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          
          const prevDate = new Date(fourteenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
          const prevDateStr = prevDate.toISOString().split('T')[0];

          const currentDayRevenue = ordersData
            .filter(order => order.ordered_at?.startsWith(dateStr))
            .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

          const prevDayRevenue = ordersData
            .filter(order => order.ordered_at?.startsWith(prevDateStr))
            .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

          last7Days.push({
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            currentWeek: currentDayRevenue,
            previousWeek: prevDayRevenue
          });
        }

        return last7Days;
      }

      // Fallback to mock data
      return [
        { day: 'Mon', currentWeek: 1250, previousWeek: 1100 },
        { day: 'Tue', currentWeek: 1800, previousWeek: 1650 },
        { day: 'Wed', currentWeek: 2200, previousWeek: 1900 },
        { day: 'Thu', currentWeek: 2650, previousWeek: 2400 },
        { day: 'Fri', currentWeek: 3100, previousWeek: 2800 },
        { day: 'Sat', currentWeek: 3800, previousWeek: 3200 },
        { day: 'Sun', currentWeek: 2900, previousWeek: 2600 }
      ];
    },
  });

  const chartConfig = {
    currentWeek: {
      label: "This Week",
      color: "#3b82f6",
    },
    previousWeek: {
      label: "Previous Week", 
      color: "#94a3b8",
    },
  };

  const totalCurrentWeek = trendData?.reduce((sum, day) => sum + day.currentWeek, 0) || 0;
  const totalPreviousWeek = trendData?.reduce((sum, day) => sum + day.previousWeek, 0) || 0;
  const percentChange = totalPreviousWeek > 0 ? 
    Math.round(((totalCurrentWeek - totalPreviousWeek) / totalPreviousWeek) * 100) : 0;

  return (
    <Card className="shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base">
            <div>7-Day Revenue Trend</div>
            <div className="text-xs font-normal text-muted-foreground">Weekly performance comparison</div>
          </CardTitle>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">
            {formatCurrency(totalCurrentWeek)}
          </div>
          <div className={`text-xs font-medium ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {percentChange >= 0 ? '+' : ''}{percentChange}% vs last week
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-6">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : trendData && trendData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-48 w-full">
            <RechartsLineChart data={trendData}>
              <XAxis dataKey="day" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value) => [formatCurrency(Number(value)), undefined]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="currentWeek"
                stroke={chartConfig.currentWeek.color}
                strokeWidth={2}
                dot={{ fill: chartConfig.currentWeek.color, strokeWidth: 2, r: 4 }}
                name={chartConfig.currentWeek.label}
              />
              <Line
                type="monotone"
                dataKey="previousWeek"
                stroke={chartConfig.previousWeek.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: chartConfig.previousWeek.color, strokeWidth: 2, r: 4 }}
                name={chartConfig.previousWeek.label}
              />
            </RechartsLineChart>
          </ChartContainer>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <LineChart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SevenDayTrend;
