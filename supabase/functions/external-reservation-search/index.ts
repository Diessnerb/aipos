import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-token',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('External reservation search request received')
    
    // Get integration token from headers
    const integrationToken = req.headers.get('x-integration-token')
    
    if (!integrationToken) {
      console.error('Missing integration token')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing integration token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { 
      customer_name, 
      date, 
      time, 
      company_id,
      threshold = 0.3,
      time_window_minutes = 30,
      limit = 10
    } = await req.json()
    
    console.log('Search parameters:', { customer_name, date, time, company_id, threshold, time_window_minutes, limit })

    // Validate required fields
    if (!customer_name || !date || !time || !company_id) {
      console.error('Missing required fields')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: customer_name, date, time, company_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Normalize time to HH:MM:SS format for database consistency
    const normalizedTime = time.length === 5 ? `${time}:00` : time
    console.log('Normalized time from', time, 'to', normalizedTime)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify integration token and get company
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('company_id, connected')
      .eq('auth_token', integrationToken)
      .eq('service_name', 'external_api')
      .single()

    if (integrationError || !integration || !integration.connected) {
      console.error('Invalid integration token:', integrationError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid integration token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify company_id matches the integration
    if (integration.company_id !== company_id) {
      console.error('Company ID mismatch')
      return new Response(
        JSON.stringify({ success: false, error: 'Company ID does not match integration' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Multi-tier search strategy for reservations
    let reservations = null
    let searchError = null
    let strategyUsed = 'exact'
    
    console.log('Starting search with strategy: exact/substring matching...')
    
    // Split the search name into components for better matching
    const nameParts = customer_name.toLowerCase().split(' ').filter((part: string) => part.length > 0)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    // Build multiple search patterns for exact/substring search
    const searchPatterns = [
      `%${customer_name}%`, // Full name substring
      `%${firstName}%${lastName}%`, // First + last name with wildcard between
      `${firstName}%`, // Just first name
      `%${lastName}%` // Just last name
    ].filter(pattern => pattern.length > 1)
    
    // TIER 1: Try exact and substring matches with normalized time
    const { data: exactResults, error: exactError } = await supabase
      .from('reservations')
      .select('*')
      .eq('company_id', company_id)
      .eq('date', date)
      .eq('time', normalizedTime)
      .or(searchPatterns.map(pattern => `customer_name.ilike.${pattern}`).join(','))
    
    if (exactResults && exactResults.length > 0) {
      reservations = exactResults
      strategyUsed = 'exact'
      console.log(`Found ${exactResults.length} exact/substring matches`)
    } else {
      console.log('No exact matches found, trying fuzzy matching...')
      
      // TIER 2: Try fuzzy matching with trigram similarity
      const { data: fuzzyResults, error: fuzzyError } = await supabase
        .rpc('search_reservations_fuzzy', {
          p_company_id: company_id,
          p_date: date,
          p_time: normalizedTime,
          p_customer_name: customer_name,
          p_similarity_threshold: threshold,
          p_time_window_minutes: time_window_minutes,
          p_limit: limit
        })
      
      if (fuzzyError) {
        console.log('Fuzzy search RPC failed:', fuzzyError.message, '- falling back to time window search')
        strategyUsed = 'fallback'
        
        // TIER 3: Fallback to broader time window search with normalized time
        const startHour = Math.max(0, parseInt(normalizedTime.substring(0, 2)) - 1)
        const endHour = Math.min(23, parseInt(normalizedTime.substring(0, 2)) + 1)
        const fallbackStartTime = startHour.toString().padStart(2, '0') + normalizedTime.substring(2)
        const fallbackEndTime = endHour.toString().padStart(2, '0') + normalizedTime.substring(2)
        
        const { data: fallbackResults, error: fallbackError } = await supabase
          .from('reservations')
          .select('*')
          .eq('company_id', company_id)
          .eq('date', date)
          .gte('time', fallbackStartTime)
          .lte('time', fallbackEndTime)
          .or(nameParts.map((part: string) => `customer_name.ilike.%${part}%`).join(','))
        
        reservations = fallbackResults || []
        searchError = fallbackError
      } else {
        reservations = fuzzyResults || []
        strategyUsed = 'fuzzy'
        console.log(`Found ${fuzzyResults?.length || 0} fuzzy matches`)
      }
    }
    
    // Calculate match scores for ranking (for non-fuzzy results)
    if (reservations && reservations.length > 0 && strategyUsed !== 'fuzzy') {
      reservations = reservations.map((reservation: any) => {
        const resName = reservation.customer_name.toLowerCase()
        const searchName = customer_name.toLowerCase()
        
        let score = 0
        if (resName === searchName) score = 100 // Exact match
        else if (resName.includes(searchName) || searchName.includes(resName)) score = 80 // Substring match
        else if (firstName && resName.includes(firstName)) score = 60 // First name match
        else if (lastName && resName.includes(lastName)) score = 60 // Last name match
        else score = 40 // Fuzzy match
        
        return { ...reservation, match_score: score }
      }).sort((a: any, b: any) => b.match_score - a.match_score)
    } else if (reservations && reservations.length > 0 && strategyUsed === 'fuzzy') {
      // Fuzzy results already have similarity_score from the RPC function
      reservations = reservations.map((reservation: any) => ({
        ...reservation,
        match_score: Math.round((reservation.similarity_score || 0) * 100)
      }))
    }

    if (searchError) {
      console.error('Error searching reservations:', searchError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error searching reservations: ' + searchError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Found ${reservations?.length || 0} reservations`)

    return new Response(
      JSON.stringify({
        success: true,
        reservations: reservations || [],
        count: reservations?.length || 0,
        search_criteria: {
          customer_name,
          date,
          time: normalizedTime,
          company_id
        },
        search_metadata: {
          strategy_used: strategyUsed,
          threshold,
          time_window_minutes,
          limit
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in external-reservation-search:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})