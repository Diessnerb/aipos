import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TableMetrics {
  table_number: number;
  total_revenue: number;
  total_orders: number;
  utilization_rate: number;
  turnover_count: number;
}

interface PerformanceMetricsProps {
  tableMetrics: TableMetrics[];
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ tableMetrics }) => {
  const chartData = tableMetrics
    .slice(0, 10) // Show top 10 tables
    .map(table => ({
      table: `Table ${table.table_number}`,
      revenue: table.total_revenue,
      utilization: table.utilization_rate
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Table Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="table" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'revenue' ? `£${Number(value).toFixed(2)}` : `${Number(value).toFixed(1)}%`,
                  name === 'revenue' ? 'Revenue' : 'Utilization'
                ]}
              />
              <Bar 
                dataKey="revenue" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};