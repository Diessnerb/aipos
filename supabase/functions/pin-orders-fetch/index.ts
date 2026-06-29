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

    const { pin, companyId, isDeviceBound, fetchAll } = await req.json()

    console.log('🔧 PIN orders fetch request:', { 
      pin: pin ? '[REDACTED]' : 'null', 
      companyId,
      isDeviceBound: isDeviceBound || false,
      fetchAll: fetchAll || false
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

    // If device is bound, skip PIN validation
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

    // Fetch orders with related data
    let queryBuilder = supabaseServiceRole
      .from('orders')
      .select(`
        id,
        external_pos_order_id,
        table_number,
        table_numbers,
        customer_name,
        status,
        total_amount,
        ordered_at,
        created_at,
        pos_metadata,
        reservation_id,
        kitchen_status,
        assignment_type,
        current_course_started_at,
        payment_status,
        created_by_user:users!orders_created_by_fkey(id, full_name),
        customer:customers(id, name, email, phone),
        payments(
          id,
          amount,
          method,
          paid_at,
          paid_by_user:users!payments_paid_by_fkey(id, full_name)
        ),
        reservation:reservations(id, status, customer_name),
        order_items(
          id,
          quantity,
          unit_price,
          subtotal,
          course_type,
          is_prepared,
          modifications,
          notes,
          menu_items(id, name, category_id)
        )
      `)
      .eq('company_id', companyId)
    
    // Only filter by kitchen_status if NOT fetching all orders
    if (!fetchAll) {
      queryBuilder = queryBuilder.in('kitchen_status', ['sent', 'preparing'])
    }
    
    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .limit(fetchAll ? 2000 : 100)
    
    const { data: orders, error: ordersError } = await queryBuilder

    if (ordersError) {
      console.error('🍽️ Error fetching orders:', ordersError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch orders' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🍽️ Successfully fetched ${orders?.length || 0} orders`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        orders: orders || [],
        user: validatedUser?.user_name,
        userRole: validatedUser?.user_role
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 PIN orders fetch error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})