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

    const { company_id, test_scenario = 'all', party_size = 8 } = await req.json()
    
    console.log('🧪 Testing ENHANCED Smart Assignment System')
    console.log(`Company: ${company_id}, Scenario: ${test_scenario}, Party Size: ${party_size}`)

    let testResults = []

    // Test 1: FIXED Table Groups Detection
    if (test_scenario === 'all' || test_scenario === 'groups') {
      console.log('🔍 Testing FIXED table groups detection...')
      
      const { data: groups, error: groupsError } = await supabaseAdmin
        .rpc('get_table_groups_with_real_time_availability', { 
          p_company_id: company_id,
          p_date: '2025-09-27',
          p_time: '19:00:00',
          p_party_size: party_size,
          p_accessibility_needed: false
        })
      
      testResults.push({
        test: 'FIXED Table Groups Detection',
        success: !groupsError,
        error: groupsError?.message || null,
        groups_found: groups?.length || 0,
        groups: groups?.map((g: any) => ({
          name: g.group_name,
          tables: g.table_numbers,
          available_seats: g.total_seats, // DB function should return Available Seats as total_seats
          can_accommodate: g.can_accommodate,
          is_available: g.is_available,
          free_seats: g.free_seats,
          free_tables: g.free_tables
        })) || []
      })
    }

    // Test 2: Contiguous Table Selection
    if (test_scenario === 'all' || test_scenario === 'contiguous') {
      console.log('🔗 Testing contiguous table selection...')
      
      // First get a group that can accommodate the party
      const { data: availableGroups } = await supabaseAdmin
        .rpc('get_table_groups_with_real_time_availability', { 
          p_company_id: company_id,
          p_date: '2025-09-27',
          p_time: '19:00:00',
          p_party_size: party_size,
          p_accessibility_needed: false
        })

      if (availableGroups && availableGroups.length > 0) {
        const testGroup = availableGroups.find((g: any) => g.can_accommodate) || availableGroups[0]
        
        const { data: contiguousResult, error: contiguousError } = await supabaseAdmin
          .rpc('select_contiguous_group_tables', {
            p_group_id: testGroup.group_id,
            p_party_size: party_size,
            p_company_id: company_id
          })

        testResults.push({
          test: 'Contiguous Table Selection',
          success: !contiguousError && contiguousResult?.length > 0,
          error: contiguousError?.message || null,
          test_group: testGroup.group_name,
          selected_tables: contiguousResult?.[0]?.selected_tables || [],
          total_capacity: contiguousResult?.[0]?.total_capacity || 0,
          efficiency_score: contiguousResult?.[0]?.efficiency_score || 0
        })
      } else {
        testResults.push({
          test: 'Contiguous Table Selection',
          success: false,
          error: 'No groups available for testing',
          selected_tables: [],
          total_capacity: 0,
          efficiency_score: 0
        })
      }
    }

    // Test 3: Large Party Assignment Capability
    if (test_scenario === 'all' || test_scenario === 'large_party') {
      console.log('🏢 Testing large party assignment...')
      
      const largePartyTests = [12, 16, 20, 24]
      
      for (const testSize of largePartyTests) {
        const { data: largePartyGroups, error } = await supabaseAdmin
          .rpc('get_table_groups_with_real_time_availability', { 
            p_company_id: company_id,
            p_date: '2025-09-27',
            p_time: '19:00:00',
            p_party_size: testSize,
            p_accessibility_needed: false
          })

        const accommodatingGroups = largePartyGroups?.filter((g: any) => g.can_accommodate) || []

        testResults.push({
          test: `Large Party Assignment (${testSize} people)`,
          success: !error && accommodatingGroups.length > 0,
          party_size: testSize,
          groups_that_can_accommodate: accommodatingGroups.length,
          best_option: accommodatingGroups[0] ? {
            group_name: accommodatingGroups[0].group_name,
            available_seats: accommodatingGroups[0].total_seats, // DB function should return Available Seats
            efficiency: ((testSize / accommodatingGroups[0].total_seats) * 100).toFixed(1) + '%'
          } : null
        })
      }
    }

    // Test 4: System Integration Test
    if (test_scenario === 'all' || test_scenario === 'integration') {
      console.log('🔄 Testing full system integration...')
      
      const integrationTest = {
        database_functions_working: true,
        table_groups_detected: false,
        large_parties_supported: false,
        contiguous_selection_working: false
      }

      // Check if database functions are working
      try {
        const { data: testQuery } = await supabaseAdmin
          .rpc('get_table_groups_with_real_time_availability', { 
            p_company_id: company_id,
            p_date: '2025-09-27',
            p_time: '19:00:00',
            p_party_size: 8,
            p_accessibility_needed: false
          })
        
        integrationTest.table_groups_detected = (testQuery?.length || 0) > 0
        integrationTest.large_parties_supported = testQuery?.some((g: any) => g.total_seats >= 16) || false
        
      } catch (error) {
        integrationTest.database_functions_working = false
      }

      testResults.push({
        test: 'System Integration Check',
        success: integrationTest.database_functions_working && integrationTest.table_groups_detected,
        details: integrationTest
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'ENHANCED Smart Assignment System Test Complete',
        company_id,
        test_scenario,
        party_size,
        results: testResults,
        summary: {
          total_tests: testResults.length,
          passed: testResults.filter(r => r.success).length,
          failed: testResults.filter(r => !r.success).length
        }
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