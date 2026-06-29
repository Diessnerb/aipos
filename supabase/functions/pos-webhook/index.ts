import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, company_id, pos_system, webhook_data } = await req.json()

    console.log('POS Webhook received:', { action, company_id, pos_system })

    if (action === 'manual_sync') {
      // Handle manual sync request
      const { data: credentials } = await supabase
        .from('pos_credentials')
        .select('encrypted_credentials, pos_system')
        .eq('company_id', company_id)
        .eq('pos_system', pos_system)
        .single()

      if (!credentials) {
        return new Response(
          JSON.stringify({ success: false, error: 'POS credentials not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Log sync attempt
      await supabase
        .from('pos_sync_logs')
        .insert({
          company_id,
          pos_system,
          sync_operation: 'manual_sync',
          sync_status: 'pending',
          sync_direction: 'bidirectional',
          items_processed: 0
        })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Manual sync initiated',
          sync_id: 'manual_' + Date.now()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'webhook_receive') {
      // Handle incoming webhook from POS system
      console.log('Processing webhook data:', webhook_data)
      
      // Parse webhook data based on POS system
      let processedData;
      switch (pos_system) {
        case 'square':
          processedData = await processSquareWebhook(webhook_data)
          break
        case 'toast':
          processedData = await processToastWebhook(webhook_data)
          break
        case 'clover':
          processedData = await processCloverWebhook(webhook_data)
          break
        default:
          throw new Error(`Unsupported POS system: ${pos_system}`)
      }

      // Log webhook processing
      await supabase
        .from('pos_webhook_logs')
        .insert({
          company_id,
          pos_system,
          webhook_type: webhook_data.type || 'unknown',
          webhook_data,
          processing_status: 'success',
          processed_at: new Date().toISOString()
        })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook processed successfully',
          processed_data: processedData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('POS webhook error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function processSquareWebhook(webhookData: any) {
  console.log('Processing Square webhook:', webhookData)
  
  // Handle different Square webhook event types
  switch (webhookData.type) {
    case 'catalog.version.updated':
      return { action: 'catalog_updated', items: [] }
    case 'inventory.count.updated':
      return { action: 'inventory_updated', items: [] }
    case 'order.created':
      return { action: 'order_created', order_id: webhookData.data?.object?.order?.id }
    default:
      return { action: 'unknown', type: webhookData.type }
  }
}

async function processToastWebhook(webhookData: any) {
  console.log('Processing Toast webhook:', webhookData)
  
  // Handle Toast webhook events
  switch (webhookData.eventType) {
    case 'MENU_ENTITY_UPDATED':
      return { action: 'menu_updated', entity: webhookData.entityType }
    case 'ORDER_CREATED':
      return { action: 'order_created', order_id: webhookData.guid }
    default:
      return { action: 'unknown', type: webhookData.eventType }
  }
}

async function processCloverWebhook(webhookData: any) {
  console.log('Processing Clover webhook:', webhookData)
  
  // Handle Clover webhook events
  switch (webhookData.type) {
    case 'CREATE':
      return { action: 'item_created', object_type: webhookData.objectType }
    case 'UPDATE':
      return { action: 'item_updated', object_type: webhookData.objectType }
    case 'DELETE':
      return { action: 'item_deleted', object_type: webhookData.objectType }
    default:
      return { action: 'unknown', type: webhookData.type }
  }
}