import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { pin, companyId, isDeviceBound } = await req.json()

    console.log('🏪 PIN Tables Fetch:', { companyId, hasPin: !!pin, isDeviceBound })

    // For device-bound scenarios, skip PIN validation if device is already bound
    if (!isDeviceBound && !pin) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN required for non-bound devices' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate PIN against company if not device-bound
    if (!isDeviceBound) {
      const { data: pinUser } = await supabase.rpc('authenticate_by_pin_for_company_secure', {
        pin_input: pin,
        company_id_input: companyId
      })

      if (!pinUser || (Array.isArray(pinUser) && pinUser.length === 0)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid PIN' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch tables for the company
    const { data: tables, error } = await supabase
      .from('tables')
      .select('*')
      .eq('company_id', companyId)
      .order('table_number', { ascending: true })

    if (error) {
      console.error('Tables fetch error:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch tables' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tables: tables || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('PIN Tables Fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})