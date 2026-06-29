import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Mail, Phone, Truck } from 'lucide-react';
import { useSupplierCategories } from '@/hooks/useSupplierCategories';
import type { Supplier } from '@/types/delivery';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: () => void;
}

export const SupplierCard: React.FC<SupplierCardProps> = ({ supplier, onEdit }) => {
  const { categories } = useSupplierCategories();
  
  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    
    const colorMap = {
      green: 'bg-green-100 text-green-800',
      amber: 'bg-amber-100 text-amber-800',
      purple: 'bg-purple-100 text-purple-800',
      blue: 'bg-blue-100 text-blue-800',
      orange: 'bg-orange-100 text-orange-800',
      gray: 'bg-gray-100 text-gray-800',
    };

    const colorScheme = category?.color_scheme || 'gray';
    return colorMap[colorScheme as keyof typeof colorMap] || colorMap.gray;
  };

  const getOrderMethodIcon = (method: string) => {
    switch (method) {
      case 'email':
        return <Mail className="h-3 w-3" />;
      case 'phone':
        return <Phone className="h-3 w-3" />;
      default:
        return <Truck className="h-3 w-3" />;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">{supplier.name}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <Badge className={getCategoryColor(supplier.category)}>
            {supplier.category.charAt(0).toUpperCase() + supplier.category.slice(1)}
          </Badge>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getOrderMethodIcon(supplier.order_method)}
            <span className="capitalize">{supplier.order_method} Orders</span>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">
              {supplier.scheduling_mode === 'lead_time' ? (
                <>Lead Time: <span className="font-medium">{supplier.lead_time_days} days</span></>
              ) : (
                <>Scheduling: <span className="font-medium">Fixed Schedule</span></>
              )}
            </span>
          </div>

          {supplier.contact_name && (
            <div className="text-sm">
              <span className="text-muted-foreground">Contact:</span>{' '}
              <span className="font-medium">{supplier.contact_name}</span>
            </div>
          )}

          {supplier.email && (
            <div className="text-sm">
              <span className="text-muted-foreground">Email:</span>{' '}
              <span className="font-medium truncate">{supplier.email}</span>
            </div>
          )}

          {!supplier.is_active && (
            <Badge variant="destructive">Inactive</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
