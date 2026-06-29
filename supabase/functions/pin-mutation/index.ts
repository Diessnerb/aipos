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

    const { companyId, table, operation, id, data, isDeviceBound } = await req.json()

    console.log('🔧 PIN mutation request:', { 
      companyId,
      table,
      operation,
      id: id || 'N/A',
      isDeviceBound: isDeviceBound || false
    })

    // Tables that don't have a direct company_id column (they reference through parent)
    const tablesWithoutCompanyId = ['delivery_order_items', 'order_items', 'menu_product_links']

    if (!companyId || !table || !operation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company ID, table, and operation required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For device-bound mutations, skip PIN validation (device is already bound)
    if (!isDeviceBound) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN required for non-bound devices' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Device-bound mutation - proceeding without PIN')

    let result
    if (operation === 'insert') {
      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data required for insert operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Only add company_id for tables that have it
      const insertPayload = tablesWithoutCompanyId.includes(table)
        ? data
        : { ...data, company_id: companyId }

      const { data: insertData, error } = await supabaseServiceRole
        .from(table)
        .insert([insertPayload])
        .select()
        .single()

      result = { data: insertData, error }
    } else if (operation === 'update') {
      if (!id || !data) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID and data required for update operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Build query conditionally based on whether table has company_id
      let query = supabaseServiceRole
        .from(table)
        .update(data)
        .eq('id', id)
      
      if (!tablesWithoutCompanyId.includes(table)) {
        query = query.eq('company_id', companyId)
      }
      
      const { data: updateData, error } = await query.select().single()

      result = { data: updateData, error }
    } else if (operation === 'delete') {
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID required for delete operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Handle tables without direct company_id column
      if (table === 'order_items') {
        // For order_items, verify company ownership through the parent order
        const { data: orderItem, error: fetchError } = await supabaseServiceRole
          .from('order_items')
          .select('order_id, orders!inner(company_id)')
          .eq('id', id)
          .single()

        if (fetchError || !orderItem) {
          console.error('❌ Failed to fetch order_item:', fetchError)
          result = { data: null, error: fetchError || new Error('Order item not found') }
        } else if (orderItem.orders.company_id !== companyId) {
          console.error('❌ Company mismatch for order_item')
          result = { data: null, error: new Error('Unauthorized: company mismatch') }
        } else {
          // Company verified, proceed with deletion
          const { error } = await supabaseServiceRole
            .from('order_items')
            .delete()
            .eq('id', id)
          
          result = { data: { id }, error }
        }
      } else {
        // Standard delete with company_id filter
        const { error } = await supabaseServiceRole
          .from(table)
          .delete()
          .eq('id', id)
          .eq('company_id', companyId)

        result = { data: { id }, error }
      }
    } else if (operation === 'fetch') {
      // Fetch operation - use service role to bypass RLS
      const { filters } = data || {}
      
      let query = supabaseServiceRole.from(table).select('*')
      
      // Apply filters if provided
      if (filters && Array.isArray(filters)) {
        filters.forEach(filter => {
          query = query.eq(filter.column, filter.value)
        })
      }
      
      const { data: fetchData, error: fetchError } = await query
      
      if (fetchError) {
        console.error('❌ Fetch operation failed:', fetchError)
        return new Response(
          JSON.stringify({ success: false, error: fetchError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      console.log(`✅ Fetch operation successful for ${table}:`, fetchData?.length || 0, 'rows')
      
      return new Response(
        JSON.stringify({ success: true, data: fetchData }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid operation. Must be insert, update, delete, or fetch' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (result.error) {
      console.error(`❌ Error with ${operation} on ${table}:`, result.error)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to ${operation} ${table}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`✅ Successfully ${operation}d ${table}:`, result.data?.id || 'N/A')

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result.data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 PIN mutation error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
