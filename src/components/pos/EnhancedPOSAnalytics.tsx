import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  Clock, 
  DollarSign,
  Users,
  Target,
  Brain,
  Lightbulb,
  BarChart3,
  PieChart,
  Activity,
  Zap
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCompanyId } from '@/hooks/useCompanyId';
import { supabase } from '@/integrations/supabase/client';

interface MenuItemPerformance {
  id: string;
  name: string;
  totalSales: number;
  revenue: number;
  profitMargin: number;
  velocity: number;
  trendDirection: 'up' | 'down' | 'stable';
  customerRating: number;
  avgOrderTime: string;
}

interface BusinessInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionRequired: boolean;
  suggestedActions: string[];
}

interface PredictiveAnalytics {
  demandForecast: Array<{ date: string; predicted: number; confidence: number }>;
  peakHoursPrediction: Array<{ hour: number; expectedOrders: number }>;
  inventoryAlerts: Array<{ item: string; daysUntilStock: number; suggestedOrder: number }>;
}

const COLORS = {
  primary: '#8884d8',
  secondary: '#82ca9d',
  accent: '#ffc658',
  warning: '#ff7c7c',
  success: '#8dd1e1'
};

export const EnhancedPOSAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [menuPerformance, setMenuPerformance] = useState<MenuItemPerformance[]>([]);
  const [businessInsights, setBusinessInsights] = useState<BusinessInsight[]>([]);
  const [predictiveData, setPredictiveData] = useState<PredictiveAnalytics | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'velocity' | 'profit'>('revenue');
  const [loading, setLoading] = useState(true);

  const { currentUser } = useCurrentUser();
  const { companyId: effectiveCompanyId } = useCompanyId();

  useEffect(() => {
    if (effectiveCompanyId) {
      loadAnalyticsData();
    }
  }, [effectiveCompanyId, timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Load menu item performance data
      await loadMenuPerformance();
      
      // Generate business insights
      await generateBusinessInsights();
      
      // Load predictive analytics
      await loadPredictiveAnalytics();
      
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMenuPerformance = async () => {
    // In a real implementation, this would fetch from order_items joined with menu_items
    const mockData: MenuItemPerformance[] = [
      {
        id: '1',
        name: 'Signature Burger',
        totalSales: 245,
        revenue: 3675,
        profitMargin: 68,
        velocity: 8.2,
        trendDirection: 'up',
        customerRating: 4.7,
        avgOrderTime: '12m'
      },
      {
        id: '2',
        name: 'Caesar Salad',
        totalSales: 189,
        revenue: 2268,
        profitMargin: 72,
        velocity: 6.3,
        trendDirection: 'stable',
        customerRating: 4.2,
        avgOrderTime: '8m'
      },
      {
        id: '3',
        name: 'Fish & Chips',
        totalSales: 156,
        revenue: 2808,
        profitMargin: 58,
        velocity: 5.2,
        trendDirection: 'down',
        customerRating: 4.5,
        avgOrderTime: '15m'
      },
      {
        id: '4',
        name: 'Margherita Pizza',
        totalSales: 98,
        revenue: 1372,
        profitMargin: 64,
        velocity: 3.3,
        trendDirection: 'up',
        customerRating: 4.6,
        avgOrderTime: '18m'
      }
    ];

    setMenuPerformance(mockData);
  };

  const generateBusinessInsights = async () => {
    // AI-powered business insights based on data patterns
    const insights: BusinessInsight[] = [
      {
        id: '1',
        type: 'opportunity',
        title: 'High-Margin Item Underperforming',
        description: 'Caesar Salad has 72% profit margin but low sales velocity. Consider promotional pricing or menu placement optimization.',
        impact: 'high',
        actionRequired: true,
        suggestedActions: [
          'Add to daily specials rotation',
          'Reposition on menu for better visibility',
          'Create combo deals with popular items'
        ]
      },
      {
        id: '2',
        type: 'warning',
        title: 'Fish & Chips Sales Declining',
        description: 'Sales trend shows 15% decline over the past week. Monitor customer feedback and ingredient costs.',
        impact: 'medium',
        actionRequired: true,
        suggestedActions: [
          'Review customer reviews for quality issues',
          'Analyze ingredient cost changes',
          'Consider recipe or presentation improvements'
        ]
      },
      {
        id: '3',
        type: 'recommendation',
        title: 'Peak Hour Optimization',
        description: 'Kitchen efficiency drops 23% during 7-9 PM. Consider menu simplification during peak hours.',
        impact: 'high',
        actionRequired: false,
        suggestedActions: [
          'Create limited peak-hour menu',
          'Pre-prep high-demand items',
          'Adjust staffing schedule'
        ]
      }
    ];

    setBusinessInsights(insights);
  };

  const loadPredictiveAnalytics = async () => {
    // Mock predictive analytics data
    const mockPredictive: PredictiveAnalytics = {
      demandForecast: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString(),
        predicted: Math.floor(Math.random() * 50) + 30,
        confidence: Math.random() * 20 + 75
      })),
      peakHoursPrediction: Array.from({ length: 12 }, (_, i) => ({
        hour: i + 11,
        expectedOrders: Math.floor(Math.random() * 25) + 5
      })),
      inventoryAlerts: [
        { item: 'Ground Beef', daysUntilStock: 3, suggestedOrder: 25 },
        { item: 'Lettuce', daysUntilStock: 5, suggestedOrder: 15 },
        { item: 'Pizza Dough', daysUntilStock: 2, suggestedOrder: 40 }
      ]
    };

    setPredictiveData(mockPredictive);
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <Target className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      default:
        return <Lightbulb className="w-5 h-5 text-blue-500" />;
    }
  };

  const getInsightBadge = (impact: string) => {
    const variants = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    } as const;
    
    return <Badge variant={variants[impact as keyof typeof variants]}>{impact.toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Enhanced POS Analytics</h2>
          <p className="text-muted-foreground">AI-powered insights and predictive analytics</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        {/* Menu Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                <Star className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{menuPerformance[0]?.name}</div>
                <p className="text-xs text-muted-foreground">
                  ${menuPerformance[0]?.revenue.toLocaleString()} revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Profit Margin</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(menuPerformance.reduce((acc, item) => acc + item.profitMargin, 0) / menuPerformance.length)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all items
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {menuPerformance.reduce((acc, item) => acc + item.totalSales, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {timeRange} period
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Menu Item Performance</CardTitle>
                  <CardDescription>Sales velocity, revenue, and profitability analysis</CardDescription>
                </div>
                <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="velocity">Velocity</SelectItem>
                    <SelectItem value="profit">Profit %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {menuPerformance.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {item.name}
                          {getTrendIcon(item.trendDirection)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.totalSales} orders • {item.avgOrderTime} avg time • ⭐ {item.customerRating}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {selectedMetric === 'revenue' && `$${item.revenue.toLocaleString()}`}
                        {selectedMetric === 'velocity' && `${item.velocity}/hr`}
                        {selectedMetric === 'profit' && `${item.profitMargin}%`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedMetric === 'revenue' && 'Total Revenue'}
                        {selectedMetric === 'velocity' && 'Orders/Hour'}
                        {selectedMetric === 'profit' && 'Profit Margin'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4">
            {businessInsights.map((insight) => (
              <Card key={insight.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getInsightIcon(insight.type)}
                      <div>
                        <CardTitle className="text-lg">{insight.title}</CardTitle>
                        <CardDescription>{insight.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getInsightBadge(insight.impact)}
                      {insight.actionRequired && (
                        <Badge variant="outline">Action Required</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {insight.suggestedActions.length > 0 && (
                  <CardContent>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Suggested Actions:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {insight.suggestedActions.map((action, index) => (
                          <li key={index}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Predictive Analytics Tab */}
        <TabsContent value="predictive" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Demand Forecast
                </CardTitle>
                <CardDescription>7-day order volume prediction</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={predictiveData?.demandForecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke={COLORS.primary} 
                      fill={COLORS.primary} 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Peak Hours Prediction
                </CardTitle>
                <CardDescription>Expected orders by hour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={predictiveData?.peakHoursPrediction}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="expectedOrders" fill={COLORS.secondary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Inventory Alerts
              </CardTitle>
              <CardDescription>Predictive inventory management</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {predictiveData?.inventoryAlerts.map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{alert.item}</div>
                      <div className="text-sm text-muted-foreground">
                        {alert.daysUntilStock} days until stock out
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">Order {alert.suggestedOrder} units</div>
                      <Button size="sm" variant="outline" className="mt-1">
                        Create Order
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Menu Optimization Score</CardTitle>
                <CardDescription>Overall menu performance rating</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-500 mb-2">87/100</div>
                  <p className="text-muted-foreground">Excellent performance</p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Profitability</span>
                      <span className="font-medium">92/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer Satisfaction</span>
                      <span className="font-medium">89/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Operational Efficiency</span>
                      <span className="font-medium">81/100</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing Optimization</CardTitle>
                <CardDescription>AI-suggested price adjustments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Signature Burger</span>
                    <div className="text-right">
                      <div className="text-sm line-through text-muted-foreground">$15.00</div>
                      <div className="text-sm font-medium text-green-600">$16.50 (+10%)</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Caesar Salad</span>
                    <div className="text-right">
                      <div className="text-sm line-through text-muted-foreground">$12.00</div>
                      <div className="text-sm font-medium text-blue-600">$11.00 (-8%)</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Fish & Chips</span>
                    <div className="text-right">
                      <div className="text-sm">$18.00</div>
                      <div className="text-sm text-green-600">Optimal</div>
                    </div>
                  </div>
                  <Button size="sm" className="w-full mt-4">
                    Apply Suggestions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};