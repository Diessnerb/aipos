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
    console.log('📱 Inbound SMS webhook triggered');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Twilio webhook data
    const formData = await req.formData();
    const from = formData.get('From') as string; // Customer phone: +12345678901
    const to = formData.get('To') as string;     // Twilio number: +19876543210
    const body = (formData.get('Body') as string || '').trim();

    console.log(`📞 From: ${from}, To: ${to}, Message: "${body}"`);

    // Find company by Twilio phone number
    const { data: twilioConfig, error: configError } = await supabase
      .from('company_twilio_config')
      .select(`
        *,
        companies!inner(id, name)
      `)
      .eq('twilio_phone_number', to)
      .eq('is_active', true)
      .single();

    if (configError || !twilioConfig) {
      console.error('❌ Company not found for Twilio number:', to);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
         <Response>
           <Message>We couldn't process your message. Please contact us directly.</Message>
         </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const companyId = twilioConfig.company_id;
    const companyName = twilioConfig.companies.name;

    console.log(`🏢 Company: ${companyName} (${companyId})`);

    // Get company settings for timezone and phone
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('timezone, phone')
      .eq('company_id', companyId)
      .single();

    if (settingsError || !settings) {
      console.error('❌ Company settings not found');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
         <Response>
           <Message>We couldn't process your message. Please contact us directly.</Message>
         </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const timezone = settings.timezone || 'UTC';
    const restaurantPhone = settings.phone || 'the restaurant';

    // Calculate "today" in company's timezone
    const now = new Date();
    const localTime = toZonedTime(now, timezone);
    const todayLocal = format(localTime, 'yyyy-MM-dd', { timeZone: timezone });

    console.log(`📅 Company's local date: ${todayLocal} (${timezone})`);

    // Normalize phone numbers for matching
    const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, '');
    const normalizedFrom = normalizePhone(from);

    // Find matching reservations for today in company's timezone
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .eq('company_id', companyId)
      .eq('date', todayLocal)
      .in('status', ['confirmed', 'pending']);

    if (reservationsError) {
      console.error('❌ Error fetching reservations:', reservationsError);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
         <Response>
           <Message>We couldn't process your message. Please call ${restaurantPhone}.</Message>
         </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Filter by phone (flexible matching)
    const matchingReservations = (reservations || []).filter(r => {
      if (!r.phone) return false;
      const normalizedReservationPhone = normalizePhone(r.phone);
      return normalizedReservationPhone.includes(normalizedFrom) || 
             normalizedFrom.includes(normalizedReservationPhone);
    });

    const reservationCount = matchingReservations.length;
    console.log(`📋 Found ${reservationCount} matching reservation(s)`);

    let responseMessage = '';
    let messageType = 'other_reply';
    let logStatus = 'received';

    // Process message based on content
    if (body.toLowerCase().includes('cancel')) {
      if (reservationCount === 1) {
        // Single reservation - safe to auto-cancel
        const reservation = matchingReservations[0];
        console.log(`✅ Auto-cancelling reservation ${reservation.id}`);

        await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .eq('id', reservation.id);

        messageType = 'cancellation_received';
        logStatus = 'cancelled';
        responseMessage = 'Your reservation has been cancelled. Thank you for letting us know!';

        // Log the cancellation
        await supabase
          .from('sms_reminder_logs')
          .insert({
            company_id: companyId,
            reservation_id: reservation.id,
            phone: from,
            message_type: messageType,
            status: logStatus,
            inbound_message: body,
          });
      } else if (reservationCount > 1) {
        // Multiple reservations - need manual confirmation
        console.log(`⚠️ Multiple reservations (${reservationCount}) - requesting phone call`);
        messageType = 'multiple_reservations';
        responseMessage = `Get in touch with us on ${restaurantPhone}`;

        // Log all matching reservations
        for (const reservation of matchingReservations) {
          await supabase
            .from('sms_reminder_logs')
            .insert({
              company_id: companyId,
              reservation_id: reservation.id,
              phone: from,
              message_type: messageType,
              status: logStatus,
              inbound_message: body,
            });
        }
      } else {
        // No reservation found
        console.log('❌ No matching reservations found');
        messageType = 'no_reservation_found';
        responseMessage = `We couldn't find your reservation. Please call ${restaurantPhone}.`;

        await supabase
          .from('sms_reminder_logs')
          .insert({
            company_id: companyId,
            phone: from,
            message_type: messageType,
            status: logStatus,
            inbound_message: body,
          });
      }
    } else {
      // Non-cancel reply
      console.log('💬 Non-cancel message received');
      responseMessage = `Please get in touch with us at ${restaurantPhone}`;

      // Log the message (link to first matching reservation if any)
      await supabase
        .from('sms_reminder_logs')
        .insert({
          company_id: companyId,
          reservation_id: matchingReservations[0]?.id || null,
          phone: from,
          message_type: messageType,
          status: logStatus,
          inbound_message: body,
        });
    }

    console.log(`✅ Response: "${responseMessage}"`);

    // Return TwiML response
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
       <Response>
         <Message>${responseMessage}</Message>
       </Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
       <Response>
         <Message>We encountered an error processing your message. Please contact us directly.</Message>
       </Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
});
