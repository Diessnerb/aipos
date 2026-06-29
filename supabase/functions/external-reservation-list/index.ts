import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-token',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create service role client for RLS bypass
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get integration token from header
    const integrationToken = req.headers.get('x-integration-token')
    if (!integrationToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integration token required in x-integration-token header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { date, time, company_id } = await req.json()

    console.log('🔧 External reservation list request:', { 
      date, 
      time, 
      company_id,
      token: integrationToken ? '[PRESENT]' : '[MISSING]'
    })

    // Validate required parameters
    if (!date || !time || !company_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: date, time, company_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate integration token and get company info
    const { data: integration, error: integrationError } = await supabaseServiceRole
      .from('integrations')
      .select('company_id, connected')
      .eq('auth_token', integrationToken)
      .eq('service_name', 'external_api')
      .eq('connected', true)
      .single()

    if (integrationError || !integration) {
      console.log('🔐 Integration token validation failed:', integrationError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired integration token' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify company access
    if (integration.company_id !== company_id) {
      console.log('🚫 Company access denied. Token company:', integration.company_id, 'Requested:', company_id)
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied for this company' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get all reservations for the specified date, time, and company where status is not cancelled
    console.log('Fetching reservations for date/time/company...')
    const { data: reservations, error: fetchError } = await supabaseServiceRole
      .from('reservations')
      .select('*')
      .eq('company_id', company_id)
      .eq('date', date)
      .eq('time', time.substring(0, 5)) // Compare just HH:MM part
      .neq('status', 'cancelled')
      .order('customer_name', { ascending: true })

    if (fetchError) {
      console.error('Error fetching reservations:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch reservations' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`📅 Found ${reservations?.length || 0} non-cancelled reservations`)

    return new Response(
      JSON.stringify({ 
        success: true,
        reservations: reservations || [],
        count: reservations?.length || 0,
        search_criteria: {
          date,
          time: time.substring(0, 5),
          company_id,
          excluded_status: 'cancelled'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 External reservation list error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})