import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting service schedule check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all schedules that have passed their scheduled_end time
    // and haven't been resolved yet
    const { data: expiredSchedules, error: selectError } = await supabase
      .from('table_service_schedules')
      .select('id, table_id, scheduled_end, duration_days')
      .is('resolved_at', null)
      .eq('requires_attention', false)
      .not('scheduled_end', 'is', null)
      .lte('scheduled_end', new Date().toISOString());

    if (selectError) {
      console.error('❌ Error fetching expired schedules:', selectError);
      throw selectError;
    }

    console.log(`📊 Found ${expiredSchedules?.length || 0} expired schedules`);

    if (expiredSchedules && expiredSchedules.length > 0) {
      // Update all expired schedules to require attention
      const scheduleIds = expiredSchedules.map(s => s.id);
      
      const { error: updateError } = await supabase
        .from('table_service_schedules')
        .update({ 
          requires_attention: true,
          updated_at: new Date().toISOString()
        })
        .in('id', scheduleIds);

      if (updateError) {
        console.error('❌ Error updating schedules:', updateError);
        throw updateError;
      }

      console.log(`✅ Updated ${scheduleIds.length} schedules to require attention`);
      
      // Log details for debugging
      expiredSchedules.forEach(schedule => {
        console.log(`  - Table ID: ${schedule.table_id}, Duration: ${schedule.duration_days} days, Ended: ${schedule.scheduled_end}`);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        checked_at: new Date().toISOString(),
        expired_count: expiredSchedules?.length || 0,
        message: `Checked service schedules, found ${expiredSchedules?.length || 0} requiring attention`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in check-service-schedules:', error);
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
