import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { company_id, test_scenario } = await req.json()
    
    console.log('Testing large party assignment for company:', company_id)
    console.log('Test scenario:', test_scenario)

    // Test the new contiguous group selection function
    const { data: groups, error: groupsError } = await supabaseAdmin
      .rpc('get_available_table_groups_with_status', { p_company_id: company_id })
    
    if (groupsError) {
      throw new Error(`Failed to get table groups: ${groupsError.message}`)
    }

    console.log('Available table groups:', groups)

    // Test contiguous selection for a 20-person party
    const partySize = 20
    let testResults = []

    for (const group of groups || []) {
      if (group.max_combined_capacity >= partySize) {
        const { data: contiguousSelection, error: selectionError } = await supabaseAdmin
          .rpc('select_contiguous_group_tables', {
            p_group_id: group.group_id,
            p_party_size: partySize,
            p_company_id: company_id
          })

        testResults.push({
          group_name: group.group_name,
          group_capacity: group.max_combined_capacity,
          can_combine: group.can_combine,
          all_tables: group.table_numbers,
          out_of_service: group.out_of_service_tables || [],
          contiguous_selection: contiguousSelection?.[0] || null,
          selection_error: selectionError?.message || null
        })
      }
    }

    // Test creating a reservation to see trigger behavior
    if (test_scenario === 'create_reservation') {
      console.log('Creating test reservation for 20 people...')
      
      const { data: reservation, error: reservationError } = await supabaseAdmin
        .from('reservations')
        .insert({
          company_id: company_id,
          customer_name: 'Test Large Party',
          phone: '1234567890',
          email: 'test@example.com',
          party_size: partySize,
          date: '2025-09-15',
          time: '19:00',
          notes: 'Test booking for 20 people - should auto-assign to table group'
        })
        .select()
        .single()

      if (reservationError) {
        throw new Error(`Failed to create test reservation: ${reservationError.message}`)
      }

      testResults.push({
        test_reservation: reservation,
        assigned_table: reservation.table_number,
        assigned_tables: reservation.table_numbers,
        message: 'Test reservation created successfully'
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        company_id,
        party_size: partySize,
        test_results: testResults,
        message: 'Large party assignment test completed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Test function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})