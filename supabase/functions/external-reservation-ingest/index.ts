import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-token',
}

// Normalize UK phone number to 11-digit format starting with 0
function normalizeUKPhone(phone: string): string | null {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('44')) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  if (cleaned.length === 11 && /^0[127]/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

// Rate limiting: Track requests per token
const tokenRequestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per minute per token

// Helper function to normalize date/time formats
function normalizeDateTime(dateStr: string, timeStr: string) {
  try {
    // Handle various date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    
    // Handle time formats (HH:MM, HH:MM:SS, with/without AM/PM)
    let time = timeStr;
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
      // Try to parse time with AM/PM
      const timeMatch = time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2];
        const seconds = timeMatch[3] || '00';
        const ampm = timeMatch[4];
        
        if (ampm) {
          if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
          if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        
        time = `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
      } else {
        throw new Error(`Invalid time format: ${timeStr}`);
      }
    }
    
    return {
      date: date.toISOString().split('T')[0],
      time: time
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Date/time normalization failed';
    throw new Error(`Date/time normalization failed: ${errorMessage}`);
  }
}

// Rate limiting check
function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const tokenData = tokenRequestCounts.get(token) || { count: 0, windowStart: now };
  
  // Reset window if expired
  if (now - tokenData.windowStart > RATE_LIMIT_WINDOW) {
    tokenData.count = 0;
    tokenData.windowStart = now;
  }
  
  tokenData.count++;
  tokenRequestCounts.set(token, tokenData);
  
  return tokenData.count <= RATE_LIMIT_MAX_REQUESTS;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let operation = 'unknown';
  let companyId = 'unknown';

  try {
    // Only allow POST and DELETE methods
    if (!['POST', 'DELETE'].includes(req.method)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Method ${req.method} not allowed. Use POST for create/update or DELETE for deletion.` 
        }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create supabase client with service role key to bypass RLS
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const integrationToken = req.headers.get('x-integration-token');
    
    if (!integrationToken) {
      console.log('❌ Missing integration token');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing integration token. Include X-Integration-Token header.' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Rate limiting check
    if (!checkRateLimit(integrationToken)) {
      console.log(`🚫 Rate limit exceeded for token: ${integrationToken.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Maximum 100 requests per minute.' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate integration token and get company_id
    console.log(`🔍 Validating integration token: ${integrationToken.substring(0, 8)}...`);
    const { data: integration, error: integrationError } = await supabaseServiceRole
      .from('integrations')
      .select('company_id, service_name, companies:company_id(name)')
      .eq('auth_token', integrationToken)
      .eq('service_name', 'external_api')
      .eq('connected', true)
      .single();

    if (integrationError || !integration) {
      console.log(`❌ Invalid integration token: ${integrationToken.substring(0, 8)}...`, integrationError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired integration token' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    companyId = integration.company_id;
    const companyName = (integration.companies as any)?.name || 'Unknown';
    console.log(`✅ Token validated for company: ${companyName} (${companyId})`);

    // Parse request body
    const requestBody = await req.json();
    
    // Handle DELETE requests
    if (req.method === 'DELETE') {
      operation = 'delete';
      const { reservation_id, external_id } = requestBody;
      
      if (!reservation_id && !external_id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing reservation_id or external_id for deletion' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Delete reservation
      let deleteQuery = supabaseServiceRole
        .from('reservations')
        .delete()
        .eq('company_id', integration.company_id);

      if (reservation_id) {
        deleteQuery = deleteQuery.eq('id', reservation_id);
      } else {
        deleteQuery = deleteQuery.eq('external_id', external_id);
      }

      const { data: deletedReservation, error: deleteError } = await deleteQuery.select().single();
      
      if (deleteError) {
        console.error('❌ Delete reservation error:', deleteError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: deleteError.message || 'Failed to delete reservation' 
          }),
          { 
            status: deleteError.code === 'PGRST116' ? 404 : 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`✅ Reservation deleted successfully: ${deletedReservation.id}`);
      
      // Update last_synced_at
      await supabaseServiceRole
        .from('integrations')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('auth_token', integrationToken)
        .eq('service_name', 'external_api');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Reservation deleted successfully',
          reservation: deletedReservation
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle POST requests (create/update)
    const { reservation, isUpdate = false } = requestBody;
    
    if (!reservation) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing reservation data' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Required fields validation (phone is optional for better compatibility)
    const requiredFields = ['customer_name', 'party_size', 'date', 'time'];
    const missingFields = requiredFields.filter(field => !reservation[field]);
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Normalize date and time
    let normalizedDateTime;
    try {
      normalizedDateTime = normalizeDateTime(reservation.date, reservation.time);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Date/time normalization failed';
      console.error('❌ Date/time normalization error:', errorMessage);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid date/time format: ${errorMessage}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare reservation data with company_id and normalized phone
    const reservationData = {
      ...reservation,
      phone: reservation.phone ? normalizeUKPhone(reservation.phone) : null,
      company_id: integration.company_id,
      status: reservation.status || 'confirmed',
      date: normalizedDateTime.date,
      time: normalizedDateTime.time,
      // Add external_id for idempotency if provided
      external_id: reservation.external_id || null
    };

    let result;
    
    // Check for idempotency using external_id
    if (reservationData.external_id && !isUpdate) {
      operation = 'idempotency_check';
      const { data: existingReservation } = await supabaseServiceRole
        .from('reservations')
        .select('*')
        .eq('external_id', reservationData.external_id)
        .eq('company_id', integration.company_id)
        .single();
      
      if (existingReservation) {
        console.log(`🔄 Idempotent request - returning existing reservation: ${existingReservation.id}`);
        result = existingReservation;
        operation = 'idempotent_return';
      }
    }
    
    if (!result) {
      if (isUpdate && (reservation.id || reservation.external_id)) {
        operation = 'update';
        // Update existing reservation
        let updateQuery = supabaseServiceRole
          .from('reservations')
          .update(reservationData)
          .eq('company_id', integration.company_id); // Security: ensure company isolation
        
        if (reservation.id) {
          updateQuery = updateQuery.eq('id', reservation.id);
        } else {
          updateQuery = updateQuery.eq('external_id', reservation.external_id);
        }
        
        const { data, error } = await updateQuery.select().single();
          
        if (error) {
          console.error('❌ Update reservation error:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: error.message || 'Failed to update reservation' 
            }),
            { 
              status: error.code === 'PGRST116' ? 404 : 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        result = data;
        console.log(`✅ Reservation updated successfully: ${result.id}`);
        
      } else {
        operation = 'create';
        // Create new reservation with upsert for idempotency
        const { data, error } = await supabaseServiceRole
          .from('reservations')
          .upsert(reservationData, { 
            onConflict: reservationData.external_id ? 'external_id,company_id' : undefined 
          })
          .select()
          .single();
          
        if (error) {
          console.error('❌ Insert/upsert reservation error:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: error.message || 'Failed to create reservation' 
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        result = data;
        console.log(`✅ Reservation created successfully: ${result.id}`);
      }
    }

    // Update last_synced_at to track API usage
    await supabaseServiceRole
      .from('integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('auth_token', integrationToken)
      .eq('service_name', 'external_api');

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Request processed in ${processingTime}ms - Operation: ${operation}, Company: ${companyId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reservation: result,
        message: operation === 'idempotent_return' 
          ? 'Reservation already exists (idempotent request)'
          : isUpdate 
            ? 'Reservation updated successfully' 
            : 'Reservation created successfully',
        operation: operation,
        processing_time_ms: processingTime
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Unexpected error after ${processingTime}ms:`, error);
    console.error(`📍 Error context - Operation: ${operation}, Company: ${companyId}`);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        operation: operation,
        processing_time_ms: processingTime
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});