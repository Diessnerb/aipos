import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

// Normalize UK phone number to 11-digit format starting with 0
function normalizeUKPhone(phone: string): string | null {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('44')) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  if (cleaned.length === 11 && /^0[127]/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Phone agent webhook received:', payload);

    const {
      company_id,
      phone_number,
      call_duration,
      successful_booking,
      reservation_details,
      source_post_id,
      call_recording_url,
      notes
    } = payload;

    // Validate required fields
    if (!company_id || !phone_number) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: company_id, phone_number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let reservation_id = null;

    // If booking was successful, create or link reservation
    if (successful_booking && reservation_details) {
      console.log('Processing successful booking:', reservation_details);
      
      // Create reservation record with normalized phone
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          company_id,
          customer_name: reservation_details.customer_name,
          phone: phone_number ? normalizeUKPhone(phone_number) : null,
          email: reservation_details.email,
          party_size: reservation_details.party_size,
          date: reservation_details.date,
          time: reservation_details.time,
          notes: `Phone booking via marketing agent. ${reservation_details.notes || ''}`.trim(),
          status: 'confirmed',
        })
        .select()
        .single();

      if (reservationError) {
        console.error('Error creating reservation:', reservationError);
      } else {
        reservation_id = reservation.id;
        console.log('Reservation created:', reservation_id);
      }
    }

    // Record the phone agent interaction
    const { data: phoneRecord, error: phoneError } = await supabase
      .from('phone_agent_reservations')
      .insert({
        company_id,
        reservation_id,
        source_post_id: source_post_id || null,
        phone_number,
        call_duration: call_duration || 0,
        successful_booking: successful_booking || false,
        call_recording_url: call_recording_url || null,
        notes: notes || null,
        called_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (phoneError) {
      console.error('Error recording phone interaction:', phoneError);
      throw phoneError;
    }

    // Update analytics for phone agent performance
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    // Track calls
    await supabase.from('marketing_analytics').upsert({
      company_id,
      platform: 'sms', // Using SMS as catch-all for phone agent
      metric_type: 'clicks', // Using clicks as calls
      metric_value: 1,
      date: today,
      hour: currentHour,
    });

    // Track successful reservations
    if (successful_booking) {
      await supabase.from('marketing_analytics').upsert({
        company_id,
        platform: 'sms',
        metric_type: 'reach', // Using reach as successful bookings
        metric_value: 1,
        date: today,
        hour: currentHour,
      });
    }

    console.log('Phone agent webhook processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        phone_record_id: phoneRecord.id,
        reservation_id,
        message: 'Phone agent interaction recorded successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Phone agent webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});