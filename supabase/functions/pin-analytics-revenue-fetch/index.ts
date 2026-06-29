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

    console.log('🔧 PIN analytics revenue fetch request:', { 
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

    // Fetch daily revenue analytics (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: dailyAnalytics, error: dailyError } = await supabaseServiceRole
      .from('daily_revenue_analytics')
      .select('*')
      .eq('company_id', companyId)
      .gte('analytics_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('analytics_date', { ascending: true })

    if (dailyError) {
      console.error('📊 Error fetching daily analytics:', dailyError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch daily analytics' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch table performance metrics (today)
    const today = new Date().toISOString().split('T')[0]
    const { data: tableMetrics, error: tableError } = await supabaseServiceRole
      .from('table_performance_metrics')
      .select('*')
      .eq('company_id', companyId)
      .eq('metrics_date', today)
      .order('total_revenue', { ascending: false })

    if (tableError) {
      console.error('📊 Error fetching table metrics:', tableError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch table metrics' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`📊 Successfully fetched ${dailyAnalytics?.length || 0} daily analytics and ${tableMetrics?.length || 0} table metrics`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        dailyAnalytics: dailyAnalytics || [],
        tableMetrics: tableMetrics || [],
        user: validatedUser?.user_name,
        userRole: validatedUser?.user_role
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 PIN analytics revenue fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
