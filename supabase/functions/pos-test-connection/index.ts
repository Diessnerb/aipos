import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { pos_system, credentials } = await req.json()

    console.log('Testing POS connection:', { pos_system })

    let connectionResult;
    
    switch (pos_system) {
      case 'square':
        connectionResult = await testSquareConnection(credentials)
        break
      case 'toast':
        connectionResult = await testToastConnection(credentials)
        break
      case 'clover':
        connectionResult = await testCloverConnection(credentials)
        break
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unsupported POS system: ${pos_system}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

    return new Response(
      JSON.stringify(connectionResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('POS connection test error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred during connection test'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function testSquareConnection(credentials: any) {
  try {
    const { access_token, application_id, environment } = credentials
    
    if (!access_token) {
      return { success: false, error: 'Missing access token' }
    }

    const baseUrl = environment === 'production' 
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    // Test connection by fetching locations
    const response = await fetch(`${baseUrl}/v2/locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Square-Version': '2023-10-18',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { 
        success: false, 
        error: `Square API error: ${errorData.errors?.[0]?.detail || response.statusText}` 
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      message: 'Square connection successful',
      locations: data.locations?.length || 0,
      merchant_name: data.locations?.[0]?.business_name || 'Unknown'
    }

  } catch (error) {
    return {
      success: false,
      error: `Square connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

async function testToastConnection(credentials: any) {
  try {
    const { client_id, client_secret, restaurant_guid, access_token } = credentials
    
    if (!access_token && (!client_id || !client_secret)) {
      return { success: false, error: 'Missing required credentials' }
    }

    // For testing, we'll just validate the token format
    // In a real implementation, you'd make an API call to Toast
    const baseUrl = 'https://ws-api.toasttab.com'
    
    // Test with a simple API call to get restaurant info
    const response = await fetch(`${baseUrl}/restaurants/v1/restaurants/${restaurant_guid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { 
        success: false, 
        error: `Toast API error: ${response.statusText}` 
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      message: 'Toast connection successful',
      restaurant_name: data.restaurantName || 'Unknown',
      restaurant_guid: data.guid
    }

  } catch (error) {
    return {
      success: false,
      error: `Toast connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

async function testCloverConnection(credentials: any) {
  try {
    const { access_token, merchant_id, environment } = credentials
    
    if (!access_token || !merchant_id) {
      return { success: false, error: 'Missing access token or merchant ID' }
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.clover.com'
      : 'https://sandbox.dev.clover.com'

    // Test connection by fetching merchant info
    const response = await fetch(`${baseUrl}/v3/merchants/${merchant_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { 
        success: false, 
        error: `Clover API error: ${errorData.message || response.statusText}` 
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      message: 'Clover connection successful',
      merchant_name: data.name || 'Unknown',
      merchant_id: data.id
    }

  } catch (error) {
    return {
      success: false,
      error: `Clover connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}