import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/currencyFormatter';
import { PoundSterling, TrendingUp, TrendingDown, Calendar, Target, BarChart3 } from 'lucide-react';

interface DetailedMetrics {
  companies: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    active: number;
    company_admins: number;
    regular_users: number;
  };
  orders: {
    total: number;
    monthly: number;
    avg_value: number;
  };
  revenue: {
    monthly: number;
    daily: number;
  };
  system_health: {
    db_connections: number;
    errors_24h: number;
    avg_response_ms: number;
    uptime_percent: number;
  };
  timestamp: string;
}

interface CompanyDetail {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  default_admin_email: string;
  created_at: string;
  updated_at: string;
  user_count: number;
  active_user_count: number;
  order_count: number;
  monthly_revenue: number;
  last_activity: string;
}

interface RevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  detailedMetrics: DetailedMetrics | null;
  companies: CompanyDetail[];
  loading?: boolean;
}

export const RevenueModal: React.FC<RevenueModalProps> = ({
  isOpen,
  onClose,
  detailedMetrics,
  companies,
  loading = false
}) => {
  const [timePeriod, setTimePeriod] = useState<string>('monthly');
  const [sortBy, setSortBy] = useState<string>('revenue');

  // Calculate additional metrics
  const totalRevenue = detailedMetrics?.revenue.monthly || 0;
  const dailyRevenue = detailedMetrics?.revenue.daily || 0;
  const averageOrderValue = detailedMetrics?.orders.avg_value || 0;
  const totalOrders = detailedMetrics?.orders.monthly || 0;

  // Calculate growth indicators (mock data for demonstration)
  const monthlyGrowth = 12.5; // Mock percentage
  const dailyGrowth = 8.3; // Mock percentage

  const sortedCompanies = [...companies]
    .filter(company => company.monthly_revenue > 0)
    .sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.monthly_revenue - a.monthly_revenue;
        case 'orders':
          return b.order_count - a.order_count;
        case 'avg_order':
          return (b.monthly_revenue / Math.max(b.order_count, 1)) - (a.monthly_revenue / Math.max(a.order_count, 1));
        default:
          return b.monthly_revenue - a.monthly_revenue;
      }
    });

  const topPerformers = sortedCompanies.slice(0, 5);

  if (loading || !detailedMetrics) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Revenue Analytics</DialogTitle>
            <DialogDescription>Loading revenue data...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PoundSterling className="h-5 w-5" />
            Revenue Analytics Dashboard
          </DialogTitle>
          <DialogDescription>
            Comprehensive revenue and financial performance metrics
          </DialogDescription>
        </DialogHeader>
        
        {/* Revenue Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">+{monthlyGrowth}%</span>
                  </div>
                </div>
                <PoundSterling className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Daily Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(dailyRevenue)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">+{dailyGrowth}%</span>
                  </div>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    <span className="text-xs text-red-600">-2.1%</span>
                  </div>
                </div>
                <Target className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">+15.2%</span>
                  </div>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="companies">By Company</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>
          
          <div className="mt-4 overflow-auto max-h-96">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Breakdown</CardTitle>
                    <CardDescription>Monthly performance summary</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Revenue</span>
                      <span className="font-bold text-lg">{formatCurrency(totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Orders</span>
                      <span className="font-semibold">{totalOrders}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Average Order Value</span>
                      <span className="font-semibold">{formatCurrency(averageOrderValue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Daily Average</span>
                      <span className="font-semibold">{formatCurrency(totalRevenue / 30)}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>Key performance indicators</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Revenue per Company</span>
                      <span className="font-semibold">
                        {formatCurrency(totalRevenue / Math.max(detailedMetrics.companies.active, 1))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Revenue per User</span>
                      <span className="font-semibold">
                        {formatCurrency(totalRevenue / Math.max(detailedMetrics.users.active, 1))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Orders per Company</span>
                      <span className="font-semibold">
                        {Math.round(totalOrders / Math.max(detailedMetrics.companies.active, 1))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Growth Rate (Monthly)</span>
                      <Badge className="bg-green-100 text-green-800">+{monthlyGrowth}%</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="companies" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Revenue by Company</h3>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">By Revenue</SelectItem>
                    <SelectItem value="orders">By Orders</SelectItem>
                    <SelectItem value="avg_order">By Avg Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-3">
                {topPerformers.map((company, index) => (
                  <Card key={company.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div>
                            <p className="font-semibold">{company.name}</p>
                            <p className="text-sm text-muted-foreground">{company.subdomain}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(company.monthly_revenue)}</p>
                          <p className="text-sm text-muted-foreground">
                            {company.order_count} orders
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Avg: {formatCurrency(company.monthly_revenue / Math.max(company.order_count, 1))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {sortedCompanies.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No revenue data available for companies
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="trends" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trends</CardTitle>
                    <CardDescription>Growth patterns and forecasts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Monthly Growth</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="font-semibold text-green-600">+{monthlyGrowth}%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Daily Growth</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="font-semibold text-green-600">+{dailyGrowth}%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Projected Monthly</span>
                      <span className="font-semibold">
                        {formatCurrency(totalRevenue * 1.125)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Order Trends</CardTitle>
                    <CardDescription>Volume and frequency analysis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Orders Growth</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-blue-600">+15.2%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Avg Orders/Day</span>
                      <span className="font-semibold">{Math.round(totalOrders / 30)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Peak Day Revenue</span>
                      <span className="font-semibold">{formatCurrency(dailyRevenue * 1.5)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};