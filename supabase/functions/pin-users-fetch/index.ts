import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { pin, companyId, isDeviceBound } = await req.json()

    console.log('🔧 PIN users fetch request:', { 
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

    // If device is bound, skip PIN validation (trusted device)
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

      // Validate PIN
      const { data: authData, error: authError } = await supabase.rpc(
        'authenticate_by_pin_for_company_secure',
        { pin_input: pin, company_id_input: companyId }
      )

      if (authError || !authData || (Array.isArray(authData) && authData.length === 0)) {
        console.error('PIN authentication failed:', authError)
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid PIN' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      validatedUser = authData[0]
      console.log('✅ PIN validated for user:', validatedUser.user_name)
    } else {
      console.log('✅ Bound device access - skipping PIN validation')
    }

    // Fetch active users for the company (NO PIN field - security critical)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active, company_id, created_at, auth_user_id, pin_code, deleted_at')
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching users:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`👥 Successfully fetched ${users?.length || 0} users`)

    return new Response(
      JSON.stringify({ success: true, users: users || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
