import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateRequest {
  pin?: string;
  companyId: string;
  updates: Record<string, any>;
  isAuthenticatedAdmin?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { pin, companyId, updates, isAuthenticatedAdmin }: UpdateRequest = await req.json();

    console.log('[delivery-settings-update] Request received', {
      companyId,
      hasPin: !!pin,
      isAuthenticatedAdmin,
      updateKeys: Object.keys(updates),
    });

    // Authentication
    let authenticated = false;

    if (isAuthenticatedAdmin) {
      console.log('[delivery-settings-update] Admin authentication');
      authenticated = true;
    } else if (pin && companyId) {
      console.log('[delivery-settings-update] PIN authentication');
      const { data: pinUser, error: pinError } = await supabase.rpc(
        'authenticate_by_pin_for_company_secure',
        { p_pin: pin, p_company_id: companyId }
      );

      if (pinError || !pinUser) {
        console.error('[delivery-settings-update] PIN authentication failed', pinError);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid PIN or company ID' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      authenticated = true;
      console.log('[delivery-settings-update] PIN authentication successful', { userId: pinUser.user_id });
    }

    if (!authenticated) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Whitelist allowed fields
    const allowedFields = [
      'auto_generate_orders',
      'require_approval',
      'auto_stock_deduction',
      'track_wastage',
      'enable_fifo_tracking',
      'enable_shelf_life_alerts',
      'low_stock_threshold_days',
      'lead_time_buffer_days',
      'profit_margin_alert_threshold',
    ];

    const filteredUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    console.log('[delivery-settings-update] Filtered updates', filteredUpdates);

    // Check if settings already exist
    const { data: existingSettings, error: fetchError } = await supabase
      .from('delivery_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (fetchError) {
      console.error('[delivery-settings-update] Error fetching settings', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let result;

    if (existingSettings) {
      // Update existing settings
      console.log('[delivery-settings-update] Updating existing settings', { id: existingSettings.id });
      const { data, error } = await supabase
        .from('delivery_settings')
        .update({ ...filteredUpdates, updated_at: new Date().toISOString() })
        .eq('id', existingSettings.id)
        .select()
        .single();

      if (error) {
        console.error('[delivery-settings-update] Error updating settings', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      result = data;
    } else {
      // Insert new settings with defaults
      console.log('[delivery-settings-update] Creating new settings');
      const defaultSettings = {
        company_id: companyId,
        auto_generate_orders: true,
        require_approval: true,
        auto_stock_deduction: true,
        track_wastage: true,
        enable_fifo_tracking: false,
        enable_shelf_life_alerts: false,
        low_stock_threshold_days: 3,
        lead_time_buffer_days: 1,
        profit_margin_alert_threshold: 30.0,
      };

      const { data, error } = await supabase
        .from('delivery_settings')
        .insert({ ...defaultSettings, ...filteredUpdates })
        .select()
        .single();

      if (error) {
        console.error('[delivery-settings-update] Error inserting settings', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      result = data;
    }

    console.log('[delivery-settings-update] Success', { id: result.id });

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[delivery-settings-update] Unexpected error', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
