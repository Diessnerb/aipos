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

    // Fetch product links
    console.log('📦 Fetching product links for company:', companyId)
    const { data: productLinks, error } = await supabase
      .from('product_links')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (error) {
      console.error('❌ Error fetching product links:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Group by menu_item_id (matching the format useMenuItemProductLinks expects)
    const grouped: Record<string, any[]> = {}
    if (productLinks) {
      productLinks.forEach((link) => {
        if (!grouped[link.menu_item_id]) {
          grouped[link.menu_item_id] = []
        }
        grouped[link.menu_item_id].push(link)
      })
    }

    console.log(`✅ Product links fetched: ${productLinks?.length || 0} links for ${Object.keys(grouped).length} menu items`)
    return new Response(
      JSON.stringify({ success: true, productLinks: grouped }),
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
