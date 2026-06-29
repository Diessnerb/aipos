import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-token',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Method not allowed. Use POST.' 
        }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create supabase client with service role key to bypass RLS
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const integrationToken = req.headers.get('x-integration-token');
    
    if (!integrationToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing integration token. Include X-Integration-Token header.',
          example: 'X-Integration-Token: int_your_token_here'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔍 Health check request for token: ${integrationToken.substring(0, 8)}...`);

    // Validate integration token and get company details
    const { data: integration, error: integrationError } = await supabaseServiceRole
      .from('integrations')
      .select(`
        company_id, 
        service_name, 
        connected,
        created_at,
        last_synced_at,
        companies:company_id (
          id,
          name,
          status
        )
      `)
      .eq('auth_token', integrationToken)
      .eq('service_name', 'external_api')
      .single();

    if (integrationError || !integration) {
      console.log(`❌ Invalid integration token: ${integrationToken.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired integration token',
          details: 'Token not found or not configured for external_api service'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if integration is active
    if (!integration.connected) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Integration is disabled',
          details: 'Contact your admin to enable external API access'
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if company is active
    const company = integration.companies as any;
    if (!company || company.status !== 'active') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Company is inactive',
          details: 'Company account is not active'
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update last_synced_at to track health check
    await supabaseServiceRole
      .from('integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('auth_token', integrationToken)
      .eq('service_name', 'external_api');

    console.log(`✅ Health check successful for company: ${company.name}`);

    // Return success with company and integration details
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'API token is valid and ready to use',
        integration: {
          company_id: integration.company_id,
          company_name: company.name,
          service_name: integration.service_name,
          connected: integration.connected,
          created_at: integration.created_at,
          last_synced_at: integration.last_synced_at
        },
        endpoints: {
          reservation_ingest: `${Deno.env.get('SUPABASE_URL')}/functions/v1/external-reservation-ingest`,
          health_check: `${Deno.env.get('SUPABASE_URL')}/functions/v1/external-api-health`
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Health check error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: 'An unexpected error occurred during health check'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});