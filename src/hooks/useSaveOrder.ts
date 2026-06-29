import { supabase } from '@/integrations/supabase/client';
import { BasketItem, OrderAssignment } from '@/contexts/OrderBasketContext';
import { offlineAwareInsert, offlineAwareUpdate, offlineAwareDelete } from '@/utils/offlineAwareSupabase';

export interface SaveOrderParams {
  basketItems: BasketItem[];
  total: number;
  orderAssignment: OrderAssignment | null;
  status: 'paid' | 'unpaid';
  userId?: string;
  orderId?: string | null;
  scheduledFor?: Date | null;
}

// Helper function to check if basket contains items that need to go to kitchen
const hasKitchenItems = (items: BasketItem[]): boolean => {
  return items.some(item => item.courseType !== 'drinks');
};

export const useSaveOrder = () => {
  const saveOrder = async ({ basketItems, total, orderAssignment, status, userId, orderId, scheduledFor }: SaveOrderParams) => {
    console.info('[POS] saveOrder: resolving company_id for user', { userId, orderId, mode: orderId ? 'UPDATE' : 'INSERT', scheduledFor });

    // Get company ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', userId)
      .single();

    if (userError) {
      console.error('[POS] saveOrder: error', { 
        step: 'users/company_id', 
        code: userError?.code, 
        message: userError?.message, 
        details: userError?.details, 
        hint: userError?.hint 
      });
      throw userError;
    }

    if (!userData?.company_id) {
      console.error('[POS] saveOrder: error', { step: 'users/company_id', message: 'Company ID not found' });
      throw new Error('Company ID not found');
    }

    console.info('[POS] saveOrder: fetched company_id', { companyId: userData.company_id });

    // If orderId provided, we're updating an existing order
    if (orderId) {
      console.info('[POS] saveOrder: UPDATE MODE - updating existing order', { orderId });
      
      // Fetch existing order with reservation data
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          order_number, 
          reservation_id,
          sent_to_kitchen_at,
          created_at,
          reservation:reservations (
            id,
            status,
            starters_served_at,
            mains_served_at,
            desserts_served_at
          )
        `)
        .eq('id', orderId)
        .single();
      
      if (fetchError) {
        console.error('[POS] saveOrder: error fetching existing order', {
          code: fetchError?.code,
          message: fetchError?.message,
        });
        throw fetchError;
      }
      
      console.info('[POS] saveOrder: fetched existing order', { 
        orderNumber: existingOrder.order_number,
        reservationId: existingOrder.reservation_id 
      });
      
      // Determine edit permissions based on reservation status
      const reservation = existingOrder.reservation;
      const canEditStarters = !reservation?.starters_served_at;
      const canEditMains = !reservation?.mains_served_at;
      const canEditDesserts = !reservation?.desserts_served_at;
      
      console.info('[POS] saveOrder: course edit permissions', {
        canEditStarters,
        canEditMains,
        canEditDesserts,
        reservationStatus: reservation?.status
      });
      
      // Filter basket items based on edit permissions
      const validatedItems = basketItems.map(item => {
        // Check if this course is locked
        const isLocked = 
          (item.courseType === 'starter' && !canEditStarters) ||
          (item.courseType === 'main' && !canEditMains) ||
          (item.courseType === 'dessert' && !canEditDesserts);
        
        if (isLocked) {
          // Re-assign to next available course
          let newCourse: 'starter' | 'main' | 'dessert' | 'drinks' = item.courseType;
          
          if (reservation?.status?.includes('waiting-for-mains') || reservation?.status?.includes('eating-starters')) {
            newCourse = 'main';
          } else if (reservation?.status?.includes('waiting-for-desserts') || reservation?.status?.includes('eating-mains')) {
            newCourse = 'dessert';
          }
          
          console.warn(`[POS] Course ${item.courseType} is locked, reassigning to ${newCourse}`, {
            itemName: item.menuItem.name
          });
          
          return { ...item, courseType: newCourse };
        }
        
        return item;
      });
      
      // Check if we're adding kitchen items to an order that didn't have any
      const requiresKitchen = hasKitchenItems(validatedItems);
      const wasAlreadySentToKitchen = !!existingOrder.sent_to_kitchen_at;
      
      // Update the order - PRESERVE TIMESTAMPS unless we're now sending to kitchen for first time
      const updatePayload = {
        total_amount: total,
        status,
        table_number: orderAssignment?.type === 'table' ? orderAssignment.tableNumber : null,
        customer_name: orderAssignment?.type === 'customer_name' ? orderAssignment.customerName : null,
        assignment_type: orderAssignment?.type || null,
        scheduled_for: scheduledFor?.toISOString() || null,
        // If order now has kitchen items but wasn't sent before, send it now
        ...(requiresKitchen && !wasAlreadySentToKitchen && {
          kitchen_status: 'sent',
          sent_to_kitchen_at: new Date().toISOString(),
        }),
      };
      
      console.info('[POS] saveOrder: updating order', { 
        payload: updatePayload,
        requiresKitchen,
        wasAlreadySentToKitchen,
        willSendToKitchen: requiresKitchen && !wasAlreadySentToKitchen,
        drinkItemsCount: validatedItems.filter(i => i.courseType === 'drinks').length,
        foodItemsCount: validatedItems.filter(i => i.courseType !== 'drinks').length
      });
      
      const { error: updateError } = await offlineAwareUpdate('orders', orderId, updatePayload);
      
      if (updateError) {
        console.error('[POS] saveOrder: error updating order', {
          code: updateError?.code,
          message: updateError?.message,
        });
        throw updateError;
      }
      
      console.info('[POS] saveOrder: order updated successfully');
      
      // Delete existing order items - fetch them first then delete one by one
      console.info('[POS] saveOrder: deleting old order items');
      const { data: existingItems, error: fetchItemsError } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId);
      
      if (fetchItemsError) {
        console.error('[POS] saveOrder: error fetching old items', {
          code: fetchItemsError?.code,
          message: fetchItemsError?.message,
        });
        throw fetchItemsError;
      }
      
      // Delete each item individually using offline-aware function
      for (const item of existingItems || []) {
        const { error: itemDeleteError } = await offlineAwareDelete('order_items', item.id);
        if (itemDeleteError) {
          console.error('[POS] saveOrder: error deleting old item', {
            code: itemDeleteError?.code,
            message: itemDeleteError?.message,
          });
          throw itemDeleteError;
        }
      }
      
      const deleteError = null; // Reset for compatibility
      
      if (deleteError) {
        console.error('[POS] saveOrder: error deleting old items', {
          code: deleteError?.code,
          message: deleteError?.message,
        });
        throw deleteError;
      }
      
      // Insert new order items with validated courses
      const orderItems = validatedItems.map(item => ({
        order_id: orderId,
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        course_type: item.courseType,
        notes: item.notes || null,
        modifications: (item.configuration || null) as any,
      }));
      
      console.info('[POS] saveOrder: inserting new order items', { count: orderItems.length });
      
      // Insert each item individually using offline-aware function
      for (const item of orderItems) {
        const { error: itemError } = await offlineAwareInsert('order_items', item);
        if (itemError) {
          console.error('[POS] saveOrder: error inserting new item', {
            code: itemError?.code,
            message: itemError?.message,
          });
          throw itemError;
        }
      }
      
      const itemsError = null; // Reset error for compatibility
      
      if (itemsError) {
        console.error('[POS] saveOrder: error inserting new items', {
          code: itemsError?.code,
          message: itemsError?.message,
        });
        throw itemsError;
      }
      
      console.info('[POS] saveOrder: order items updated successfully, timestamps preserved');
      
      // Return existing order number
      return { orderNumber: existingOrder.order_number, orderId };
    }

    // INSERT MODE - creating new order
    console.info('[POS] saveOrder: INSERT MODE - creating new order');

    // Find active reservation if order is assigned to a table
    let reservationId: string | null = null;
    let newReservationStatus: string | null = null;

    if (orderAssignment?.type === 'table' && orderAssignment.tableNumber) {
      console.info('[POS] saveOrder: finding reservation for table', { tableNumber: orderAssignment.tableNumber });
      
      const today = new Date().toISOString().split('T')[0];
      const { data: activeReservation, error: reservationError } = await supabase
        .from('reservations')
        .select('id, status, table_number, table_numbers')
        .eq('company_id', userData.company_id)
        .eq('date', today)
        .or(`table_number.eq.${orderAssignment.tableNumber},table_numbers.cs.{${orderAssignment.tableNumber}}`)
        .in('status', ['seated', 'waiting-for-order', 'waiting-for-starters', 'waiting-for-mains', 'waiting-for-desserts', 'eating-starters', 'eating-mains'])
        .order('time', { ascending: true })
        .limit(1)
        .single();
      
      if (!reservationError && activeReservation) {
        reservationId = activeReservation.id;
        console.info('[POS] saveOrder: found active reservation', { reservationId, currentStatus: activeReservation.status });
        
        // Analyze basket items to determine what courses are being ordered
        const hasStarters = basketItems.some(item => item.courseType === 'starter');
        const hasMains = basketItems.some(item => item.courseType === 'main');
        const hasDesserts = basketItems.some(item => item.courseType === 'dessert');
        const hasDrinks = basketItems.some(item => item.courseType === 'drinks');
        
        console.info('[POS] saveOrder: basket analysis', { hasStarters, hasMains, hasDesserts, hasDrinks });
        
        // Determine reservation status based on what's ordered
        // Note: Drinks don't affect reservation status since they don't go to kitchen
        if (hasStarters && !hasMains && !hasDesserts) {
          newReservationStatus = 'waiting-for-starters';
        } else if (hasStarters && hasMains) {
          newReservationStatus = 'waiting-for-starters'; // Start with starters
        } else if (hasMains && !hasStarters) {
          newReservationStatus = 'waiting-for-mains';
        } else if (hasDesserts && !hasStarters && !hasMains) {
          newReservationStatus = 'waiting-for-desserts';
        }
        // If only drinks, newReservationStatus stays null (no kitchen status update needed)
        
        console.info('[POS] saveOrder: determined reservation status', { newReservationStatus });
      } else {
        console.info('[POS] saveOrder: no active reservation found for table', { tableNumber: orderAssignment.tableNumber });
      }
    }

    // Get next order number
    console.info('[POS] saveOrder: requesting next order number', { companyId: userData.company_id });
    const { data: orderNumberData, error: orderNumberError } = await supabase
      .rpc('get_next_order_number', { p_company_id: userData.company_id });

    if (orderNumberError) {
      console.error('[POS] saveOrder: error', { 
        step: 'get_next_order_number', 
        code: orderNumberError?.code, 
        message: orderNumberError?.message, 
        details: orderNumberError?.details, 
        hint: orderNumberError?.hint 
      });
      throw orderNumberError;
    }

    // Create order
    // Check if order contains any non-drink items that need kitchen preparation
    const requiresKitchen = hasKitchenItems(basketItems);

    const orderPayload = {
      company_id: userData.company_id,
      created_by: userId,
      order_number: orderNumberData,
      status,
      total_amount: total,
      amount_paid: 0,
      table_number: orderAssignment?.type === 'table' ? orderAssignment.tableNumber : null,
      customer_name: orderAssignment?.type === 'customer_name' ? orderAssignment.customerName : null,
      assignment_type: orderAssignment?.type || null,
      reservation_id: reservationId,
      scheduled_for: scheduledFor?.toISOString() || null,
      kitchen_status: requiresKitchen ? 'sent' : null,
      sent_to_kitchen_at: requiresKitchen ? new Date().toISOString() : null,
    };
    console.info('[POS] saveOrder: creating order', { 
      payload: orderPayload,
      requiresKitchen,
      drinkItemsCount: basketItems.filter(i => i.courseType === 'drinks').length,
      foodItemsCount: basketItems.filter(i => i.courseType !== 'drinks').length
    });

    const { data: order, error: orderError } = await offlineAwareInsert('orders', orderPayload);

    if (orderError) {
      console.error('[POS] saveOrder: error', { 
        step: 'insert_order', 
        code: orderError?.code, 
        message: orderError?.message, 
        details: orderError?.details, 
        hint: orderError?.hint 
      });
      throw orderError;
    }

    console.info('[POS] saveOrder: order created', { orderId: order.id, orderNumber: orderNumberData });

    // Create order items
    const orderItems = basketItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.menuItem.id,
      quantity: item.quantity,
      quantity_paid: item.quantityPaid || 0,
      payment_status: (item.quantityPaid || 0) >= item.quantity ? 'paid' : 
                      (item.quantityPaid || 0) > 0 ? 'partially_paid' : 'unpaid',
      unit_price: item.unitPrice,
      course_type: item.courseType,
      basket_item_id: item.id,
      notes: item.notes || null,
      modifications: (item.configuration || null) as any,
    }));

    console.info('[POS] saveOrder: order_items payload (preview)', {
      count: orderItems.length,
      sample: orderItems[0] ? {
        ...orderItems[0],
        hasSubtotalKey: Object.prototype.hasOwnProperty.call(orderItems[0], 'subtotal'),
      } : null
    });

    // Insert each item individually using offline-aware function
    const itemsData: any[] = [];
    let itemsError = null;
    for (const item of orderItems) {
      const { data: insertedItem, error: itemError } = await offlineAwareInsert('order_items', item);
      if (itemError) {
        itemsError = itemError;
        break;
      }
      if (insertedItem) itemsData.push(insertedItem);
    }

    if (itemsError) {
      console.error('[POS] saveOrder: error', { 
        step: 'insert_items', 
        code: itemsError?.code, 
        message: itemsError?.message, 
        details: itemsError?.details, 
        hint: itemsError?.hint 
      });
      throw itemsError;
    }

    console.info('[POS] saveOrder: order_items insert success', { inserted: itemsData?.length });

    // Update reservation status if applicable
    if (reservationId && newReservationStatus) {
      console.info('[POS] saveOrder: updating reservation status', { reservationId, newStatus: newReservationStatus });
      const { error: reservationUpdateError } = await offlineAwareUpdate('reservations', reservationId, { status: newReservationStatus });
      
      if (reservationUpdateError) {
        console.error('[POS] saveOrder: failed to update reservation status', {
          code: reservationUpdateError?.code,
          message: reservationUpdateError?.message,
        });
        // Don't throw - order was created successfully
      } else {
        console.info('[POS] saveOrder: reservation status updated successfully');
      }
    }

    return { orderNumber: orderNumberData, orderId: order.id };
  };

  return { saveOrder };
};
