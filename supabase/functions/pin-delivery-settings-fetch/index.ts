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

    const { pin, companyId, isDeviceBound } = await req.json()

    console.log('🔧 PIN delivery settings fetch request:', { 
      pin: pin ? '[REDACTED]' : 'null', 
      companyId,
      isDeviceBound: isDeviceBound || false
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

    // Fetch delivery settings
    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from('delivery_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (settingsError) {
      console.error('⚙️ Error fetching delivery settings:', settingsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch delivery settings' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`⚙️ Successfully fetched delivery settings:`, settings ? 'found' : 'not found')

    return new Response(
      JSON.stringify({ 
        success: true, 
        settings: settings || null,
        user: validatedUser?.user_name,
        userRole: validatedUser?.user_role
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 PIN delivery settings fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
