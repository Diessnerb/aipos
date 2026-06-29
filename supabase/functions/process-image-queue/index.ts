import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Processing image enhancement queue...');
    
    // Fetch pending image processing jobs
    const { data: jobs, error } = await supabase
      .from('image_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(5); // Process up to 5 images at a time
    
    if (error) {
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('No pending jobs found');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${jobs.length} pending jobs`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const job of jobs) {
      try {
        console.log(`Processing job ${job.id} for asset ${job.asset_id}`);
        
        // Update status to processing
        await supabase
          .from('image_processing_queue')
          .update({ status: 'processing' })
          .eq('id', job.id);
        
        // Invoke enhancement function
        const { data, error: enhanceError } = await supabase.functions.invoke('enhance-dish-image', {
          body: { assetId: job.asset_id }
        });
        
        if (enhanceError) {
          throw enhanceError;
        }
        
        console.log(`Job ${job.id} completed successfully`);
        successCount++;
        
      } catch (jobError) {
        console.error(`Job ${job.id} failed:`, jobError);
        failureCount++;
        
        // Increment retry count and mark as failed
        const newRetryCount = job.retry_count + 1;
        const finalStatus = newRetryCount >= job.max_retries ? 'failed' : 'pending';
        
        await supabase
          .from('image_processing_queue')
          .update({
            status: finalStatus,
            error_message: jobError.message,
            retry_count: newRetryCount,
            processed_at: finalStatus === 'failed' ? new Date().toISOString() : null
          })
          .eq('id', job.id);
        
        // Also update the asset status if this is the final failure
        if (finalStatus === 'failed') {
          await supabase
            .from('assets')
            .update({
              enhancement_status: 'failed',
              enhancement_error: `Failed after ${newRetryCount} attempts: ${jobError.message}`
            })
            .eq('id', job.asset_id);
        }
      }
    }
    
    console.log(`Queue processing complete: ${successCount} succeeded, ${failureCount} failed`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: jobs.length,
        succeeded: successCount,
        failed: failureCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Queue processor error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
