import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { pin, companyId, isDeviceBound, startDate, endDate } = await req.json()

    console.log('🔧 PIN wastage fetch request:', { 
      pin: pin ? '[REDACTED]' : 'null', 
      companyId,
      isDeviceBound: isDeviceBound || false,
      startDate: startDate || 'not specified',
      endDate: endDate || 'not specified'
    })

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company ID required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let validatedUser = null

    if (!isDeviceBound) {
      if (!pin) {
        return new Response(
          JSON.stringify({ success: false, error: 'PIN required for non-bound devices' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const { data: pinValidation, error: pinError } = await supabaseServiceRole
        .rpc('authenticate_by_pin_for_company_secure', {
          pin_input: pin,
          company_id_input: companyId
        })

      if (pinError || !pinValidation || pinValidation.length === 0) {
        console.log('🔐 PIN validation failed:', pinError?.message || 'No matching user found')
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid PIN or company access' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      validatedUser = pinValidation[0]
      console.log('✅ PIN validated for user:', validatedUser.user_name)
    } else {
      console.log('✅ Bound device access - skipping PIN validation')
    }

    // Fetch wastage logs with ingredient details
    let query = supabaseServiceRole
      .from('wastage_log')
      .select(`
        *,
        ingredient:ingredients(
          name, 
          supplier, 
          known_as, 
          portion_type,
          cost_price,
          purchase_price,
          purchase_size,
          purchase_type,
          portion_size,
          units_per_purchase
        )
      `)
      .eq('company_id', companyId);

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('wastage_time', startDate);
    }
    if (endDate) {
      query = query.lte('wastage_time', endDate);
    }

    query = query.order('wastage_time', { ascending: false });

    const { data: wastageLogs, error: wastageError } = await query;

    if (wastageError) {
      console.error('🗑️ Error fetching wastage logs:', wastageError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch wastage logs' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🗑️ Successfully fetched ${wastageLogs?.length || 0} wastage logs`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        wastageLogs: wastageLogs || [],
        user: validatedUser?.user_name,
        userRole: validatedUser?.user_role
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 PIN wastage fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})