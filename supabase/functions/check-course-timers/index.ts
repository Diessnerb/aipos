import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CourseTimerCheck {
  course: 'starters' | 'mains' | 'desserts' | 'seated';
  currentStatus: string;
  newStatus: string;
  timestampField: string;
  minutesDelay: number;
  requiresOrderCheck?: boolean;
}

const COURSE_CHECKS: CourseTimerCheck[] = [
  {
    course: 'seated',
    currentStatus: 'seated',
    newStatus: 'waiting-for-order',
    timestampField: 'seated_at',
    minutesDelay: 3,
    requiresOrderCheck: true,
  },
  {
    course: 'starters',
    currentStatus: 'starters-served',
    newStatus: 'requires-check-back-on-starters',
    timestampField: 'starters_served_at',
    minutesDelay: 3,
  },
  {
    course: 'mains',
    currentStatus: 'mains-served',
    newStatus: 'requires-check-back-on-mains',
    timestampField: 'mains_served_at',
    minutesDelay: 5,
  },
  {
    course: 'desserts',
    currentStatus: 'desserts-served',
    newStatus: 'requires-check-back-on-desserts',
    timestampField: 'desserts_served_at',
    minutesDelay: 3,
  },
];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('Starting course timer checks...');
    
    let totalUpdated = 0;

    // Check each course type
    for (const check of COURSE_CHECKS) {
      console.log(`Checking ${check.course} (${check.minutesDelay} min delay)...`);
      
      // Calculate the cutoff time (current time - delay minutes)
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - check.minutesDelay);
      const cutoffISO = cutoffTime.toISOString();

      // Find reservations that need status update
      const { data: reservations, error: fetchError } = await supabaseClient
        .from('reservations')
        .select('id, customer_name, status, ' + check.timestampField)
        .eq('status', check.currentStatus)
        .not(check.timestampField, 'is', null)
        .lt(check.timestampField, cutoffISO);

      if (fetchError) {
        console.error(`Error fetching ${check.course} reservations:`, fetchError);
        continue;
      }

      if (!reservations || reservations.length === 0) {
        console.log(`No ${check.course} reservations need updating`);
        continue;
      }

      console.log(`Found ${reservations.length} ${check.course} reservations to update`);

      // Update each reservation
      for (const reservation of reservations) {
        // Check if order exists (only for seated check)
        if (check.requiresOrderCheck) {
          const { data: orders, error: orderError } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('reservation_id', reservation.id)
            .limit(1);

          if (orderError) {
            console.error(`Error checking orders for reservation ${reservation.id}:`, orderError);
            continue;
          }

          // Skip update if order already exists
          if (orders && orders.length > 0) {
            console.log(`Skipping ${reservation.customer_name} - order already placed`);
            continue;
          }
        }

        const { error: updateError } = await supabaseClient
          .from('reservations')
          .update({ status: check.newStatus })
          .eq('id', reservation.id);

        if (updateError) {
          console.error(`Error updating reservation ${reservation.id}:`, updateError);
        } else {
          console.log(`Updated ${reservation.customer_name} (${reservation.id}) to ${check.newStatus}`);
          totalUpdated++;
        }
      }
    }

    console.log(`Course timer check complete. Total updated: ${totalUpdated}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: totalUpdated,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-course-timers:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
