import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CourseDurationCheck {
  course: 'starters' | 'mains' | 'desserts';
  eligibleStatuses: string[];
  clearStatus: string;
  nextCourseStatus: string;
  timestampField: string;
  getDurationMinutes: (partySize: number) => number;
}

const DURATION_CHECKS: CourseDurationCheck[] = [
  {
    course: 'starters',
    eligibleStatuses: ['starters-served', 'requires-check-back-on-starters', 'eating-starters'],
    clearStatus: 'clear-starters',
    nextCourseStatus: 'waiting-for-mains',
    timestampField: 'starters_served_at',
    getDurationMinutes: (partySize: number) => {
      if (partySize <= 4) return 11;
      if (partySize <= 8) return 16;
      return 20;
    }
  },
  {
    course: 'mains',
    eligibleStatuses: ['mains-served', 'requires-check-back-on-mains', 'eating-mains'],
    clearStatus: 'clear-mains',
    nextCourseStatus: 'waiting-for-desserts',
    timestampField: 'mains_served_at',
    getDurationMinutes: (partySize: number) => {
      if (partySize <= 4) return 20;
      if (partySize <= 8) return 25;
      return 30;
    }
  },
  {
    course: 'desserts',
    eligibleStatuses: ['desserts-served', 'requires-check-back-on-desserts', 'eating-dessert'],
    clearStatus: 'clear-desserts',
    nextCourseStatus: 'table-cleared',
    timestampField: 'desserts_served_at',
    getDurationMinutes: (partySize: number) => {
      if (partySize <= 4) return 8;
      if (partySize <= 8) return 11;
      return 15;
    }
  }
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Course Duration] Starting course duration timer check');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let totalUpdated = 0;
    const updates: any[] = [];

    // Process each course duration check
    for (const check of DURATION_CHECKS) {
      console.log(`[Course Duration] Checking ${check.course} course...`);

      // Define party size ranges and their durations
      const partySizeRanges = [
        { min: 1, max: 4, duration: check.getDurationMinutes(2) },
        { min: 5, max: 8, duration: check.getDurationMinutes(6) },
        { min: 9, max: 999, duration: check.getDurationMinutes(10) }
      ];

      for (const range of partySizeRanges) {
        // Query reservations that should transition to clear status
        const { data: reservations, error } = await supabase
          .from('reservations')
          .select('id, customer_name, status, party_size, ' + check.timestampField)
          .in('status', check.eligibleStatuses)
          .not(check.timestampField, 'is', null)
          .gte('party_size', range.min)
          .lte('party_size', range.max)
          .lt(check.timestampField, new Date(Date.now() - range.duration * 60 * 1000).toISOString());

        if (error) {
          console.error(`[Course Duration] Error querying ${check.course} for ${range.min}-${range.max} guests:`, error);
          continue;
        }

        if (!reservations || reservations.length === 0) {
          console.log(`[Course Duration] No ${check.course} courses to clear for ${range.min}-${range.max} guests`);
          continue;
        }

        console.log(`[Course Duration] Found ${reservations.length} ${check.course} courses to clear (${range.min}-${range.max} guests, ${range.duration} min)`);

        // Update each reservation to clear status
        for (const reservation of reservations) {
          // Safety check: Verify status hasn't progressed to next course
          if (reservation.status === check.nextCourseStatus) {
            console.log(`[Course Duration] Skipping ${reservation.customer_name} - already at ${check.nextCourseStatus}`);
            continue;
          }

          const { error: updateError } = await supabase
            .from('reservations')
            .update({ 
              status: check.clearStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', reservation.id)
            .in('status', check.eligibleStatuses); // Re-verify status hasn't changed

          if (updateError) {
            console.error(`[Course Duration] Error updating ${reservation.customer_name}:`, updateError);
            continue;
          }

          console.log(`[Course Duration] ✓ Updated ${reservation.customer_name} (${reservation.party_size} guests) to ${check.clearStatus}`);
          totalUpdated++;
          updates.push({
            customer: reservation.customer_name,
            course: check.course,
            from_status: reservation.status,
            to_status: check.clearStatus,
            party_size: reservation.party_size,
            duration_minutes: range.duration
          });
        }
      }
    }

    console.log(`[Course Duration] Check complete - Updated ${totalUpdated} reservations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${totalUpdated} reservations`,
        updates
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('[Course Duration] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
