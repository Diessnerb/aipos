import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetRequest {
  pin?: string
  companyId: string
  isAuthenticatedAdmin?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(
      'https://blsrpowvuxcvhqkeykyi.supabase.co',
      serviceRoleKey
    )

    const { pin, companyId, isAuthenticatedAdmin }: GetRequest = await req.json()

    console.log(`🔍 Settings get request:`, {
      companyId,
      pinReceived: !!pin,
      isAuthenticatedAdmin: !!isAuthenticatedAdmin
    })

    // Check authentication - either PIN or authenticated admin session
    if (!isAuthenticatedAdmin && pin) {
      // Validate PIN for the company
      console.log('🔍 Validating PIN with database...')
      const { data: validatedCompanyId, error: pinError } = await supabase.rpc('get_company_for_pin_user', {
        pin_input: pin
      })

      if (pinError) {
        console.error('PIN validation error:', pinError)
        throw new Error('PIN validation failed')
      }

      if (!validatedCompanyId || validatedCompanyId !== companyId) {
        console.error(`PIN validation failed: expected company ${companyId}, got ${validatedCompanyId}`)
        throw new Error('Invalid PIN for this company')
      }

      console.log(`✅ PIN validated successfully for company: ${companyId}`)
    } else if (!isAuthenticatedAdmin && !pin) {
      throw new Error('Authentication required: provide either PIN or admin session')
    } else if (isAuthenticatedAdmin) {
      console.log(`✅ Using authenticated admin session for company: ${companyId}`)
    }

    // Fetch both company_settings and companies data
    const [settingsResult, companyResult] = await Promise.all([
      supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .maybeSingle()
    ])

    const { data: settingsData, error: settingsError } = settingsResult
    const { data: companyData, error: companyError } = companyResult

    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      throw settingsError
    }

    if (companyError) {
      console.error('Error fetching company:', companyError)
      throw companyError
    }

    // Return settings with authoritative company name
    const finalSettings = settingsData ? {
      ...settingsData,
      company_name: companyData?.name || settingsData.company_name
    } : null

    console.log(`✅ Settings retrieved successfully for company: ${companyId}`)

    return new Response(JSON.stringify({
      success: true,
      data: finalSettings,
      companyName: companyData?.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in company-settings-get:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})