import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, RefreshCw } from 'lucide-react';

interface TableRevenueCardProps {
  tableNumber: number;
  revenue: number;
  orders: number;
  utilizationRate: number;
  turnoverCount: number;
}

export const TableRevenueCard: React.FC<TableRevenueCardProps> = ({
  tableNumber,
  revenue,
  orders,
  utilizationRate,
  turnoverCount
}) => {
  const getUtilizationColor = (rate: number) => {
    if (rate >= 80) return 'bg-emerald-500';
    if (rate >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getUtilizationText = (rate: number) => {
    if (rate >= 80) return 'High';
    if (rate >= 60) return 'Medium';
    return 'Low';
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Table {tableNumber}
          </CardTitle>
          <Badge 
            variant="secondary" 
            className={`text-white ${getUtilizationColor(utilizationRate)}`}
          >
            {getUtilizationText(utilizationRate)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Revenue */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-sm text-muted-foreground">Revenue</span>
          </div>
          <span className="font-semibold text-emerald-600">
            £{revenue.toFixed(2)}
          </span>
        </div>

        {/* Orders */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Orders</span>
          </div>
          <span className="font-semibold text-blue-600">{orders}</span>
        </div>

        {/* Turnover */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-muted-foreground">Turnovers</span>
          </div>
          <span className="font-semibold text-orange-600">{turnoverCount}</span>
        </div>

        {/* Utilization Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Utilization</span>
            <span>{utilizationRate.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getUtilizationColor(utilizationRate)}`}
              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Average Order Value */}
        {orders > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Avg. Order</span>
              <span className="font-medium">£{(revenue / orders).toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};