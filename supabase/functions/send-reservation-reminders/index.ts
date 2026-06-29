import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toZonedTime, format } from "https://esm.sh/date-fns-tz@3.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🕐 SMS Reminder System - Hourly Check Started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('Twilio credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();
    
    console.log(`📅 Current UTC time: ${now.toISOString()}`);

    // Fetch all active companies with Twilio configuration
    const { data: twilioConfigs, error: configError } = await supabase
      .from('company_twilio_config')
      .select(`
        *,
        companies!inner(id, name)
      `)
      .eq('is_active', true);

    if (configError) {
      throw configError;
    }

    console.log(`🏢 Found ${twilioConfigs?.length || 0} companies with Twilio configuration`);

    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let totalOptedOut = 0;
    let totalSkipped = 0;

    for (const config of twilioConfigs || []) {
      const companyId = config.company_id;
      const companyName = config.companies.name;
      
      // Get company settings including timezone
      const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('timezone, sms_reminders_enabled, phone')
        .eq('company_id', companyId)
        .single();

      if (settingsError || !settings) {
        console.log(`⚠️ No settings found for ${companyName}, skipping`);
        continue;
      }

      if (!settings.sms_reminders_enabled) {
        console.log(`❌ SMS reminders disabled for ${companyName}, skipping`);
        continue;
      }

      const timezone = settings.timezone || 'UTC';
      
      // Validate timezone
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (e) {
        console.error(`❌ Invalid timezone "${timezone}" for ${companyName}, skipping`);
        continue;
      }

      // Convert to company's local time
      const localTime = toZonedTime(now, timezone);
      const localHour = localTime.getHours();
      const localDateStr = format(localTime, 'yyyy-MM-dd', { timeZone: timezone });
      const localTimeStr = format(localTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: timezone });

      console.log(`🏢 ${companyName}: Local time ${localTimeStr} (${timezone}), Hour: ${localHour}`);

      // Only process if it's 8am in their timezone
      if (localHour !== 8) {
        totalSkipped++;
        continue;
      }

      console.log(`✅ Processing ${companyName} - it's 8am local time!`);
      totalProcessed++;

      // Fetch today's reservations (in company's timezone)
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          *,
          customers(sms_opt_out, do_not_contact)
        `)
        .eq('company_id', companyId)
        .eq('date', localDateStr)
        .in('status', ['confirmed', 'pending'])
        .eq('reminder_sent', false)
        .not('phone', 'is', null);

      if (reservationsError) {
        console.error(`❌ Error fetching reservations for ${companyName}:`, reservationsError);
        continue;
      }

      console.log(`📋 Found ${reservations?.length || 0} reservations for ${companyName}`);

      let companySent = 0;
      let companyFailed = 0;
      let companyOptedOut = 0;

      for (const reservation of reservations || []) {
        // Check opt-out status
        const customer = reservation.customers;
        if (customer?.sms_opt_out || customer?.do_not_contact) {
          console.log(`🚫 Customer ${reservation.phone} has opted out or do-not-contact`);
          companyOptedOut++;
          continue;
        }

        // Format time nicely
        const timeStr = reservation.time ? 
          format(new Date(`2000-01-01T${reservation.time}`), 'h:mm a') : 
          'your scheduled time';

        // Build SMS message
        const message = `Hi ${reservation.customer_name}! 

This is a friendly reminder about your reservation today at ${timeStr} for ${reservation.party_size} ${reservation.party_size === 1 ? 'person' : 'people'}.

Can't make it? Reply CANCEL. Want to change? Give us a call at ${settings.phone || 'the restaurant'}.

- ${companyName}`;

        // Send SMS via Twilio
        try {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: reservation.phone,
                From: config.twilio_phone_number,
                Body: message,
              }),
            }
          );

          const result = await response.json();

          if (response.ok) {
            console.log(`✅ SMS sent to ${reservation.phone} - SID: ${result.sid}`);
            companySent++;

            // Update reservation
            await supabase
              .from('reservations')
              .update({ 
                reminder_sent: true, 
                reminder_sent_at: now.toISOString() 
              })
              .eq('id', reservation.id);

            // Log success
            await supabase
              .from('sms_reminder_logs')
              .insert({
                company_id: companyId,
                reservation_id: reservation.id,
                phone: reservation.phone,
                message_type: 'reminder',
                status: 'sent',
                twilio_message_sid: result.sid,
                processed_at_utc: now.toISOString(),
                company_local_time: localTimeStr,
              });
          } else {
            throw new Error(result.message || 'Twilio API error');
          }
        } catch (error) {
          console.error(`❌ Failed to send SMS to ${reservation.phone}:`, error);
          companyFailed++;

          // Log failure
          await supabase
            .from('sms_reminder_logs')
            .insert({
              company_id: companyId,
              reservation_id: reservation.id,
              phone: reservation.phone,
              message_type: 'reminder',
              status: 'failed',
              error_message: error.message,
              processed_at_utc: now.toISOString(),
              company_local_time: localTimeStr,
            });
        }
      }

      totalSent += companySent;
      totalFailed += companyFailed;
      totalOptedOut += companyOptedOut;

      // Log batch summary
      await supabase
        .from('sms_reminder_logs')
        .insert({
          company_id: companyId,
          phone: 'N/A',
          message_type: 'batch_summary',
          status: 'sent',
          processed_at_utc: now.toISOString(),
          company_local_time: localTimeStr,
          inbound_message: JSON.stringify({
            sms_sent: companySent,
            sms_failed: companyFailed,
            opted_out: companyOptedOut,
          }),
        });

      console.log(`📊 ${companyName} Summary: ${companySent} sent, ${companyFailed} failed, ${companyOptedOut} opted out`);
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      companies_at_8am: totalProcessed,
      companies_skipped: totalSkipped,
      total_sms_sent: totalSent,
      total_failed: totalFailed,
      total_opted_out: totalOptedOut,
    };

    console.log('📊 Final Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
