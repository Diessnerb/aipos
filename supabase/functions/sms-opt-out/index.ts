import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, company_id } = await req.json();
    
    if (!phone || !company_id) {
      throw new Error('Missing required fields: phone and company_id');
    }

    console.log('📵 Processing SMS opt-out for phone:', phone, 'company:', company_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the customer by phone number and company
    const { data: customer, error: findError } = await supabase
      .from('customers')
      .select('id, name, sms_opt_out')
      .eq('phone', phone)
      .eq('company_id', company_id)
      .single();

    if (findError || !customer) {
      console.error('❌ Customer not found:', findError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Customer not found' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if already opted out
    if (customer.sms_opt_out) {
      console.log('ℹ️ Customer already opted out');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Customer already opted out',
          customer_name: customer.name 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update customer to opt out
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        sms_opt_out: true,
        sms_opt_out_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Customer opted out successfully:', customer.name);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully opted out of SMS reminders',
        customer_name: customer.name 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error processing opt-out:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});