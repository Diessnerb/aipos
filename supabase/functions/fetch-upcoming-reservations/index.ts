import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('X-Integration-Token') || req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authentication token');
    }

    const { company_id } = await req.json();
    
    console.log('📞 Fetching reservations for company:', company_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if SMS reminders are enabled for this company
    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('sms_reminders_enabled')
      .eq('company_id', company_id)
      .single();

    if (settingsError || !companySettings?.sms_reminders_enabled) {
      console.log('❌ SMS reminders disabled for company:', company_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'SMS reminders are disabled for this company',
          reservations: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Calculate the target date (today, not tomorrow)
    const now = new Date();
    const targetDate = now.toISOString().split('T')[0];

    console.log('🎯 Target date (today):', targetDate);

    // 3. Fetch confirmed reservations that need reminders
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, customer_name, phone, email, date, time, party_size, table_number, table_numbers, customer_id')
      .eq('company_id', company_id)
      .eq('date', targetDate)
      .in('status', ['confirmed', 'pending'])
      .eq('reminder_sent', false)
      .not('phone', 'is', null);

    if (reservationsError) {
      throw reservationsError;
    }

    if (!reservations || reservations.length === 0) {
      console.log('✅ No reservations need reminders');
      return new Response(
        JSON.stringify({ success: true, reservations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${reservations.length} reservation(s) needing reminders`);

    // 4. Fetch customer opt-out status
    const customerIds = reservations
      .map(r => r.customer_id)
      .filter((id): id is string => id != null);

    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, phone, sms_opt_out, do_not_contact')
      .in('id', customerIds);

    if (customersError) {
      console.error('⚠️ Error fetching customers:', customersError);
    }

    // Create a map for quick lookup
    const customerOptOutMap = new Map(
      customers?.map(c => [c.phone, { sms_opt_out: c.sms_opt_out, do_not_contact: c.do_not_contact }]) || []
    );

    // 5. Filter out opted-out customers
    const eligibleReservations = reservations.filter(reservation => {
      const customerStatus = customerOptOutMap.get(reservation.phone);
      
      if (!customerStatus) {
        return true; // No customer record found, allow SMS
      }
      
      if (customerStatus.sms_opt_out) {
        console.log(`❌ Customer ${reservation.phone} has opted out of SMS`);
        return false;
      }
      
      if (customerStatus.do_not_contact) {
        console.log(`❌ Customer ${reservation.phone} has do-not-contact flag set`);
        return false;
      }
      
      return true;
    });

    console.log(`✅ ${eligibleReservations.length} eligible reservation(s) after filtering opt-outs`);

    return new Response(
      JSON.stringify({ success: true, reservations: eligibleReservations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});