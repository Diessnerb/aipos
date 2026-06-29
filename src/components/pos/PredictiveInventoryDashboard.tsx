import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Package, Clock, DollarSign } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface InventoryPrediction {
  itemId: string;
  itemName: string;
  currentStock: number;
  dailyUsage: number;
  daysRemaining: number;
  predictedOutDate: Date;
  seasonalFactor: number;
  reorderPoint: number;
  suggestedOrderQuantity: number;
  cost: number;
  priority: 'high' | 'medium' | 'low';
  trend: 'increasing' | 'decreasing' | 'stable';
  forecast: Array<{ date: string; stock: number; usage: number }>;
}

export const PredictiveInventoryDashboard: React.FC = () => {
  const [predictions, setPredictions] = useState<InventoryPrediction[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [criticalItems, setCriticalItems] = useState(0);

  useEffect(() => {
    loadInventoryPredictions();
  }, []);

  const loadInventoryPredictions = async () => {
    // Mock data - in real implementation, this would come from AI analysis
    const mockPredictions: InventoryPrediction[] = [
      {
        itemId: '1',
        itemName: 'Ground Beef (80/20)',
        currentStock: 15,
        dailyUsage: 8.5,
        daysRemaining: 2,
        predictedOutDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        seasonalFactor: 1.2,
        reorderPoint: 20,
        suggestedOrderQuantity: 50,
        cost: 6.50,
        priority: 'high',
        trend: 'increasing',
        forecast: generateForecast(15, 8.5)
      },
      {
        itemId: '2',
        itemName: 'Fresh Lettuce',
        currentStock: 12,
        dailyUsage: 4.2,
        daysRemaining: 3,
        predictedOutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        seasonalFactor: 0.9,
        reorderPoint: 8,
        suggestedOrderQuantity: 25,
        cost: 2.80,
        priority: 'high',
        trend: 'stable',
        forecast: generateForecast(12, 4.2)
      },
      {
        itemId: '3',
        itemName: 'Pizza Dough',
        currentStock: 8,
        dailyUsage: 12.0,
        daysRemaining: 1,
        predictedOutDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        seasonalFactor: 1.1,
        reorderPoint: 15,
        suggestedOrderQuantity: 40,
        cost: 1.25,
        priority: 'high',
        trend: 'increasing',
        forecast: generateForecast(8, 12.0)
      },
      {
        itemId: '4',
        itemName: 'Chicken Breast',
        currentStock: 25,
        dailyUsage: 6.8,
        daysRemaining: 4,
        predictedOutDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        seasonalFactor: 1.0,
        reorderPoint: 18,
        suggestedOrderQuantity: 35,
        cost: 4.20,
        priority: 'medium',
        trend: 'stable',
        forecast: generateForecast(25, 6.8)
      }
    ];

    setPredictions(mockPredictions);
    setTotalValue(mockPredictions.reduce((acc, item) => acc + (item.suggestedOrderQuantity * item.cost), 0));
    setCriticalItems(mockPredictions.filter(item => item.daysRemaining <= 2).length);
  };

  const generateForecast = (currentStock: number, dailyUsage: number) => {
    const forecast = [];
    let stock = currentStock;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
      const adjustedUsage = dailyUsage * (1 + variation);
      
      forecast.push({
        date: date.toLocaleDateString(),
        stock: Math.max(0, stock),
        usage: adjustedUsage
      });
      
      stock -= adjustedUsage;
    }
    
    return forecast;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    } as const;
    
    return <Badge variant={variants[priority as keyof typeof variants]}>{priority.toUpperCase()}</Badge>;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingUp className="w-4 h-4 text-green-500 rotate-180" />;
      default:
        return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
    }
  };

  const handleCreateOrder = (item: InventoryPrediction) => {
    // In real implementation, this would create an order
    console.log('Creating order for:', item.itemName, 'Quantity:', item.suggestedOrderQuantity);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalItems}</div>
            <p className="text-xs text-muted-foreground">≤2 days remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{predictions.length}</div>
            <p className="text-xs text-muted-foreground">Being monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Value</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Suggested orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Review</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6h</div>
            <p className="text-xs text-muted-foreground">Auto-refresh</p>
          </CardContent>
        </Card>
      </div>

      {/* Predictions List */}
      <div className="space-y-4">
        {predictions.map((item) => (
          <Card key={item.itemId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getPriorityColor(item.priority)}`} />
                  <div>
                    <CardTitle className="text-lg">{item.itemName}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      Current: {item.currentStock} units • Usage: {item.dailyUsage}/day • 
                      {getTrendIcon(item.trend)}
                      <span className="capitalize">{item.trend}</span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(item.priority)}
                  <Badge variant="outline">
                    {item.daysRemaining} days left
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stock Level Progress */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Stock Level</span>
                    <span>{item.currentStock} / {item.reorderPoint}</span>
                  </div>
                  <Progress 
                    value={(item.currentStock / item.reorderPoint) * 100} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground">
                    Reorder at {item.reorderPoint} units
                  </div>
                </div>

                {/* Forecast Chart */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">7-Day Forecast</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={item.forecast}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="stock" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Order Suggestion */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Order Suggestion</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Quantity:</span>
                      <span className="font-medium">{item.suggestedOrderQuantity} units</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Cost:</span>
                      <span className="font-medium">${(item.suggestedOrderQuantity * item.cost).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Order by:</span>
                      <span className="font-medium text-red-600">
                        {new Date(Date.now() + (item.daysRemaining - 1) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full mt-2"
                      variant={item.priority === 'high' ? 'default' : 'outline'}
                      onClick={() => handleCreateOrder(item)}
                    >
                      Create Order
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>Manage multiple inventory items at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              Order All Critical Items
            </Button>
            <Button variant="outline" size="sm">
              Export Predictions
            </Button>
            <Button variant="outline" size="sm">
              Set Custom Alerts
            </Button>
            <Button variant="outline" size="sm">
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};