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

    // Validate PIN if device is not bound
    if (!isDeviceBound && pin) {
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
    }

    // Fetch menu items with category_type from menu_categories
    console.log('📦 Fetching menu items for company:', companyId)
    const { data: items, error } = await supabase
      .from('menu_items')
      .select('id, name, description, price, category_id, company_id, display_order, menu_categories!inner(category_type)')
      .eq('company_id', companyId)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('❌ Error fetching menu items:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Transform to flatten category_type
    const normalizedItems = (items || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category_id: item.category_id,
      company_id: item.company_id,
      display_order: item.display_order,
      category_type: item.menu_categories?.category_type || 'mains'
    }))

    console.log('✅ Menu items fetched:', normalizedItems.length)
    return new Response(
      JSON.stringify({ success: true, items: normalizedItems }),
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
