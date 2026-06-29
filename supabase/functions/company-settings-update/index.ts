import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateRequest {
  pin?: string
  companyId: string
  updates: Record<string, any>
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

    const { pin, companyId, updates, isAuthenticatedAdmin }: UpdateRequest = await req.json()

    console.log(`🔐 Settings update request:`, {
      companyId,
      pinReceived: !!pin,
      pinLength: pin?.length,
      isAuthenticatedAdmin: !!isAuthenticatedAdmin,
      updatesKeys: Object.keys(updates || {})
    })

    // Check authentication - either PIN or authenticated admin session
    if (!isAuthenticatedAdmin && pin) {
      // Validate PIN for the company
      console.log('🔍 Validating PIN with database...')
      const { data: validatedCompanyId, error: pinError } = await supabase.rpc('get_company_for_pin_user', {
        pin_input: pin
      })

      console.log('📊 PIN validation result:', {
        validatedCompanyId,
        expectedCompanyId: companyId,
        pinError,
        match: validatedCompanyId === companyId
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

    // Whitelist allowed settings fields for security
    const allowedFields = [
      'auto_assign_tables',
      'optimization_enabled',
      'optimization_mode',
      'optimization_horizon_days',
      'quiet_hours_start',
      'quiet_hours_end',
      'strategic_optimization_enabled',
      'accessible_spare_target',
      'email',
      'phone',
      'website_url',
      'support_contact',
      'timezone',
      'primary_color',
      'secondary_color',
      'font_style',
      'button_style',
      'show_allergen_disclaimer',
      'terms_of_service_url',
      'privacy_policy_url',
      'terms_url',
      'pin_idle_timeout_seconds',
      'logo_url'
    ]

    // Filter updates to only allowed fields
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as Record<string, any>)

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }

    console.log(`📝 Updating fields: ${Object.keys(filteredUpdates).join(', ')}`)

    // Check if company_settings record exists
    const { data: existingSettings, error: fetchError } = await supabase
      .from('company_settings')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle()

    if (fetchError) {
      console.error('Error checking existing settings:', fetchError)
      throw fetchError
    }

    let result
    if (existingSettings) {
      // Update existing record
      const { data, error } = await supabase
        .from('company_settings')
        .update({
          ...filteredUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Create new record with defaults (optimization ON for new companies)
      const defaultSettings = {
        auto_assign_tables: true,
        optimization_enabled: true,
        optimization_mode: 'continuous',
        optimization_horizon_days: 90,
        quiet_hours_start: '00:00:00',
        quiet_hours_end: '06:00:00',
        strategic_optimization_enabled: true,
        accessible_spare_target: 1,
        pin_idle_timeout_seconds: 900,
        primary_color: '#6B7280',
        secondary_color: '#9CA3AF',
        font_style: 'inter',
        button_style: 'rounded',
        show_allergen_disclaimer: true
      }
      
      const { data, error } = await supabase
        .from('company_settings')
        .insert({
          company_id: companyId,
          ...defaultSettings,
          ...filteredUpdates,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    // Trigger continuous optimizer if optimization was just enabled
    if (filteredUpdates.optimization_enabled === true) {
      console.log('🚀 Triggering continuous optimizer...')
      try {
        const optimizerResponse = await fetch('https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/continuous-optimizer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({ triggered_by: 'settings_update', company_id: companyId })
        })
        
        if (optimizerResponse.ok) {
          console.log('✅ Continuous optimizer triggered successfully')
        } else {
          console.warn('⚠️ Failed to trigger continuous optimizer, but settings updated successfully')
        }
      } catch (optimizerError) {
        console.warn('⚠️ Error triggering continuous optimizer:', optimizerError)
        // Don't fail the settings update if optimizer trigger fails
      }
    }

    console.log(`✅ Settings updated successfully for company: ${companyId}`)

    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: 'Settings updated successfully via PIN authentication'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in company-settings-update:', error)
    
    // Log detailed error information
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'UnknownError'
    })
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 200, // Return 200 so Supabase doesn't treat it as a function error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})