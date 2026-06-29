import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIAdvisorRequest {
  companyId: string;
  reservations: any[];
  tables: any[];
  tableGroups: any[];
  contextDate: string;
}

interface StrategicMove {
  reservationId: string;
  customerName: string;
  currentTables: number[];
  suggestedTables: number[];
  reason: string;
  priority: 'high' | 'medium' | 'low';
  strategicValue: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { companyId, reservations, tables, tableGroups, contextDate } = await req.json() as AIAdvisorRequest;

    console.log(`🤖 AI ADVISOR: Analyzing ${reservations.length} reservations`);

    // Calculate days ahead
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const targetDate = new Date(contextDate);
    targetDate.setHours(0, 0, 0, 0);
    const daysAhead = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Prepare context for AI
    const context = {
      daysAhead,
      contextDate,
      reservationsCount: reservations.length,
      largeTablesAvailable: tables.filter((t: any) => t.seats >= 8 && !reservations.some((r: any) => 
        (r.table_numbers || [r.table_number]).includes(t.table_number)
      )).length,
      largeGroupsAvailable: tableGroups.filter((g: any) => g.total_capacity >= 16).length,
      currentLayout: reservations.map((r: any) => ({
        customer: r.customer_name,
        party_size: r.party_size,
        tables: r.table_numbers || [r.table_number],
        time: r.time
      })),
      availableTables: tables.map((t: any) => ({
        number: t.table_number,
        seats: t.seats,
        inGroup: tableGroups.some((g: any) => g.table_numbers?.includes(t.table_number))
      })),
      tableGroups: tableGroups.map((g: any) => ({
        name: g.group_name,
        tables: g.table_numbers,
        capacity: g.total_capacity
      }))
    };

    // Call Lovable AI for strategic advice
    const systemPrompt = `You are an expert restaurant table assignment optimizer. Analyze the current reservation layout and suggest strategic moves to optimize for future capacity.

STRATEGIC PRIORITIES (in order):
1. Free up large single tables (8+ seats) for ${daysAhead} day(s) ahead bookings
2. Free up large table groups (16+ capacity) for potential large parties
3. Use table groups efficiently to consolidate reservations
4. Minimize wasted seats while maintaining flexibility

CONTEXT:
- Days ahead: ${daysAhead} (${daysAhead >= 1 ? 'PROTECT LARGE TABLES' : 'EFFICIENCY FOCUS'})
- Date: ${contextDate}
- Large tables available: ${context.largeTablesAvailable}
- Large groups available: ${context.largeGroupsAvailable}

Current Reservations:
${context.currentLayout.map(r => `- ${r.customer} (${r.party_size} guests) @ ${r.time} on T${r.tables.join(',')}`).join('\n')}

Available Tables:
${context.availableTables.map(t => `- T${t.number}: ${t.seats} seats ${t.inGroup ? '(in group)' : '(individual)'}`).join('\n')}

Table Groups:
${context.tableGroups.map(g => `- ${g.name}: T${g.tables.join(',')} (${g.capacity} seats)`).join('\n')}

TASK: Suggest strategic table reassignments. Return ONLY valid JSON array of moves:
[
  {
    "customerName": "Customer Name",
    "currentTables": [11],
    "suggestedTables": [16, 17],
    "reason": "Brief explanation",
    "priority": "high|medium|low",
    "strategicValue": 0-100
  }
]

Rules:
- Only suggest moves that FREE UP large tables/groups
- Suggested tables MUST be consecutive within groups
- Priority "high" if freeing 8+ seat table and ${daysAhead} >= 1
- Strategic value based on: table size freed × 10 + days ahead × 5
- Return empty array [] if no strategic moves available`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze and suggest strategic moves.' }
        ],
        temperature: 0.3, // Lower temperature for more consistent strategic decisions
        max_tokens: 2000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '[]';
    
    console.log('🤖 AI Response:', aiContent);

    // Parse AI suggestions
    let strategicMoves: StrategicMove[] = [];
    try {
      // Extract JSON from response (AI might wrap it in markdown)
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : aiContent;
      const parsedMoves = JSON.parse(jsonStr);
      
      // Validate and enrich suggestions
      strategicMoves = parsedMoves.map((move: any) => {
        const reservation = reservations.find(r => r.customer_name === move.customerName);
        return {
          reservationId: reservation?.id || '',
          customerName: move.customerName,
          currentTables: move.currentTables || [],
          suggestedTables: move.suggestedTables || [],
          reason: move.reason || 'Strategic repositioning',
          priority: move.priority || 'medium',
          strategicValue: move.strategicValue || 50
        };
      }).filter((move: StrategicMove) => move.reservationId); // Only valid reservations

    } catch (parseError) {
      console.warn('Failed to parse AI suggestions:', parseError);
      console.log('Raw AI content:', aiContent);
      strategicMoves = [];
    }

    console.log(`✅ AI ADVISOR: ${strategicMoves.length} strategic moves suggested`);

    return new Response(
      JSON.stringify({
        success: true,
        strategicMoves,
        daysAhead,
        context: {
          largeTablesAvailable: context.largeTablesAvailable,
          largeGroupsAvailable: context.largeGroupsAvailable
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Advisor error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        strategicMoves: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
