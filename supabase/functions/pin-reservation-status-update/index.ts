import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize UK phone number to 11-digit format
function normalizeUKPhone(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Convert +44 or 44 prefix to 0
  if (cleaned.startsWith('44')) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  // Must be exactly 11 digits starting with 07, 01, or 02
  if (cleaned.length === 11 && /^0[127]/.test(cleaned)) {
    return cleaned;
  }
  
  return null; // Invalid UK phone
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { pin, companyId, reservationId, newStatus } = await req.json();

    if (!pin || !companyId || !reservationId || !newStatus) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate PIN using secure RPC function
    const { data: userData, error: userError } = await supabaseAdmin
      .rpc('authenticate_by_pin_for_company_secure', {
        pin_input: pin,
        company_id_input: companyId
      });

    if (userError || !userData || !Array.isArray(userData) || userData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PIN' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get reservation details
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('company_id', companyId)
      .single();

    if (fetchError || !reservation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Reservation not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Increment visit count if status is changing to 'completed'
    if (newStatus === 'completed' && reservation.phone) {
      const normalizedPhone = normalizeUKPhone(reservation.phone);
      
      if (normalizedPhone) {
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('id, visits')
          .eq('company_id', companyId)
          .eq('phone', normalizedPhone);

        if (customers && customers.length > 0) {
          const customer = customers[0];
          await supabaseAdmin
            .from('customers')
            .update({
              visits: (customer.visits || 0) + 1,
              last_visit: reservation.date,
            })
            .eq('id', customer.id);

          console.log('✅ Visit count incremented via PIN mode:', customer.id);
        } else {
          console.warn('⚠️ No customer found for phone:', normalizedPhone);
        }
      }
    }

    // Track late arrivals when moving from 'late' to 'seated'
    if (newStatus === 'seated' && reservation.status === 'late' && reservation.phone) {
      const normalizedPhone = normalizeUKPhone(reservation.phone);
      
      if (normalizedPhone) {
        // Calculate minutes late
        const scheduledDateTime = new Date(`${reservation.date}T${reservation.time}`);
        const nowTime = new Date();
        const minutesLate = Math.max(0, Math.round((nowTime.getTime() - scheduledDateTime.getTime()) / (1000 * 60)));
        
        // Insert late arrival event into history table
        await supabaseAdmin
          .from('customer_reservation_history')
          .insert({
            company_id: companyId,
            customer_name: reservation.customer_name,
            customer_email: reservation.email,
            customer_phone: normalizedPhone,
            reservation_id: reservation.id,
            event_type: 'late_arrival',
            scheduled_time: reservation.time,
            actual_arrival_time: nowTime.toISOString(),
            minutes_late: minutesLate,
            reservation_date: reservation.date,
            party_size: reservation.party_size
          });
        
        console.log(`✅ Recorded late arrival via PIN: ${minutesLate} minutes late`);
      }
    }

    // Track no-shows
    if (newStatus === 'no-show' && reservation.phone) {
      const normalizedPhone = normalizeUKPhone(reservation.phone);
      
      if (normalizedPhone) {
        // Insert no-show event into history table
        await supabaseAdmin
          .from('customer_reservation_history')
          .insert({
            company_id: companyId,
            customer_name: reservation.customer_name,
            customer_email: reservation.email,
            customer_phone: normalizedPhone,
            reservation_id: reservation.id,
            event_type: 'no_show',
            reservation_date: reservation.date,
            party_size: reservation.party_size
          });
        
        console.log(`✅ Recorded no-show via PIN`);
      }
    }

    // Prepare update data with timestamps
    const updateData: any = { status: newStatus };
    const now = new Date().toISOString();
    
    // Set timestamp when guests are seated
    if (newStatus === 'seated') {
      updateData.seated_at = now;
    }
    
    // Set timestamp when courses are served
    if (newStatus === 'starters-served') {
      updateData.starters_served_at = now;
    } else if (newStatus === 'mains-served') {
      updateData.mains_served_at = now;
    } else if (newStatus === 'desserts-served') {
      updateData.desserts_served_at = now;
    }
    
    // Clear seated timestamp if moving away from seated status
    if (newStatus !== 'seated' && reservation.status === 'seated') {
      updateData.seated_at = null;
    }
    
    // Clear timestamps if moving backwards in the flow
    if (newStatus === 'waiting-for-starters' || newStatus === 'starters-ready-in-kitchen') {
      updateData.starters_served_at = null;
    }
    if (newStatus === 'waiting-for-mains' || newStatus === 'mains-ready-in-kitchen') {
      updateData.mains_served_at = null;
    }
    if (newStatus === 'waiting-for-desserts' || newStatus === 'desserts-ready-in-kitchen') {
      updateData.desserts_served_at = null;
    }

    // Clear table assignments for cancelled/no-show reservations
    if (newStatus === 'cancelled' || newStatus === 'no-show') {
      updateData.table_number = null;
      updateData.table_numbers = null;
    }

    // Update reservation status and timestamps
    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update order's course start time when moving to waiting-for-X statuses (kitchen timer reset)
    if (reservation.id && (newStatus === 'waiting-for-starters' || 
        newStatus === 'waiting-for-mains' || 
        newStatus === 'waiting-for-desserts')) {
      console.log(`Resetting kitchen timer for ${newStatus}`);
      await supabaseAdmin
        .from('orders')
        .update({ current_course_started_at: new Date().toISOString() })
        .eq('reservation_id', reservation.id)
        .in('kitchen_status', ['sent', 'preparing']);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Unexpected error in pin-reservation-status-update:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
