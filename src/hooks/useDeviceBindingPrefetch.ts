import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PrefetchProgress {
  total: number;
  completed: number;
  currentTask: string;
  isComplete: boolean;
  errors: string[];
}

export const useDeviceBindingPrefetch = () => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<PrefetchProgress>({
    total: 0,
    completed: 0,
    currentTask: '',
    isComplete: false,
    errors: []
  });

  const comprehensivePrefetch = async (companyId: string): Promise<boolean> => {
    console.log('🔄 Starting comprehensive UI + data prefetch for company:', companyId);
    
    setProgress({
      total: 37,
      completed: 0,
      currentTask: 'Initializing prefetch...',
      isComplete: false,
      errors: []
    });

    const updateProgress = (completed: number, task: string, error?: string) => {
      setProgress(prev => ({
        ...prev,
        completed,
        currentTask: task,
        errors: error ? [...prev.errors, error] : prev.errors
      }));
    };

    try {
      // Phase 1: UI Component Preloading (loads components into memory)
      updateProgress(1, 'Preloading timeline components...');
      await import('../components/reservations/timeline/TimelineGrid');
      await import('../components/reservations/timeline/TimelineHeader');
      await import('../components/reservations/timeline/ResponsiveTimelineContainer');
      
      updateProgress(2, 'Preloading reservation components...');
      await import('../components/reservations/ReservationBlock');
      await import('../components/reservations/ReservationTable');
      await import('../components/reservations/ReservationForm');
      
      updateProgress(3, 'Preloading modal components...');
      await import('../components/reservations/NewReservationModal');
      await import('../components/reservations/EditReservationModal');
      await import('../components/reservations/TableMoveFeedbackModal');
      
      updateProgress(4, 'Preloading form components...');
      await import('../components/ui/form');
      await import('../components/ui/input');
      await import('../components/ui/select');
      
      updateProgress(5, 'Preloading UI components...');
      await import('../components/ui/button');
      await import('../components/ui/card');
      await import('../components/ui/dialog');

      // Phase 2: Data Prefetching (populates React Query cache)
      updateProgress(6, 'Caching tables data...');
      const tablesResult = await supabase
        .from('tables')
        .select('*')
        .eq('company_id', companyId)
        .order('table_number', { ascending: true });
      
      // Sort tables to ensure correct numerical order
      const sortedTables = (tablesResult.data || []).sort((a, b) => a.table_number - b.table_number);
      queryClient.setQueryData(['tables', companyId], sortedTables);

      updateProgress(7, 'Caching reservations data...');
      const reservationsResult = await supabase.from('reservations').select('*').eq('company_id', companyId);
      // Transform raw data to match useReservationsQuery expectations
      const transformedReservations = (reservationsResult.data || []).map((reservation: any) => ({
        id: reservation.id,
        customer_name: reservation.customer_name,
        phone: reservation.phone || '',
        email: reservation.email || '',
        party_size: reservation.party_size,
        date: reservation.date,
        time: reservation.time || '19:00',
        end_time: reservation.end_time || null,
        table_number: reservation.table_number || null,
        table_numbers: reservation.table_numbers || null,
        notes: reservation.notes || '',
        status: (reservation.status as any) || 'pending',
        locked: Boolean(reservation.locked) || false,
        has_allergens: Boolean(reservation.has_allergens) || false,
        allergens: reservation.allergens || [],
      }));
      queryClient.setQueryData(['reservations', companyId], transformedReservations);
      
      // Also cache today's reservations specifically for instant timeline loading
      const today = new Date().toISOString().split('T')[0];
      const todayReservations = transformedReservations.filter(r => r.date === today);
      queryClient.setQueryData(['reservations-today', companyId, today], todayReservations);

      updateProgress(8, 'Caching customers data...');
      const customersResult = await supabase.from('customers').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['customers', companyId], customersResult.data || []);

      updateProgress(9, 'Caching menu data...');
      const menuCategoriesResult = await supabase.from('menu_categories').select('*').eq('company_id', companyId);
      const menuItemsResult = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories!inner (
            category_type
          )
        `)
        .eq('company_id', companyId);
      
      // Transform menu items to flatten category_type
      const transformedItems = menuItemsResult.data?.map(({ menu_categories, ...item }: any) => ({
        ...item,
        category_type: menu_categories?.category_type || 'mains'
      })) || [];
      
      // Store with both cache keys for compatibility
      queryClient.setQueryData(['menu_categories', companyId], menuCategoriesResult.data || []);
      queryClient.setQueryData(['menu-categories', companyId], menuCategoriesResult.data || []);
      queryClient.setQueryData(['menu_items', companyId], transformedItems);

      updateProgress(10, 'Caching ingredients data...');
      const ingredientsResult = await supabase
        .from('ingredients')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      queryClient.setQueryData(['ingredients', companyId], ingredientsResult.data || []);
      console.log(`✅ Cached ${ingredientsResult.data?.length || 0} ingredients`);

      updateProgress(11, 'Caching delivery & supplier data...');
      const suppliersResult = await (supabase as any)
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      queryClient.setQueryData(['suppliers', companyId], suppliersResult.data || []);
      console.log(`✅ Cached ${suppliersResult.data?.length || 0} suppliers`);

      // Cache open tabs for POS
      const openTabsOrdersResult = await supabase
        .from('orders')
        .select('id, order_number, assignment_type, table_number, customer_name, total_amount, amount_paid, created_at')
        .eq('company_id', companyId)
        .eq('payment_status', 'unpaid')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (openTabsOrdersResult.data && openTabsOrdersResult.data.length > 0) {
        const orderIds = openTabsOrdersResult.data.map(o => o.id);
        const [orderItemsResult, paymentsResult] = await Promise.all([
          supabase.from('order_items').select('order_id, id, quantity').in('order_id', orderIds),
          supabase.from('payments').select('order_id, split_index, total_splits').in('order_id', orderIds)
        ]);

        const itemsByOrder = (orderItemsResult.data || []).reduce((acc, item) => {
          if (!acc[item.order_id]) acc[item.order_id] = [];
          acc[item.order_id].push(item);
          return acc;
        }, {} as Record<string, any[]>);

        const paymentsByOrder = (paymentsResult.data || []).reduce((acc, payment) => {
          if (!acc[payment.order_id]) acc[payment.order_id] = [];
          acc[payment.order_id].push(payment);
          return acc;
        }, {} as Record<string, any[]>);

        const openTabsData = openTabsOrdersResult.data.map(order => {
          const orderItemsList = itemsByOrder[order.id] || [];
          const orderPayments = paymentsByOrder[order.id] || [];
          const splitPayments = orderPayments.filter(p => p.total_splits !== null);
          const isSplit = splitPayments.length > 0;
          
          return {
            orderId: order.id,
            orderNumber: order.order_number,
            assignmentType: order.assignment_type,
            tableNumber: order.table_number,
            customerName: order.customer_name,
            itemCount: orderItemsList.reduce((sum, item) => sum + (item.quantity || 0), 0),
            totalAmount: order.total_amount || 0,
            amountPaid: order.amount_paid || 0,
            createdAt: order.created_at,
            isSplit,
            totalSplits: isSplit ? splitPayments[0].total_splits : 0,
            paidSplits: new Set(splitPayments.map(p => p.split_index)).size,
          };
        });
        
        queryClient.setQueryData(['open-tabs', companyId], openTabsData);
        console.log(`✅ Cached ${openTabsData.length} open tabs`);
      }

      const wastageLogResult = await (supabase as any)
        .from('wastage_log')
        .select('*')
        .eq('company_id', companyId)
        .order('wastage_time', { ascending: false });
      queryClient.setQueryData(['wastage_log', companyId], wastageLogResult.data || []);
      console.log(`✅ Cached ${wastageLogResult.data?.length || 0} wastage logs`);

      const deliveryOrdersResult = await (supabase as any)
        .from('delivery_orders')
        .select('*, supplier:suppliers(*)')
        .eq('company_id', companyId)
        .order('delivery_date', { ascending: false });
      queryClient.setQueryData(['delivery_orders', companyId], deliveryOrdersResult.data || []);
      console.log(`✅ Cached ${deliveryOrdersResult.data?.length || 0} delivery orders`);

      const deliveryOrderItemsResult = await (supabase as any)
        .from('delivery_order_items')
        .select('*')
        .eq('company_id', companyId);
      queryClient.setQueryData(['delivery_order_items', companyId], deliveryOrderItemsResult.data || []);

      const deliverySettingsResult = await (supabase as any)
        .from('delivery_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();
      queryClient.setQueryData(['delivery_settings', companyId], deliverySettingsResult.data);

      updateProgress(12, 'Caching product links data...');
      const productLinksResult = await supabase
        .from('product_links')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);

      // Group by menu_item_id (same format as useMenuItemProductLinks expects)
      const grouped: Record<string, any[]> = {};
      (productLinksResult.data || []).forEach((link) => {
        if (!grouped[link.menu_item_id]) {
          grouped[link.menu_item_id] = [];
        }
        grouped[link.menu_item_id].push(link);
      });

      queryClient.setQueryData(['menu-item-product-links', companyId], grouped);
      console.log(`✅ Cached ${productLinksResult.data?.length || 0} product links for ${Object.keys(grouped).length} menu items`);

      updateProgress(13, 'Caching company settings...');
      const settingsResult = await supabase.from('company_settings').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['company_settings', companyId], settingsResult.data || []);

      updateProgress(14, 'Caching deals data...');
      const dealsResult = await supabase.from('deals').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['deals', companyId], dealsResult.data || []);

      updateProgress(15, 'Caching analytics data...');
      const analyticsResult = await supabase.from('daily_revenue_analytics').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['analytics', companyId], analyticsResult.data || []);
      
      const tableMetricsResult = await supabase
        .from('table_performance_metrics')
        .select('*')
        .eq('company_id', companyId);
      queryClient.setQueryData(['table_metrics', companyId], tableMetricsResult.data || []);

      updateProgress(16, 'Caching marketing data...');
      const marketingResult = await supabase.from('marketing_campaigns').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['marketing', companyId], marketingResult.data || []);

      updateProgress(17, 'Caching inventory & staff data...');
      const inventoryResult = await supabase.from('inventory').select('*').eq('company_id', companyId);
      const staffResult = await supabase.from('users').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['inventory', companyId], inventoryResult.data || []);
      queryClient.setQueryData(['staff', companyId], staffResult.data || []);

      // Phase 3: Route Module Preloading (loads all lazy routes)
      updateProgress(18, 'Preloading settings pages...');
      await Promise.allSettled([
        import('../pages/settings/CompanyDetailsSettings'),
        import('../pages/settings/TeamMembersSettings'),
        import('../pages/settings/BrandingSettings'),
        import('../pages/settings/LegalPolicySettings'),
        import('../pages/settings/IntegrationsSettings'),
        import('../pages/settings/MenuSettings'),
        import('../pages/settings/AccessLevelSettings'),
        import('../pages/settings/TableAssignmentSettings')
      ]);

      updateProgress(19, 'Preloading admin pages...');
      await Promise.allSettled([
        import('../pages/SuperAdminDashboard'),
        import('../pages/SuperAdminLogin'),
        import('../pages/OwnerLogin'),
        import('../pages/SetupWizardPage'),
        import('../pages/PrivacyPolicy'),
        import('../pages/NotFound')
      ]);

      // Phase 4: Extended Data Prefetching (comprehensive company data)
      updateProgress(20, 'Caching locations data...');
      const locationsResult = await supabase.from('locations').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['locations', companyId], locationsResult.data || []);

      updateProgress(21, 'Caching invoices data...');
      const invoicesResult = await supabase.from('invoices').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['invoices', companyId], invoicesResult.data || []);

      updateProgress(22, 'Caching integrations data...');
      const integrationsResult = await supabase.from('integrations').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['integrations', companyId], integrationsResult.data || []);

      updateProgress(22, 'Caching channels & communications...');
      const channelsResult = await supabase.from('channels').select('*').eq('company_id', companyId);
      const marketingAnalyticsResult = await supabase.from('marketing_analytics').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['channels', companyId], channelsResult.data || []);
      queryClient.setQueryData(['marketing_analytics', companyId], marketingAnalyticsResult.data || []);

      updateProgress(23, 'Caching permissions data...');
      const permissionsResult = await supabase.rpc('get_page_permissions_by_company', { company_uuid: companyId });
      queryClient.setQueryData(['page_permissions', companyId], permissionsResult.data || []);

      updateProgress(24, 'Caching holiday & roster data...');
      const holidayRequestsResult = await supabase.from('holiday_requests').select('*').eq('user_id', companyId);
      queryClient.setQueryData(['holiday_requests', companyId], holidayRequestsResult.data || []);

      updateProgress(25, 'Caching table performance metrics...');
      const tablePerformanceResult = await supabase.from('table_performance_metrics').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['table_metrics', companyId], tablePerformanceResult.data || []);

      updateProgress(26, 'Caching company growth metrics...');
      const growthMetricsResult = await supabase.from('company_growth_metrics').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['growth_metrics', companyId], growthMetricsResult.data || []);

      updateProgress(27, 'Caching deal types & assignment rules...');
      const dealTypesResult = await supabase.from('deal_types').select('*').eq('company_id', companyId);
      const assignmentRulesResult = await supabase.from('assignment_rules').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['deal_types', companyId], dealTypesResult.data || []);
      queryClient.setQueryData(['assignment_rules', companyId], assignmentRulesResult.data || []);

      updateProgress(28, 'Caching subscription features...');
      const subscriptionFeaturesResult = await supabase.from('company_subscription_features').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['subscription_features', companyId], subscriptionFeaturesResult.data || []);

      updateProgress(29, 'Caching group seat mappings...');
      const groupSeatMappingsResult = await supabase.from('group_seat_mappings').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['group_seat_mappings', companyId], groupSeatMappingsResult.data || []);

      updateProgress(30, 'Caching assignment history...');
      const assignmentHistoryResult = await supabase.from('assignment_history').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['assignment_history', companyId], assignmentHistoryResult.data || []);

      updateProgress(31, 'Caching manual override feedback...');
      const manualOverrideFeedbackResult = await supabase.from('manual_override_feedback').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['manual_override_feedback', companyId], manualOverrideFeedbackResult.data || []);

      updateProgress(32, 'Caching marketing permissions...');
      const marketingPermissionsResult = await supabase.from('marketing_permissions').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['marketing_permissions', companyId], marketingPermissionsResult.data || []);

      updateProgress(33, 'Caching copilot & AI logs...');
      const copilotLogsResult = await supabase.from('copilot_logs').select('*').eq('company_id', companyId);
      const aiCampaignLogsResult = await supabase.from('ai_campaign_logs').select('*').eq('company_id', companyId);
      queryClient.setQueryData(['copilot_logs', companyId], copilotLogsResult.data || []);
      queryClient.setQueryData(['ai_campaign_logs', companyId], aiCampaignLogsResult.data || []);

      updateProgress(34, 'Caching inventory logs & menu ingredients...');
      const inventoryLogsResult = await supabase.from('inventory_logs').select('*')
        .in('inventory_item_id', (await supabase.from('inventory').select('id').eq('company_id', companyId)).data?.map(i => i.id) || []);
      const menuItemIngredientsResult = await supabase.from('menu_item_ingredients').select('*')
        .in('menu_item_id', transformedItems.map(m => m.id) || []);
      queryClient.setQueryData(['inventory_logs', companyId], inventoryLogsResult.data || []);
      queryClient.setQueryData(['menu_item_ingredients', companyId], menuItemIngredientsResult.data || []);

      updateProgress(35, 'Caching customer communications...');
      const customerCommunicationsResult = await supabase.from('customer_communications').select('*')
        .in('customer_id', (await supabase.from('customers').select('id').eq('company_id', companyId)).data?.map(c => c.id) || []);
      queryClient.setQueryData(['customer_communications', companyId], customerCommunicationsResult.data || []);

      updateProgress(36, 'Caching channel memberships & messages...');
      const channelMembershipsResult = await supabase.from('channel_memberships').select('*')
        .in('channel_id', (await supabase.from('channels').select('id').eq('company_id', companyId)).data?.map(c => c.id) || []);
      const messagesResult = await supabase.from('messages').select('*')
        .in('channel_id', (await supabase.from('channels').select('id').eq('company_id', companyId)).data?.map(c => c.id) || []);
      queryClient.setQueryData(['channel_memberships', companyId], channelMembershipsResult.data || []);
      queryClient.setQueryData(['messages', companyId], messagesResult.data || []);

      updateProgress(37, 'Setting up real-time subscriptions...');
      // Real-time subscriptions will be handled by individual hooks
      // This ensures data stays fresh across all devices

      setProgress(prev => ({
        ...prev,
        isComplete: true,
        currentTask: 'Complete restaurant workspace ready! All data and pages cached.'
      }));

      // Mark as complete in localStorage
      localStorage.setItem(`prefetch_complete_${companyId}`, 'true');
      
      console.log('✅ Comprehensive UI + data prefetch completed');
      return true;
    } catch (error: any) {
      console.error('❌ Prefetch error:', error);
      setProgress(prev => ({
        ...prev,
        errors: [...prev.errors, `Prefetch failed: ${error.message}`]
      }));
      return false;
    }
  };

  const isPrefetchComplete = (companyId: string): boolean => {
    return localStorage.getItem(`prefetch_complete_${companyId}`) === 'true';
  };

  return {
    comprehensivePrefetch,
    progress,
    isPrefetchComplete
  };
};