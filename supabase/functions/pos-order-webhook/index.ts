import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature-sha256',
};

interface POSOrderPayload {
  external_order_id: string;
  order_status: string;
  table_number?: number;
  table_numbers?: number[];
  total_amount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  customer_name?: string;
  ordered_at: string;
  pos_system: 'square' | 'toast' | 'clover';
  company_token: string;
  signature?: string;
  metadata?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: POSOrderPayload = await req.json();
    console.log('📦 Received POS order webhook:', payload);

    // Validate required fields
    if (!payload.external_order_id || !payload.company_token || !payload.total_amount) {
      console.error('❌ Missing required fields in payload');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find company by API token
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('company_id')
      .eq('auth_token', payload.company_token)
      .eq('service_name', 'external_api')
      .eq('connected', true)
      .single();

    if (integrationError || !integration) {
      console.error('❌ Invalid company token:', payload.company_token);
      return new Response(JSON.stringify({ error: 'Invalid company token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const companyId = integration.company_id;
    console.log('✅ Company verified:', companyId);

    // Find matching reservation by table and time (within 2 hours)
    let reservationId = null;
    const tableNumbers = payload.table_numbers || (payload.table_number ? [payload.table_number] : []);
    
    if (tableNumbers.length > 0) {
      const orderTime = new Date(payload.ordered_at);
      const timeStart = new Date(orderTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
      const timeEnd = new Date(orderTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours after

      const { data: reservation } = await supabase
        .from('reservations')
        .select('id')
        .eq('company_id', companyId)
        .eq('date', orderTime.toISOString().split('T')[0])
        .or(
          tableNumbers.map(num => `table_number.eq.${num},table_numbers.cs.{${num}}`).join(',')
        )
        .gte('time', timeStart.toTimeString().split(' ')[0])
        .lte('time', timeEnd.toTimeString().split(' ')[0])
        .in('status', ['confirmed', 'seated', 'waiting-for-order'])
        .order('time', { ascending: true })
        .limit(1)
        .single();

      if (reservation) {
        reservationId = reservation.id;
        console.log('🎯 Found matching reservation:', reservationId);
      }
    }

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('external_pos_order_id', payload.external_order_id)
      .eq('company_id', companyId)
      .single();

    let orderId: string;
    let operation: string;

    if (existingOrder) {
      // Update existing order
      operation = 'update';
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: payload.order_status,
          total_amount: payload.total_amount,
          pos_sync_status: 'synced',
          pos_metadata: payload.metadata || {},
          table_number: payload.table_number,
          table_numbers: tableNumbers,
          reservation_id: reservationId,
          ordered_at: payload.ordered_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingOrder.id);

      if (updateError) throw updateError;
      orderId = existingOrder.id;
      console.log('🔄 Updated existing order:', orderId);
    } else {
      // Create new order
      operation = 'create';
      const { data: newOrder, error: insertError } = await supabase
        .from('orders')
        .insert({
          external_pos_order_id: payload.external_order_id,
          company_id: companyId,
          status: payload.order_status,
          total_amount: payload.total_amount,
          pos_sync_status: 'synced',
          pos_metadata: payload.metadata || {},
          table_number: payload.table_number,
          table_numbers: tableNumbers,
          reservation_id: reservationId,
          customer_name: payload.customer_name,
          ordered_at: payload.ordered_at,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      orderId = newOrder!.id;
      console.log('✨ Created new order:', orderId);
    }

    // Update reservation status based on order status
    if (reservationId) {
      let newReservationStatus = '';
      switch (payload.order_status) {
        case 'pending':
        case 'confirmed':
          newReservationStatus = 'waiting-for-order';
          break;
        case 'preparing':
        case 'ready':
          newReservationStatus = 'waiting-for-mains';
          break;
        case 'served':
          newReservationStatus = 'eating-mains';
          break;
        case 'completed':
        case 'paid':
          newReservationStatus = 'bill-requested-waiting-to-pay';
          break;
      }

      if (newReservationStatus) {
        await supabase
          .from('reservations')
          .update({ status: newReservationStatus })
          .eq('id', reservationId);
        console.log('🔄 Updated reservation status:', newReservationStatus);
      }
    }

    // Process order items
    if (payload.items && payload.items.length > 0) {
      // Delete existing items for updates
      if (existingOrder) {
        await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);
      }

      // Insert new items
      const orderItems = payload.items.map(item => ({
        order_id: orderId,
        menu_item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        total_price: item.quantity * item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.warn('⚠️ Failed to insert order items:', itemsError);
      } else {
        console.log('📋 Inserted order items:', orderItems.length);
      }
    }

    // Log the sync operation
    await supabase
      .from('pos_order_sync_logs')
      .insert({
        company_id: companyId,
        external_pos_order_id: payload.external_order_id,
        sync_operation: operation,
        sync_status: 'success',
        order_id: orderId,
        pos_data: payload,
        synced_at: new Date().toISOString()
      });

    console.log('✅ POS order webhook processed successfully');
    
    return new Response(JSON.stringify({ 
      success: true, 
      order_id: orderId,
      operation,
      reservation_linked: !!reservationId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ POS webhook error:', error);
    
    // Log the failed sync
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const payload = await req.json();
      
      await supabase
        .from('pos_order_sync_logs')
        .insert({
          external_pos_order_id: payload.external_order_id || 'unknown',
          sync_operation: 'webhook_received',
          sync_status: 'failed',
          pos_data: payload,
          error_details: error instanceof Error ? error.message : 'Unknown error',
          synced_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});