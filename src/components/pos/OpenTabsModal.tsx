import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOpenTabs, OpenTab } from '@/hooks/useOpenTabs';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import { Clock, Users, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OpenTabsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTab: (orderId: string) => void;
}

const OpenTabRow = ({ 
  tab, 
  onClick 
}: { 
  tab: OpenTab; 
  onClick: () => void;
}) => {
  const elapsedMinutes = useElapsedTime(tab.createdAt);
  
  // Color coding based on elapsed time - extended thresholds for open tabs
  const getTimerColor = () => {
    if (elapsedMinutes <= 105) return 'text-green-600 dark:text-green-400';
    if (elapsedMinutes <= 120) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const displayName = tab.assignmentType === 'table' 
    ? `Table ${tab.tableNumber}`
    : tab.customerName || 'Walk-in';

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full grid gap-2 items-center px-3 py-2 hover:bg-accent/50 transition-colors text-left border-b last:border-b-0",
        tab.assignmentType === 'table' 
          ? "grid-cols-[90px_75px_95px_1fr]" 
          : "grid-cols-[120px_65px_95px_100px]"
      )}
    >
      {/* Assignment Badge */}
      <div className="flex items-center gap-1.5 font-medium text-sm">
        {tab.assignmentType === 'table' ? (
          <>
            <span className="text-xs">📋</span>
            <span className="truncate">{displayName}</span>
          </>
        ) : (
          <>
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{displayName}</span>
          </>
        )}
      </div>

      {/* Item Count */}
      <div className="text-sm text-muted-foreground text-center">
        {tab.itemCount} {tab.itemCount === 1 ? 'item' : 'items'}
      </div>

      {/* Total Amount / Split Status */}
      {tab.isSplit ? (
        <div className="text-right">
          <div className="text-sm font-semibold text-primary">
            Split {tab.paidSplits}/{tab.totalSplits}
          </div>
          <div className="text-xs text-muted-foreground">
            £{tab.amountPaid.toFixed(2)} / £{tab.totalAmount.toFixed(2)}
          </div>
        </div>
      ) : (
        <div className="text-right">
          {tab.amountPaid > 0 && tab.amountPaid < tab.totalAmount ? (
            <div>
              <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                £{tab.amountPaid.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                £{(tab.totalAmount - tab.amountPaid).toFixed(2)} left
              </div>
            </div>
          ) : (
            <div className="font-semibold">
              £{tab.totalAmount.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Timer */}
      <div className={cn("flex items-center gap-1 justify-center font-medium", getTimerColor())}>
        <Clock className="h-3.5 w-3.5" />
        <span>{elapsedMinutes} min</span>
      </div>
    </button>
  );
};

const EmptyState = ({ type }: { type: 'tables' | 'customers' }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
    {type === 'tables' ? (
      <UtensilsCrossed className="h-12 w-12 text-muted-foreground/50 mb-3" />
    ) : (
      <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
    )}
    <div className="font-medium text-muted-foreground">
      No {type === 'tables' ? 'Table' : 'Customer'} Orders
    </div>
    <div className="text-sm text-muted-foreground/70 mt-1">
      All {type} orders have been completed
    </div>
  </div>
);

export const OpenTabsModal = ({ open, onOpenChange, onSelectTab }: OpenTabsModalProps) => {
  const { data: tabs = [], isLoading } = useOpenTabs();
  const [activeTab, setActiveTab] = useState<'tables' | 'customers'>('tables');

  // Filter tabs by assignment type
  const tableTabs = tabs.filter(tab => tab.assignmentType === 'table');
  const customerTabs = tabs.filter(tab => tab.assignmentType === 'customer_name');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle>Open Tabs</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {tableTabs.length} {tableTabs.length === 1 ? 'table' : 'tables'} | {customerTabs.length} {customerTabs.length === 1 ? 'customer' : 'customers'}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-muted-foreground">Loading tabs...</div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tables' | 'customers')} className="w-full">
            <div className="px-4 pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tables" className="gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  Tables ({tableTabs.length})
                </TabsTrigger>
                <TabsTrigger value="customers" className="gap-2">
                  <Users className="h-4 w-4" />
                  Customers ({customerTabs.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tables" className="mt-0">
              <div className="h-[calc(80vh-160px)]">
                <ScrollArea className="h-full">
                  {tableTabs.length === 0 ? (
                    <EmptyState type="tables" />
                  ) : (
                    <div className="divide-y">
                      {tableTabs.map((tab) => (
                        <OpenTabRow
                          key={tab.orderId}
                          tab={tab}
                          onClick={() => {
                            onSelectTab(tab.orderId);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="customers" className="mt-0">
              <div className="h-[calc(80vh-160px)]">
                <ScrollArea className="h-full">
                  {customerTabs.length === 0 ? (
                    <EmptyState type="customers" />
                  ) : (
                    <div className="divide-y">
                      {customerTabs.map((tab) => (
                        <OpenTabRow
                          key={tab.orderId}
                          tab={tab}
                          onClick={() => {
                            onSelectTab(tab.orderId);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
