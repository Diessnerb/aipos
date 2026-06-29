import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, Users, Package, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAIContext } from '@/hooks/useAIContext';
import { cn } from '@/lib/utils';

interface SmartAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  priority: 'high' | 'medium' | 'low';
}

interface AISmartActionsProps {
  onActionClick?: (actionId: string) => void;
  className?: string;
}

export const AISmartActions: React.FC<AISmartActionsProps> = ({
  onActionClick,
  className,
}) => {
  const { context } = useAIContext();
  const [actions, setActions] = useState<SmartAction[]>([]);

  useEffect(() => {
    const generateSmartActions = () => {
      const newActions: SmartAction[] = [];
      const { currentPage, companyData } = context;

      // Generate page-specific smart actions
      if (currentPage === 'reservations' && companyData?.todayStats) {
        if (companyData.todayStats.reservationCount < 5) {
          newActions.push({
            id: 'low-bookings',
            title: 'Low bookings today',
            description: `Only ${companyData.todayStats.reservationCount} reservations. Send promotional message?`,
            icon: <Calendar className="h-4 w-4" />,
            action: () => onActionClick?.('low-bookings'),
            priority: 'high',
          });
        }

        if (companyData.upcomingReservations && companyData.upcomingReservations.length > 10) {
          newActions.push({
            id: 'optimize-tables',
            title: 'Optimize table assignments',
            description: 'AI can reorganize tables for better efficiency',
            icon: <TrendingUp className="h-4 w-4" />,
            action: () => onActionClick?.('optimize-tables'),
            priority: 'medium',
          });
        }
      }

      if (currentPage === 'customers' && companyData?.vipCustomers) {
        if (companyData.vipCustomers.length > 0) {
          newActions.push({
            id: 'vip-follow-up',
            title: 'Follow up with VIPs',
            description: `${companyData.vipCustomers.length} VIP customers need attention`,
            icon: <Users className="h-4 w-4" />,
            action: () => onActionClick?.('vip-follow-up'),
            priority: 'medium',
          });
        }
      }

      if (currentPage === 'inventory' && companyData?.lowStockItems) {
        if (companyData.lowStockItems.length > 0) {
          newActions.push({
            id: 'reorder-items',
            title: 'Reorder low stock items',
            description: `${companyData.lowStockItems.length} items need reordering`,
            icon: <Package className="h-4 w-4" />,
            action: () => onActionClick?.('reorder-items'),
            priority: 'high',
          });
        }
      }

      setActions(newActions);
    };

    generateSmartActions();
  }, [context, onActionClick]);

  if (actions.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-[hsl(var(--ai-alert))]';
      case 'medium':
        return 'border-[hsl(var(--ai-suggestion))]';
      default:
        return 'border-[hsl(var(--ai-primary))]';
    }
  };

  return (
    <Card className={cn('p-4 space-y-3', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-[hsl(var(--ai-primary))]" />
        <h3 className="font-semibold text-sm">AI Suggestions</h3>
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.action}
            className={cn(
              'w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md',
              'bg-card hover:bg-accent',
              getPriorityColor(action.priority)
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 text-[hsl(var(--ai-primary))]">
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm mb-1">{action.title}</h4>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
};
