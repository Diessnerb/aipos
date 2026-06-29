
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, Crown, UserPlus } from 'lucide-react';

const CustomerStats = () => {
  const { data: totalCustomers, isLoading: totalLoading } = useQuery({
    queryKey: ['total-customers-stat'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: newCustomersThisMonth, isLoading: newLoading } = useQuery({
    queryKey: ['new-customers-month'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      // Since we don't have a created_at field, we'll use last_visit as a proxy
      const { data, error } = await supabase
        .from('customers')
        .select('last_visit')
        .gte('last_visit', startOfMonth.toISOString().split('T')[0]);
      
      if (error) throw error;
      return data?.length || 0;
    },
  });

  const { data: customerTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['customer-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('visits, vip_status');
      
      if (error) throw error;
      
      const newCustomers = data?.filter(c => (c.visits || 0) <= 1).length || 0;
      const returningCustomers = data?.filter(c => (c.visits || 0) > 1).length || 0;
      
      return [
        { name: 'New Customers', value: newCustomers, color: '#3B82F6' },
        { name: 'Returning', value: returningCustomers, color: '#10B981' }
      ].filter(item => item.value > 0);
    },
  });

  const { data: vipCount, isLoading: vipLoading } = useQuery({
    queryKey: ['vip-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('vip_status', true);
      
      if (error) throw error;
      return count || 0;
    },
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-800">{data.name}</p>
          <p style={{ color: data.color }} className="font-medium">
            {data.value} customers
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-gradient-to-br from-white to-emerald-50/30 shadow-lg border-0 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-600/5 to-green-600/5 pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-800">Customer Statistics</div>
            <div className="text-xs text-gray-600">Customer base overview and insights</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Horizontal Layout - All content in a single row */}
        <div className="flex items-center gap-6">
          {/* Customer Metrics - Horizontal Layout */}
          <div className="flex gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 min-w-[140px]">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="text-xl font-bold text-blue-800">
                {totalLoading ? <Skeleton className="h-6 w-12 mx-auto" /> : totalCustomers}
              </div>
              <div className="text-xs text-blue-600 font-medium">Total Customers</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 min-w-[140px]">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserPlus className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="text-xl font-bold text-green-800">
                {newLoading ? <Skeleton className="h-6 w-12 mx-auto" /> : newCustomersThisMonth}
              </div>
              <div className="text-xs text-green-600 font-medium">New This Month</div>
            </div>
          </div>

          {/* VIP Status */}
          <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200 min-w-[140px]">
            <div className="flex justify-center mb-2">
              <div className="p-2 bg-amber-100 rounded-full">
                <Crown className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-xl font-bold text-amber-800">
              {vipLoading ? <Skeleton className="h-6 w-12 mx-auto" /> : vipCount}
            </div>
            <div className="text-xs text-amber-700 font-semibold mb-1">VIP Customers</div>
            <div className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
              {totalCustomers && vipCount ? 
                `${Math.round((vipCount / totalCustomers) * 100)}% of total` : 
                'Loading...'
              }
            </div>
          </div>

          {/* Customer Types Pie Chart */}
          <div className="flex-1 ml-4">
            <h4 className="text-xs font-semibold mb-2 text-slate-700 flex items-center gap-2">
              <div className="w-1 h-3 bg-gradient-to-b from-blue-500 to-emerald-500 rounded-full"></div>
              Customer Breakdown
            </h4>
            {typesLoading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : (
              <div className="bg-gradient-to-t from-slate-50/50 to-transparent p-3 rounded-xl">
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <defs>
                      <filter id="shadow">
                        <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                      </filter>
                    </defs>
                    <Pie
                      data={customerTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={45}
                      fill="#8884d8"
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={2}
                      filter="url(#shadow)"
                    >
                      {customerTypes?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerStats;
