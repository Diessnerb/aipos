
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Plus, Edit, Trash2, Search, Crown, UserPlus, Clock, PoundSterling } from 'lucide-react';
import { useCurrencyFormatter } from '@/utils/currencyFormatter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const CustomerSegments = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { formatCurrency } = useCurrencyFormatter();

  // Optimize query with staleTime and limit
  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers-segments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, vip_status, last_visit, visits, total_spent')
        .order('created_at', { ascending: false })
        .limit(1000); // Reasonable limit for performance
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Memoize segment calculations to prevent unnecessary recalculations
  const segments = useMemo(() => {
    if (!customers) return [];

    const totalCustomers = customers.length;
    const vipCustomers = customers.filter(c => c.vip_status).length;
    const newCustomers = customers.filter(c => {
      const lastVisit = c.last_visit ? new Date(c.last_visit) : null;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastVisit && lastVisit > thirtyDaysAgo;
    }).length;
    const regularCustomers = customers.filter(c => (c.visits || 0) >= 5).length;
    const highValueCustomers = customers.filter(c => (c.total_spent || 0) > 500).length;
    const inactiveCustomers = customers.filter(c => {
      const lastVisit = c.last_visit ? new Date(c.last_visit) : null;
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return !lastVisit || lastVisit < threeMonthsAgo;
    }).length;

    return [
      {
        id: 'all',
        name: 'All Customers',
        description: 'Every customer in your database',
        count: totalCustomers,
        icon: Users,
        color: 'bg-blue-100 text-blue-800',
        criteria: 'All registered customers'
      },
      {
        id: 'vip',
        name: 'VIP Customers',
        description: 'Premium customers with special status',
        count: vipCustomers,
        icon: Crown,
        color: 'bg-yellow-100 text-yellow-800',
        criteria: 'Customers marked as VIP'
      },
      {
        id: 'new',
        name: 'New Customers',
        description: 'Recently acquired customers',
        count: newCustomers,
        icon: UserPlus,
        color: 'bg-green-100 text-green-800',
        criteria: 'Visited within last 30 days'
      },
      {
        id: 'regular',
        name: 'Regular Customers',
        description: 'Frequent visitors',
        count: regularCustomers,
        icon: Users,
        color: 'bg-purple-100 text-purple-800',
        criteria: '5+ visits'
      },
      {
        id: 'high-value',
        name: 'High Value Customers',
        description: 'Customers with high lifetime value',
        count: highValueCustomers,
        icon: PoundSterling,
        color: 'bg-emerald-100 text-emerald-800',
        criteria: 'Total spent > £500'
      },
      {
        id: 'inactive',
        name: 'Inactive Customers',
        description: 'Customers who haven\'t visited recently',
        count: inactiveCustomers,
        icon: Clock,
        color: 'bg-red-100 text-red-800',
        criteria: 'No visit in 3+ months'
      }
    ];
  }, [customers]);

  const filteredSegments = useMemo(() => {
    return segments.filter(segment =>
      segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      segment.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [segments, searchTerm]);

  // Memoize analytics calculations
  const analytics = useMemo(() => {
    if (!customers) return { total: 0, vip: 0, totalValue: 0 };
    
    return {
      total: customers.length,
      vip: customers.filter(c => c.vip_status).length,
      totalValue: customers.reduce((sum, c) => sum + (c.total_spent || 0), 0)
    };
  }, [customers]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Customer Segments</h2>
          <p className="text-gray-600">Organise customers into targeted groups</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Segment
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search segments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSegments.map((segment) => (
          <Card key={segment.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    <segment.icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{segment.name}</CardTitle>
                    <Badge className={segment.color}>
                      {segment.count} customers
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="mb-3">
                {segment.description}
              </CardDescription>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">
                  <strong>Criteria:</strong> {segment.criteria}
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    {segment.id !== 'all' && (
                      <Button variant="ghost" size="sm" className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    View Customers
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Segment Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Segment Insights</CardTitle>
          <CardDescription>
            Key metrics across customer segments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {analytics.total}
              </div>
              <p className="text-sm text-gray-600">Total Customers</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {analytics.vip}
              </div>
              <p className="text-sm text-gray-600">VIP Customers</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(analytics.totalValue)}
              </div>
              <p className="text-sm text-gray-600">Total Customer Value</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
