
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface SearchResult {
  id: string;
  type: 'menu' | 'customer' | 'reservation' | 'invoice' | 'inventory' | 'note' | 'order' | 'location' | 'supplier_order';
  title: string;
  subtitle: string;
  metadata?: string;
  icon: string;
  route: string;
}

// Simple fuzzy matching function
const fuzzyMatch = (text: string, query: string): boolean => {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match gets highest priority
  if (textLower.includes(queryLower)) return true;
  
  // Fuzzy matching: check if all characters exist in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length;
};

// Calculate relevance score
const calculateScore = (text: string, query: string): number => {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (textLower === queryLower) return 100;
  if (textLower.startsWith(queryLower)) return 90;
  if (textLower.includes(queryLower)) return 80;
  
  // Fuzzy match score based on character coverage
  let matches = 0;
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matches++;
      queryIndex++;
    }
  }
  return (matches / queryLower.length) * 50;
};

// Special search handlers
const handleSpecialSearch = (query: string, searchData: any): SearchResult[] => {
  const queryLower = query.toLowerCase();
  const results: SearchResult[] = [];

  // Low stock search
  if (queryLower.includes('low stock') || queryLower.includes('lowstock')) {
    searchData.inventory.forEach((item: any) => {
      if (item.stock_quantity <= (item.threshold || 5)) {
        results.push({
          id: item.id,
          type: 'inventory',
          title: item.ingredient_name || 'Unknown Item',
          subtitle: 'Low Stock Alert',
          metadata: `${item.stock_quantity} ${item.unit} (threshold: ${item.threshold || 5})`,
          icon: '⚠️',
          route: '/inventory'
        });
      }
    });
  }

  // VIP customers search
  if (queryLower.includes('vip')) {
    searchData.customers.forEach((customer: any) => {
      if (customer.vip_status) {
        results.push({
          id: customer.id,
          type: 'customer',
          title: customer.name,
          subtitle: 'VIP Customer',
          metadata: customer.phone || customer.email || '',
          icon: '⭐',
          route: '/customers'
        });
      }
    });
  }

  // Date-based search for reservations
  const dateMatch = queryLower.match(/(\w+)\s+(\d+)/);
  if (dateMatch) {
    const [, month, day] = dateMatch;
    const monthNum = new Date(`${month} 1, 2024`).getMonth() + 1;
    if (!isNaN(monthNum)) {
      const searchDate = `2024-${monthNum.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      searchData.reservations.forEach((reservation: any) => {
        if (reservation.date === searchDate) {
          results.push({
            id: reservation.id,
            type: 'reservation',
            title: `${reservation.customer_name}`,
            subtitle: 'Reservation for this date',
            metadata: `Table ${reservation.table_number || 'TBD'} • ${reservation.time || 'Time TBD'}`,
            icon: '📅',
            route: '/reservations'
          });
        }
      });
    }
  }

  return results;
};

export const useGlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Log query changes for debugging
  useEffect(() => {
    console.log('Search query changed:', query);
  }, [query]);

  // Fetch all searchable data
  const { data: searchData, isLoading } = useQuery({
    queryKey: ['global-search-data'],
    queryFn: async () => {
      console.log('Fetching search data...');
      
      // Get current user's company_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError || !userData?.company_id) {
        console.error('Error fetching user company:', userError);
        return {
          menuItems: [],
          customers: [],
          reservations: [],
          invoices: [],
          inventory: [],
          notes: [],
          orders: [],
          locations: [],
          supplierOrders: []
        };
      }

      const companyId = userData.company_id;
      
      const [
        menuItems, 
        customers, 
        reservations, 
        invoices, 
        inventory, 
        notes, 
        orders, 
        locations, 
        supplierOrders
      ] = await Promise.all([
        supabase.from('menu_items').select('*').eq('company_id', companyId),
        supabase.from('customers').select('*').eq('company_id', companyId),
        supabase.from('reservations').select('*').eq('company_id', companyId),
        supabase.from('invoices').select('*').eq('company_id', companyId),
        supabase.from('inventory').select('*').eq('company_id', companyId),
        supabase.from('messenger_notes').select('*').eq('company_id', companyId),
        supabase.from('orders').select('*, users!inner(company_id)').eq('users.company_id', companyId),
        supabase.from('locations').select('*').eq('company_id', companyId),
        supabase.from('supplier_orders').select('*')
      ]);

      const data = {
        menuItems: menuItems.data || [],
        customers: customers.data || [],
        reservations: reservations.data || [],
        invoices: invoices.data || [],
        inventory: inventory.data || [],
        notes: notes.data || [],
        orders: orders.data || [],
        locations: locations.data || [],
        supplierOrders: supplierOrders.data || []
      };

      console.log('Search data fetched:', data);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Process search results
  const results = useMemo(() => {
    if (!query.trim() || !searchData) {
      console.log('No query or search data available');
      return [];
    }

    console.log('Processing search for query:', query);
    const allResults: (SearchResult & { score: number })[] = [];

    // Handle special searches first
    const specialResults = handleSpecialSearch(query, searchData);
    specialResults.forEach(result => {
      allResults.push({ ...result, score: 95 });
    });

    // Search menu items
    searchData.menuItems.forEach((item) => {
      const searchableText = `${item.name} ${item.description || ''} ${item.tags?.join(' ') || ''}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: item.id,
          type: 'menu',
          title: item.name,
          subtitle: 'Menu Item',
          metadata: `£${item.price}`,
          icon: '🍽️',
          route: `/menu`,
          score: calculateScore(item.name, query)
        });
      }
    });

    // Search customers
    searchData.customers.forEach((customer) => {
      const searchableText = `${customer.name} ${customer.email || ''} ${customer.phone || ''} ${customer.preferences?.join(' ') || ''}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: customer.id,
          type: 'customer',
          title: customer.name,
          subtitle: customer.vip_status ? 'VIP Customer' : 'Customer',
          metadata: customer.phone || customer.email || '',
          icon: customer.vip_status ? '⭐' : '👤',
          route: `/customers`,
          score: calculateScore(customer.name, query)
        });
      }
    });

    // Search reservations
    searchData.reservations.forEach((reservation) => {
      const searchableText = `${reservation.customer_name} ${reservation.table_number || ''} ${reservation.date} ${reservation.phone || ''}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: reservation.id,
          type: 'reservation',
          title: `${reservation.customer_name}`,
          subtitle: 'Reservation',
          metadata: `Table ${reservation.table_number || 'TBD'} • ${reservation.date}`,
          icon: '📅',
          route: `/reservations`,
          score: calculateScore(reservation.customer_name, query)
        });
      }
    });

    // Search invoices
    searchData.invoices.forEach((invoice) => {
      const searchableText = `${invoice.supplier} ${invoice.invoice_number} ${invoice.items_purchased || ''}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: invoice.id,
          type: 'invoice',
          title: `Invoice #${invoice.invoice_number}`,
          subtitle: invoice.supplier,
          metadata: `£${invoice.amount_paid} • ${invoice.date_paid}`,
          icon: '📄',
          route: `/invoices`,
          score: calculateScore(`${invoice.supplier} ${invoice.invoice_number}`, query)
        });
      }
    });

    // Search inventory
    searchData.inventory.forEach((item) => {
      const searchableText = `${item.ingredient_name || ''} ${item.unit}`;
      if (fuzzyMatch(searchableText, query)) {
        const isLowStock = item.stock_quantity <= (item.threshold || 5);
        allResults.push({
          id: item.id,
          type: 'inventory',
          title: item.ingredient_name || 'Unknown Item',
          subtitle: isLowStock ? 'Low Stock' : 'Inventory',
          metadata: `${item.stock_quantity} ${item.unit}`,
          icon: isLowStock ? '⚠️' : '📦',
          route: `/inventory`,
          score: calculateScore(item.ingredient_name || '', query)
        });
      }
    });

    // Search messenger notes
    searchData.notes.forEach((note) => {
      const searchableText = `${note.title} ${note.body || ''} ${note.author || ''} ${note.category || ''}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: note.id,
          type: 'note',
          title: note.title,
          subtitle: `Note by ${note.author || 'Unknown'}`,
          metadata: note.category || '',
          icon: '📝',
          route: `/messenger`,
          score: calculateScore(note.title, query)
        });
      }
    });

    // Search orders
    searchData.orders.forEach((order) => {
      const searchableText = `${order.id} ${order.order_type || ''} ${order.notes || ''}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: order.id,
          type: 'order',
          title: `Order #${order.id.slice(0, 8)}`,
          subtitle: order.order_type || 'Order',
          metadata: `£${order.total_amount} • ${order.status}`,
          icon: '🛒',
          route: `/order-review`,
          score: calculateScore(order.id, query)
        });
      }
    });

    // Search locations
    searchData.locations.forEach((location) => {
      const searchableText = `${location.name} ${location.address || ''} ${location.phone || ''}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: location.id,
          type: 'location',
          title: location.name,
          subtitle: 'Location',
          metadata: location.address || location.phone || '',
          icon: '📍',
          route: `/locations`,
          score: calculateScore(location.name, query)
        });
      }
    });

    // Search supplier orders
    searchData.supplierOrders.forEach((order) => {
      const searchableText = `${order.category} ${order.status || ''} ${order.date}`;
      if (fuzzyMatch(searchableText, query)) {
        allResults.push({
          id: order.id,
          type: 'supplier_order',
          title: `${order.category} Order`,
          subtitle: 'Supplier Order',
          metadata: `£${order.total_cost} • ${order.status} • ${order.date}`,
          icon: '📋',
          route: `/inventory`,
          score: calculateScore(order.category, query)
        });
      }
    });

    // Sort by relevance score and limit results
    const finalResults = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map(({ score, ...result }) => result);

    console.log('Search results:', finalResults);
    return finalResults;
  }, [query, searchData]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    
    results.forEach((result) => {
      const groupName = {
        menu: 'Menu Items',
        customer: 'Customers',
        reservation: 'Reservations',
        invoice: 'Invoices',
        inventory: 'Inventory',
        note: 'Messenger Notes',
        order: 'Orders',
        location: 'Locations',
        supplier_order: 'Supplier Orders'
      }[result.type];
      
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(result);
    });
    
    console.log('Grouped results:', groups);
    return groups;
  }, [results]);

  return {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    results,
    groupedResults,
    isLoading
  };
};
