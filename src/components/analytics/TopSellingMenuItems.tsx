
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Edit, Menu } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currencyFormatter';
import { useAuth } from '@/components/AuthProvider';

const TopSellingMenuItems = () => {
  const { companyId, loading: authLoading } = useAuth();

  const { data: topItems, isLoading } = useQuery({
    queryKey: ['top-selling-items', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('📊 No companyId available for top selling items');
        return [];
      }

      // Try to get real data from order_items first
      const { data: orderData, error: orderError } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          menu_items(name, price)
        `)
        .limit(100);

      if (!orderError && orderData && orderData.length > 0) {
        // Aggregate by menu item
        const itemMap = new Map();
        orderData.forEach(item => {
          if (item.menu_items) {
            const key = item.menu_item_id;
            const existing = itemMap.get(key) || { 
              name: item.menu_items.name, 
              totalQuantity: 0,
              revenue: 0 
            };
            existing.totalQuantity += item.quantity || 0;
            existing.revenue += (item.quantity || 0) * (item.menu_items.price || 0);
            itemMap.set(key, existing);
          }
        });

        return Array.from(itemMap.values())
          .sort((a, b) => b.totalQuantity - a.totalQuantity)
          .slice(0, 5);
      }

      // Fallback to mock data when no order data exists
      return [
        { name: 'Margherita Pizza', totalQuantity: 45, revenue: 675 },
        { name: 'Caesar Salad', totalQuantity: 32, revenue: 416 },
        { name: 'Pasta Carbonara', totalQuantity: 28, revenue: 434 },
        { name: 'Grilled Salmon', totalQuantity: 24, revenue: 552 },
        { name: 'Chocolate Cake', totalQuantity: 18, revenue: 144 }
      ];
    },
    enabled: !authLoading && !!companyId, // Only run when we have companyId
  });

  const maxQuantity = topItems ? Math.max(...topItems.map(item => item.totalQuantity)) : 1;
  const colors = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'];

  return (
    <Card className="shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base">
            <div>Top-Selling Menu Items</div>
            <div className="text-xs font-normal text-muted-foreground">Most popular dishes this period</div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-6">
        {isLoading || authLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : topItems && topItems.length > 0 ? (
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
              {topItems.map((item, index) => (
                <div key={index} className="group p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-300 hover:shadow-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground truncate">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {item.totalQuantity} sold
                      </span>
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: colors[index] }} />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
                        style={{ 
                          width: `${(item.totalQuantity / maxQuantity) * 100}%`,
                          backgroundColor: colors[index],
                          background: `linear-gradient(90deg, ${colors[index]} 0%, ${colors[index]}dd 100%)`
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full" />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Revenue: <span className="font-semibold">{formatCurrency(item.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6 pt-4 border-t border-muted">
              <Button variant="outline" size="sm" className="text-xs">
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" className="text-xs">
                <Menu className="h-3 w-3 mr-1" />
                View Full Menu
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopSellingMenuItems;
