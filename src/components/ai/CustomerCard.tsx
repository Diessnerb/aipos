import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCircle, Phone, Mail, Calendar, Star, Edit, Plus, History } from 'lucide-react';

interface CustomerCardProps {
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    visits?: number;
    last_visit?: string;
    vip_status?: boolean;
    preferences?: string[];
    notes?: string;
  };
  onAction?: (action: 'edit' | 'add-reservation' | 'view-history', customerId: string) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onAction }) => {
  return (
    <Card className="p-4 space-y-4 bg-gradient-to-br from-background to-muted/20 border-primary/20 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{customer.name}</h3>
              {customer.vip_status && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">Customer Profile</p>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="grid grid-cols-2 gap-3">
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{customer.phone}</span>
          </div>
        )}
        {customer.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{customer.email}</span>
          </div>
        )}
        {customer.visits !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-muted-foreground" />
            <span>{customer.visits} visits</span>
          </div>
        )}
        {customer.last_visit && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{new Date(customer.last_visit).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Preferences */}
      {customer.preferences && customer.preferences.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Preferences:</p>
          <div className="flex flex-wrap gap-1">
            {customer.preferences.map((pref, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
              >
                {pref}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {customer.notes && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Notes:</p>
          <p className="text-sm bg-muted/50 p-2 rounded">{customer.notes}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onAction?.('edit', customer.id)}
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onAction?.('add-reservation', customer.id)}
        >
          <Plus className="h-3 w-3 mr-1" />
          New Reservation
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAction?.('view-history', customer.id)}
        >
          <History className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
};
