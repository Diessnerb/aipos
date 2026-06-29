
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChefHat } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyFormatter';
import { useAuth } from '@/components/AuthProvider';

const MenuPerformance = () => {
  const { companyId, loading: authLoading } = useAuth();

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items-performance', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('📊 No companyId available for menu performance');
        return [];
      }

      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      
      if (error) throw error;
      
      // For now, we'll simulate some popularity data
      // In the future, this would come from order_items joins
      const colors = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'];
      return data?.slice(0, 5).map((item, index) => ({
        name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
        orders: Math.floor(Math.random() * 50) + 10, // Simulated data
        price: Number(item.price) || 0,
        color: colors[index % colors.length]
      })) || [];
    },
    enabled: !authLoading && !!companyId, // Only run when we have companyId
  });

  const { data: categoryAverages, isLoading: categoryLoading } = useQuery({
    queryKey: ['category-averages', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('📊 No companyId available for category averages');
        return [];
      }

      const { data, error } = await supabase
        .from('menu_items')
        .select('category_id, price')
        .eq('company_id', companyId)
        .not('price', 'is', null);
      
      if (error) throw error;
      
      const categoryMap = new Map();
      
      data?.forEach(item => {
        const category = item.category_id || 'Other';
        const price = Number(item.price) || 0;
        
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { total: 0, count: 0 });
        }
        
        const current = categoryMap.get(category);
        current.total += price;
        current.count += 1;
      });
      
      const colors = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
      return Array.from(categoryMap.entries()).map(([category, data], index) => ({
        category: category.length > 10 ? category.substring(0, 10) + '...' : category,
        avgPrice: data.total / data.count,
        color: colors[index % colors.length]
      }));
    },
    enabled: !authLoading && !!companyId, // Only run when we have companyId
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200">
          <p className="font-medium text-slate-800">{label}</p>
          <p className="text-blue-600 font-semibold">
            {payload[0].dataKey === 'orders' ? `${payload[0].value} orders` : formatCurrency(payload[0].value)}
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
            <ChefHat className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base">
            <div>Menu Performance</div>
            <div className="text-xs font-normal text-muted-foreground">Analytics ready for order integration</div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        {/* Top Menu Items */}
        <div>
          <h4 className="text-sm font-semibold mb-4 text-slate-700 flex items-center gap-2">
            <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
            Top 5 Items (Simulated Data)
          </h4>
          {menuLoading || authLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : (
            <div className="bg-gradient-to-t from-blue-50/50 to-transparent p-4 rounded-xl">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={menuItems} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={80} 
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                    {menuItems?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Averages */}
        <div>
          <h4 className="text-sm font-semibold mb-4 text-slate-700 flex items-center gap-2">
            <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-green-500 rounded-full"></div>
            Average Price by Category
          </h4>
          {categoryLoading || authLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : (
            <div className="bg-gradient-to-t from-emerald-50/50 to-transparent p-4 rounded-xl">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryAverages} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={(value) => [formatCurrency(Number(value)), 'Avg Price']} 
                  />
                  <Bar dataKey="avgPrice" radius={[6, 6, 0, 0]}>
                    {categoryAverages?.map((entry, index) => (
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

export default MenuPerformance;
