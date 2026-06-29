import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize UK phone number to 11-digit format starting with 0
function normalizeUKPhone(phone: string): string | null {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('44')) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  if (cleaned.length === 11 && /^0[127]/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
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

    const { pin, companyId, customer, operation } = await req.json()

    console.log('🔧 PIN customer save request:', { 
      pin: pin ? '[REDACTED]' : 'null', 
      companyId,
      operation,
      customerId: customer?.id
    })

    if (!pin || !companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN and company ID required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate PIN using secure RPC function
    const { data: pinValidation, error: pinError } = await supabaseServiceRole
      .rpc('authenticate_by_pin_for_company_secure', {
        pin_input: pin,
        company_id_input: companyId
      })

    if (pinError || !pinValidation) {
      console.log('🔐 PIN validation failed:', pinError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PIN or company access' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ PIN validated for user:', pinValidation.full_name)

    let result
    if (operation === 'create') {
      if (!customer) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer data required for create operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const normalizedCustomer = {
        ...customer,
        phone: customer.phone ? normalizeUKPhone(customer.phone) : null,
        company_id: companyId
      };
      
      const { data, error } = await supabaseServiceRole
        .from('customers')
        .insert([normalizedCustomer])
        .select()
        .single()

      result = { data, error }
    } else if (operation === 'update') {
      if (!customer?.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID required for update operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const normalizedCustomer = {
        ...customer,
        phone: customer.phone ? normalizeUKPhone(customer.phone) : null
      };
      
      const { data, error } = await supabaseServiceRole
        .from('customers')
        .update(normalizedCustomer)
        .eq('id', customer.id)
        .eq('company_id', companyId)
        .select()
        .single()

      result = { data, error }
    } else if (operation === 'delete') {
      if (!customer?.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer ID required for delete operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const { error } = await supabaseServiceRole
        .from('customers')
        .delete()
        .eq('id', customer.id)
        .eq('company_id', companyId)

      result = { data: { id: customer.id }, error }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid operation. Must be create, update, or delete' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (result.error) {
      console.error('👥 Error with customer operation:', result.error)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to ${operation} customer` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`👥 Successfully ${operation}d customer:`, result.data?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result.data,
        user: pinValidation.full_name
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🚨 PIN customer save error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})