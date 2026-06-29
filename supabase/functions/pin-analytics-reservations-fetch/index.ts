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

    console.log('🔧 PIN analytics reservations fetch request:', { 
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

    // Fetch total reservations (excluding cancelled)
    const { count: totalReservations, error: totalError } = await supabaseServiceRole
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .neq('status', 'cancelled')

    if (totalError) {
      console.error('📊 Error fetching total reservations:', totalError)
    }

    // Fetch monthly reservations (current month, excluding cancelled)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    const { count: monthlyReservations, error: monthlyError } = await supabaseServiceRole
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())
      .neq('status', 'cancelled')

    if (monthlyError) {
      console.error('📊 Error fetching monthly reservations:', monthlyError)
    }

    // Fetch total customers
    const { count: totalCustomers, error: customersError } = await supabaseServiceRole
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (customersError) {
      console.error('📊 Error fetching customers:', customersError)
    }

    // Fetch weekly new customers (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)
    const startOfWeekDate = sevenDaysAgo.toISOString().split('T')[0]
    
    const { count: weeklyNewCustomers, error: weeklyError } = await supabaseServiceRole
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('last_visit', startOfWeekDate)

    if (weeklyError) {
      console.error('📊 Error fetching weekly customers:', weeklyError)
    }

    console.log(`📊 Analytics: Total=${totalReservations}, Monthly=${monthlyReservations}, Customers=${totalCustomers}, Weekly=${weeklyNewCustomers}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalReservations: totalReservations || 0,
        monthlyReservations: monthlyReservations || 0,
        totalCustomers: totalCustomers || 0,
        weeklyNewCustomers: weeklyNewCustomers || 0,
        user: validatedUser?.user_name,
        userRole: validatedUser?.user_role
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 PIN analytics reservations fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
