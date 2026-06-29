import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useWastage } from '@/hooks/useWastage';
import { useIngredients } from '@/hooks/useIngredients';
import { format, parse } from 'date-fns';
import type { WastageLog } from '@/types/delivery-db';
import { WastageDateFilter } from '@/components/wastage/WastageDateFilter';
import { WastageDateRangeModal } from '@/components/wastage/WastageDateRangeModal';

const WastagePage: React.FC = () => {
  const [expandedMenuItems, setExpandedMenuItems] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState<'last_day' | 'last_7_days' | 'custom' | 'all'>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  
  // Calculate date range based on filter
  const getDateRange = (): { startDate?: string; endDate?: string } => {
    const now = new Date();
    
    if (dateFilter === 'last_day') {
      // Today only: midnight to end of today
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      console.log('📅 Date Range (Last Day / Today):', { 
        start: startOfToday.toISOString(), 
        end: endOfToday.toISOString() 
      });
      return {
        startDate: startOfToday.toISOString(),
        endDate: endOfToday.toISOString(),
      };
    }
    
    if (dateFilter === 'last_7_days') {
      // End = end of today
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      // Start = 6 days before today, at 00:00 (so 7 full days: today + previous 6)
      const startOfRange = new Date(endOfToday);
      startOfRange.setDate(startOfRange.getDate() - 6);
      startOfRange.setHours(0, 0, 0, 0);

      console.log('📅 Date Range (Last 7 Days):', { 
        start: startOfRange.toISOString(), 
        end: endOfToday.toISOString() 
      });
      return {
        startDate: startOfRange.toISOString(),
        endDate: endOfToday.toISOString(),
      };
    }
    
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      console.log('📅 Date Range (Custom):', { 
        start: start.toISOString(), 
        end: end.toISOString() 
      });
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      };
    }
    
    console.log('📅 Date Range (All Time): No filter');
    return {};
  };

  const dateRange = getDateRange();
  const { wastageLogs, getWastageStats } = useWastage(dateRange);
  const { ingredients } = useIngredients();
  
  const stats = getWastageStats();

  const handleCustomRangeApply = (startDate: Date, endDate: Date) => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    setDateFilter('custom');
  };

  // Reason emojis
  const reasonEmojis: Record<string, string> = {
    expired: '🗓️',
    damaged: '💔',
    overproduction: '🍽️',
    customer_return: '↩️',
    other: '❓'
  };

  // Extract menu item from notes
  const extractMenuItemFromNotes = (notes: string | null): { menuItem: string; quantity: number } | null => {
    if (!notes) return null;
    const match = notes.match(/Menu: ([^(]+)\(×(\d+)\)/);
    if (!match) return null;
    return { menuItem: match[1].trim(), quantity: parseInt(match[2]) };
  };

  // Round timestamp to nearest second for grouping ingredients from same wastage event
  const roundToSecond = (timestamp: string) => {
    const date = new Date(timestamp);
    date.setMilliseconds(0);
    return date.toISOString();
  };

  // Group wastage by date, then by menu item instance
  const groupedWastage = wastageLogs.reduce((acc, log) => {
    const dateKey = format(new Date(log.wastage_time), 'dd/MM/yyyy');
    if (!acc[dateKey]) acc[dateKey] = { menuItems: {}, directWastage: [] };
    
    const menuInfo = extractMenuItemFromNotes(log.notes);
    
    if (menuInfo) {
      // Use batch ID if available, otherwise fall back to timestamp grouping
      const batchId = (log as any).wastage_batch_id;
      const instanceKey = batchId 
        ? `batch_${batchId}`
        : `${menuInfo.menuItem}_${roundToSecond(log.wastage_time)}_${log.reason}_${log.location}`;
      
      if (!acc[dateKey].menuItems[instanceKey]) {
        acc[dateKey].menuItems[instanceKey] = {
          menuItemName: menuInfo.menuItem,
          quantity: menuInfo.quantity,
          timestamp: log.wastage_time,
          reason: log.reason,
          location: log.location,
          ingredients: [],
          totalCost: 0
        };
      }
      
      // Add ingredient to this menu item instance
      acc[dateKey].menuItems[instanceKey].ingredients.push(log);
      acc[dateKey].menuItems[instanceKey].totalCost += log.cost_impact || 0;
    } else {
      // Direct ingredient wastage (no menu item)
      acc[dateKey].directWastage.push(log);
    }
    
    return acc;
  }, {} as Record<string, { menuItems: Record<string, any>, directWastage: WastageLog[] }>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedWastage).sort((a, b) => {
    const dateA = parse(a, 'dd/MM/yyyy', new Date());
    const dateB = parse(b, 'dd/MM/yyyy', new Date());
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🗑️ Wastage Dashboard</h1>
        <p className="text-muted-foreground">Track and analyze wastage across your restaurant</p>
      </div>

      <WastageDateFilter
        filter={dateFilter}
        onFilterChange={setDateFilter}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onCustomRangeClick={() => setIsDateModalOpen(true)}
      />

      <WastageDateRangeModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={handleCustomRangeApply}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">£{stats.totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kitchen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">£{stats.kitchenCost.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">£{stats.barCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wastage by Date</CardTitle>
        </CardHeader>
        <CardContent>
          {wastageLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No wastage logged yet. Items marked as wastage from the POS or Kitchen will appear here.
            </p>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {sortedDates.map(dateKey => {
                const dayData = groupedWastage[dateKey];
                const menuItemInstances = Object.values(dayData.menuItems);
                const totalDayCost = [
                  ...menuItemInstances.map((m: any) => m.totalCost),
                  ...dayData.directWastage.map(w => w.cost_impact || 0)
                ].reduce((sum, cost) => sum + cost, 0);
                
                return (
                  <AccordionItem key={dateKey} value={dateKey} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-semibold text-base">{dateKey}</span>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {menuItemInstances.length > 0 && (
                            <span>{menuItemInstances.length} menu item{menuItemInstances.length !== 1 ? 's' : ''}</span>
                          )}
                          {dayData.directWastage.length > 0 && (
                            <span>• {dayData.directWastage.length} ingredient{dayData.directWastage.length !== 1 ? 's' : ''}</span>
                          )}
                          <span className="font-bold text-destructive">£{totalDayCost.toFixed(2)}</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-4 pb-4 space-y-2">
                      {/* Menu Item Wastage */}
                      {menuItemInstances.map((instance: any) => {
                        const instanceKey = `${instance.menuItemName}_${instance.timestamp}`;
                        const isExpanded = expandedMenuItems[instanceKey];
                        
                        return (
                          <div key={instanceKey} className="border rounded-lg">
                            {/* Menu Item Header (Clickable) */}
                            <div 
                              className="flex justify-between items-center p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => setExpandedMenuItems(prev => ({
                                ...prev,
                                [instanceKey]: !prev[instanceKey]
                              }))}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <div>
                                  <p className="font-semibold text-base">{instance.menuItemName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    ×{instance.quantity} • {instance.location} • 
                                    {reasonEmojis[instance.reason] || '📝'} {instance.reason.replace('_', ' ')} • 
                                    {format(new Date(instance.timestamp), 'HH:mm')}
                                    {(() => {
                                      const loggedByName = (instance.ingredients || []).find((ing: WastageLog) => ing.logged_by_user?.full_name)?.logged_by_user?.full_name;
                                      return loggedByName ? <> • Logged by: {loggedByName}</> : null;
                                    })()}
                                  </p>
                                </div>
                              </div>
                              {instance.totalCost === 0 ? (
                                <span className="text-sm text-muted-foreground italic">
                                  (Cost data unavailable)
                                </span>
                              ) : (
                                <span className="text-lg font-bold text-destructive">
                                  £{instance.totalCost.toFixed(2)}
                                </span>
                              )}
                            </div>
                            
                            {/* Ingredient Breakdown (Expandable) */}
                            {isExpanded && (
                              <div className="border-t bg-muted/20 p-3 space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Ingredients Wasted:</p>
                                {(instance.ingredients || []).map((ing: WastageLog) => {
                                  const ingredient = ing.ingredient || ingredients.find(i => i.id === ing.ingredient_id);
                                  const ingredientName = ingredient?.name || 'Unknown Ingredient';
                                  
                                  return (
                                    <div key={ing.id} className="flex justify-between items-center py-2 px-3 bg-background rounded border-l-2 border-destructive/30">
                                      <div>
                                        <p className="font-medium text-sm">{ingredientName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {ing.quantity} {ing.unit}
                                          {ingredient?.supplier && ` • Supplier: ${ingredient.supplier}`}
                                        </p>
                                      </div>
                                      <span className="text-sm font-semibold text-destructive">
                                        £{(ing.cost_impact || 0).toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Direct Ingredient Wastage (No Menu Item) */}
                          {(dayData.directWastage || []).length > 0 && (
                        <div className="border rounded-lg p-3 bg-muted/10">
                          <p className="text-sm font-semibold mb-2 text-muted-foreground">Direct Ingredient Wastage:</p>
                          <div className="space-y-2">
                            {(dayData.directWastage || []).map((log: WastageLog) => {
                              const ingredient = log.ingredient || ingredients.find(i => i.id === log.ingredient_id);
                              const ingredientName = ingredient?.name || 'Unknown Ingredient';
                              
                              // Extract additional notes
                              const notesMatch = log.notes?.match(/Notes: (.+)/);
                              const additionalNotes = notesMatch ? notesMatch[1].trim() : null;
                              
                              return (
                                <div key={log.id} className="flex justify-between items-start p-2 bg-background rounded border">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{ingredientName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {log.quantity} {log.unit} • {log.location} • 
                                      {reasonEmojis[log.reason] || '📝'} {log.reason.replace('_', ' ')} • 
                                      {format(new Date(log.wastage_time), 'HH:mm')}
                                      {log.logged_by_user?.full_name && (
                                        <> • Logged by: {log.logged_by_user.full_name}</>
                                      )}
                                    </p>
                                    {ingredient?.supplier && (
                                      <p className="text-xs text-muted-foreground">
                                        Supplier: {ingredient.supplier}
                                      </p>
                                    )}
                                    {additionalNotes && (
                                      <p className="text-xs italic text-muted-foreground mt-1">
                                        "{additionalNotes}"
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold text-destructive ml-2">
                                    £{(log.cost_impact || 0).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WastagePage;
