import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📦 pin-menu-categories-fetch: Request received');
    
    const { companyId, isDeviceBound } = await req.json();
    
    if (!companyId) {
      console.error('❌ No companyId provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Company ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`🔍 Fetching categories for company: ${companyId} (bound: ${isDeviceBound})`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: categories, error } = await supabase
      .from('menu_categories')
      .select('id, name, description, category_type, parent_id, display_order, is_active, company_id, card_color, created_at, updated_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('display_order');
    
    if (error) {
      console.error('❌ Database error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`✅ Retrieved ${categories?.length || 0} categories`);
    
    return new Response(
      JSON.stringify({ success: true, categories: categories || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
