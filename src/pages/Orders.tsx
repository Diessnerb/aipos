import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { OrderDetailsModal } from '@/components/pos/OrderDetailsModal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, parse } from 'date-fns';
import { useUserRole } from '@/hooks/useUserRole';
import { useOrders } from '@/hooks/useOrders';
import { Crown, Search, X } from 'lucide-react';

export default function Orders() {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderTypeFilters, setOrderTypeFilters] = useState<Record<string, 'all' | 'dine-in' | 'takeaway'>>({});
  const [searchInput, setSearchInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filteredDisplayLimit, setFilteredDisplayLimit] = useState(2000);
  
  const queryClient = useQueryClient();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  const { 
    orders, 
    isLoading, 
    loadMore, 
    hasMore, 
    searchOrders, 
    clearSearch, 
    isSearchActive,
    searchQuery 
  } = useOrders();

  const getUserName = (userData: any): string => {
    if (!userData) return 'Unknown';
    if (Array.isArray(userData)) {
      return userData[0]?.full_name || 'Unknown';
    }
    return userData.full_name || 'Unknown';
  };

  const getItemCount = (order: any): number => {
    return order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
  };

  const getPayerName = (order: any): string => {
    if (order.status !== 'paid') return '-';
    const payer = order.payments?.[0]?.paid_by_user;
    return getUserName(payer);
  };

  const isTakeawayOrder = (order: any): boolean => {
    return order.assignment_type === 'customer_name';
  };

  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
  };

  const setOrderTypeFilter = (dateKey: string, filter: 'all' | 'dine-in' | 'takeaway') => {
    setOrderTypeFilters(prev => ({ ...prev, [dateKey]: filter }));
  };

  const getFilteredOrders = (orders: any[], filter: 'all' | 'dine-in' | 'takeaway') => {
    if (filter === 'all') return orders;
    if (filter === 'takeaway') return orders.filter(o => isTakeawayOrder(o));
    if (filter === 'dine-in') return orders.filter(o => !isTakeawayOrder(o));
    return orders;
  };

  const handleSearch = async () => {
    if (!searchInput.trim() || searchInput.trim().length < 2) {
      clearSearch();
      return;
    }

    const filters: any = {};
    if (dateFrom) filters.dateFrom = new Date(dateFrom).toISOString();
    if (dateTo) filters.dateTo = new Date(dateTo).toISOString();
    if (tableNumber) filters.tableNumber = parseInt(tableNumber);
    if (statusFilter !== 'all') filters.status = statusFilter;

    await searchOrders(searchInput.trim(), filters);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setDateFrom('');
    setDateTo('');
    setTableNumber('');
    setStatusFilter('all');
    clearSearch();
  };

  // Check if filters are active
  const hasActiveFilters = dateFrom || dateTo || tableNumber || statusFilter !== 'all';

  // Apply client-side filters
  const applyFilters = (ordersToFilter: any[]) => {
    let filtered = [...ordersToFilter];

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(order => 
        new Date(order.created_at) >= fromDate
      );
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(order => 
        new Date(order.created_at) <= toDate
      );
    }

    // Filter by table number
    if (tableNumber) {
      const tableNum = parseInt(tableNumber);
      if (!isNaN(tableNum)) {
        filtered = filtered.filter(order => 
          order.table_number === tableNum
        );
      }
    }

    // Filter by status
    if (statusFilter === 'paid') {
      filtered = filtered.filter(order => order.status === 'paid');
    } else if (statusFilter === 'unpaid') {
      filtered = filtered.filter(order => order.status !== 'paid');
    }

    return filtered;
  };

  // Apply filters first
  const filteredOrders = applyFilters(orders || []);

  // Apply display limit to filtered orders (for pagination)
  const displayedOrders = filteredOrders.slice(0, filteredDisplayLimit);

  // Group displayed orders by date
  const ordersByDate = displayedOrders.reduce((acc, order) => {
    const dateKey = format(new Date(order.created_at), 'dd/MM/yyyy');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(order);
    return acc;
  }, {} as Record<string, any[]>);

  // Sort dates descending (most recent first)
  const sortedDates = Object.keys(ordersByDate).sort((a, b) => {
    const dateA = parse(a, 'dd/MM/yyyy', new Date());
    const dateB = parse(b, 'dd/MM/yyyy', new Date());
    return dateB.getTime() - dateA.getTime();
  });

  // Load more handler
  const handleLoadMore = () => {
    if (hasActiveFilters) {
      // Increase client-side pagination for filtered results
      setFilteredDisplayLimit(prev => prev + 100);
    } else {
      // Load more from backend
      loadMore();
    }
  };

  // Check if we should show load more button
  const showLoadMore = !isSearchActive && !isLoading && (
    hasActiveFilters 
      ? filteredOrders.length > filteredDisplayLimit 
      : hasMore
  );

  // Reset display limit when filters change
  useEffect(() => {
    setFilteredDisplayLimit(2000);
  }, [dateFrom, dateTo, tableNumber, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Orders" 
        subtitle="Manage all orders and open tabs from your Point of Sale system." 
      />

      {/* Search Section */}
      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by order number, customer name, or POS ID (min 2 characters)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={searchInput.trim().length < 2}>
            Search
          </Button>
          {isSearchActive && (
            <Button variant="ghost" size="icon" onClick={handleClearSearch}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Table Number</label>
            <Input
              type="number"
              placeholder="e.g. 5"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid Only</option>
              <option value="unpaid">Unpaid Only</option>
            </select>
          </div>
        </div>

        {isSearchActive && (
          <div className="text-sm text-muted-foreground">
            Showing search results for "<span className="font-medium">{searchQuery}</span>"
            {(dateFrom || dateTo || tableNumber || statusFilter !== 'all') && (
              <span>
                {' '}with filters
                {dateFrom && ` from ${format(new Date(dateFrom), 'dd/MM/yyyy')}`}
                {dateTo && ` to ${format(new Date(dateTo), 'dd/MM/yyyy')}`}
                {tableNumber && ` table ${tableNumber}`}
                {statusFilter !== 'all' && ` ${statusFilter} only`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active Filters Indicator */}
      {!isSearchActive && hasActiveFilters && (
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                Showing {displayedOrders.length} of {filteredOrders.length} filtered orders
              </span>
              <span className="text-blue-700 dark:text-blue-300 ml-2 text-sm">
                (from {orders.length} total)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setTableNumber('');
                setStatusFilter('all');
                setFilteredDisplayLimit(2000);
              }}
              className="text-blue-900 dark:text-blue-100 h-auto p-2"
            >
              Clear all filters
            </Button>
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            {dateFrom && `From: ${format(new Date(dateFrom), 'dd/MM/yyyy')} `}
            {dateTo && `To: ${format(new Date(dateTo), 'dd/MM/yyyy')} `}
            {tableNumber && `Table: ${tableNumber} `}
            {statusFilter !== 'all' && `Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`}
          </div>
        </div>
      )}

      {(isLoading || roleLoading) ? (
        <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No orders found</div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {sortedDates.map(dateKey => {
            const dateOrders = ordersByDate[dateKey];
            const totalRevenue = dateOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
            const unpaidCount = dateOrders.filter(o => o.status !== 'paid').length;
            
            return (
              <AccordionItem key={dateKey} value={dateKey} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold text-base">{dateKey}</span>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {isAdmin ? (
                        <>
                          <span>{dateOrders.length} orders</span>
                          {unpaidCount > 0 && (
                            <span>• {unpaidCount} unpaid</span>
                          )}
                          <span className="font-bold text-foreground">£{totalRevenue.toFixed(2)}</span>
                        </>
                      ) : (
                        <>
                          <span>{dateOrders.length} orders</span>
                          {unpaidCount > 0 && (
                            <span>• {unpaidCount} unpaid</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-4 pb-4 space-y-1">
                  {/* Filter Toggle */}
                  <div className="flex items-center gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
                    <span className="text-xs text-muted-foreground mr-2">Show:</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={(orderTypeFilters[dateKey] || 'all') === 'all' ? 'default' : 'ghost'}
                        className="h-7 px-3 text-xs"
                        onClick={() => setOrderTypeFilter(dateKey, 'all')}
                      >
                        All ({dateOrders.length})
                      </Button>
                      <Button
                        size="sm"
                        variant={(orderTypeFilters[dateKey] || 'all') === 'dine-in' ? 'default' : 'ghost'}
                        className="h-7 px-3 text-xs"
                        onClick={() => setOrderTypeFilter(dateKey, 'dine-in')}
                      >
                        Dine-In ({dateOrders.filter(o => !isTakeawayOrder(o)).length})
                      </Button>
                      <Button
                        size="sm"
                        variant={(orderTypeFilters[dateKey] || 'all') === 'takeaway' ? 'default' : 'ghost'}
                        className="h-7 px-3 text-xs"
                        onClick={() => setOrderTypeFilter(dateKey, 'takeaway')}
                      >
                        Takeaway ({dateOrders.filter(o => isTakeawayOrder(o)).length})
                      </Button>
                    </div>
                  </div>

                  {/* Header Row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium px-3 py-2 border-b">
                    <span className="w-20">Order #</span>
                    <span className="w-16">Time</span>
                    <span className="w-16">Items</span>
                    <span className="flex-1 min-w-0">Customer</span>
                    <span className="flex-1 min-w-0">
                      {(orderTypeFilters[dateKey] || 'all') === 'takeaway' ? 'Name on Order' : 'Created By'}
                    </span>
                    <span className="flex-1 min-w-0">
                      {(orderTypeFilters[dateKey] || 'all') === 'takeaway' ? 'Paid/Created By' : 'Paid By'}
                    </span>
                    <span className="w-20">Status</span>
                    <span className="w-24 text-right">Total</span>
                  </div>
                  
                  {/* Order Rows */}
                  {getFilteredOrders(dateOrders, orderTypeFilters[dateKey] || 'all').map(order => (
                    <div 
                      key={order.id}
                      onClick={() => handleOrderClick(order)}
                      className="border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors px-3 py-2"
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-mono w-20 font-medium">#{order.order_number}</span>
                        <span className="w-16">{format(new Date(order.created_at), 'HH:mm')}</span>
                        <span className="w-16 text-muted-foreground">{getItemCount(order)}</span>
                        
                        {/* Column 4: Customer info */}
                        <span className="flex-1 min-w-0 truncate">
                          {order.customer ? (
                            <div className="flex items-center gap-1">
                              {order.customer.vip_status && (
                                <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                              )}
                              <span className="truncate">{order.customer.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {order.customer_name || 'Walk-in'}
                            </span>
                          )}
                        </span>
                        
                        {/* Column 5: Customer name for takeaway, Created By for regular */}
                        <span className="flex-1 min-w-0 truncate">
                          {isTakeawayOrder(order) ? (
                            <span className="font-medium">{order.customer_name}</span>
                          ) : (
                            getUserName(order.created_by_user)
                          )}
                        </span>
                        
                        {/* Column 6: For takeaway show paid_by OR created_by, for regular show paid_by */}
                        <span className="flex-1 min-w-0 truncate text-muted-foreground">
                          {isTakeawayOrder(order) ? (
                            order.status === 'paid' ? getPayerName(order) : getUserName(order.created_by_user)
                          ) : (
                            getPayerName(order)
                          )}
                        </span>
                        
                        <div className="w-20">
                          <Badge variant={order.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                            {order.status === 'paid' ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </div>
                        <span className="font-bold w-24 text-right">£{Number(order.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Load More Button */}
      {showLoadMore && (
        <div className="flex justify-center py-6">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            className="w-full max-w-md"
          >
            {hasActiveFilters 
              ? `View 100 More Filtered Orders (${filteredOrders.length - filteredDisplayLimit} remaining)`
              : 'View 100 More Orders'
            }
          </Button>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
