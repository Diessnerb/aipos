import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize UK phone number to 11-digit format
function normalizeUKPhone(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Convert +44 or 44 prefix to 0
  if (cleaned.startsWith('44')) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  // Must be exactly 11 digits starting with 07, 01, or 02
  if (cleaned.length === 11 && /^0[127]/.test(cleaned)) {
    return cleaned;
  }
  
  return null; // Invalid UK phone
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for RLS bypass
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { pin, companyId, reservation, isUpdate } = await req.json();

    // ✅ Log every request for debugging
    console.log('🔧 PIN reservation save request:', {
      companyId,
      customerName: reservation?.customer_name,
      phone: reservation?.phone,
      isUpdate: isUpdate || false,
      timestamp: new Date().toISOString()
    });

    if (!pin || !companyId || !reservation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate PIN using secure RPC function
    const { data: userData, error: userError } = await supabaseAdmin
      .rpc('authenticate_by_pin_for_company_secure', {
        pin_input: pin,
        company_id_input: companyId
      });

    if (userError || !userData || !Array.isArray(userData) || userData.length === 0) {
      console.error('PIN validation failed:', userError?.message || 'No data returned');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: userError?.message || 'Invalid PIN or access denied' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // The RPC function returns an array of rows, get the first one
    const userRecord = userData[0];
    console.log('PIN validated successfully for user:', userRecord.user_name);

  // Customer sync is now handled automatically by the database trigger (handle_new_customer)
  // No need to manually sync customers here - the trigger will handle it on reservation insert/update
  console.log('📝 Customer sync will be handled by database trigger for:', {
    customerName: reservation.customer_name,
    phone: reservation.phone,
    companyId: companyId
  });

  // Log PIN-based save with manual move time to signal user-initiated change
  console.log('🔐 PIN-based save - setting last_manual_move_time:', {
    reservationId: reservation.id || 'NEW',
    isUpdate: isUpdate || false,
    timestamp: new Date().toISOString()
  });

    // Prepare reservation data
    const reservationData = {
      customer_name: reservation.customer_name,
      phone: reservation.phone ? (normalizeUKPhone(reservation.phone) || reservation.phone) : null, // ✅ NORMALIZE BEFORE STORING
      email: reservation.email || '',
      party_size: reservation.party_size,
      date: reservation.date,
      time: reservation.time,
      notes: reservation.notes || '',
      status: reservation.status || 'confirmed',
      locked: reservation.locked || false,
      locked_until: reservation.locked_until || null,
      has_allergens: reservation.has_allergens || false,
      allergens: reservation.allergens || [],
      company_id: companyId,
      table_number: null as number | null,
      table_numbers: null as number[] | null,
      // Signal that this is a user-initiated change (PIN authentication = user action)
      // This allows the database trigger to permit time/date/party_size changes
      last_manual_move_time: new Date().toISOString(),
    };

    // Set appropriate table field
    if (reservation.table_numbers && reservation.table_numbers.length > 1) {
      reservationData.table_numbers = reservation.table_numbers;
    } else if (reservation.table_numbers && reservation.table_numbers.length === 1) {
      reservationData.table_number = reservation.table_numbers[0];
    } else if (reservation.table_number) {
      reservationData.table_number = reservation.table_number;
    }

    let result;
    let operation;

    if (isUpdate && reservation.id) {
      // Update existing reservation
      operation = 'update';
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update(reservationData)
        .eq('id', reservation.id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) {
        console.error('Error updating reservation:', error);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to update reservation: ${error.message}` }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      result = data;
    } else {
      // Create new reservation
      operation = 'insert';
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .insert(reservationData)
        .select()
        .single();

      if (error) {
        console.error('Error creating reservation:', error);
        
        // Return detailed error information for frontend handling
        const errorBody = {
          success: false,
          error: `Failed to create reservation: ${error.message}`,
          code: error.code,
          details: error.details,
          hint: error.hint
        };
        
        return new Response(
          JSON.stringify(errorBody),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      result = data;
    }

    console.log(`Reservation ${operation} successful:`, result.id);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        user: userRecord.user_name,
        operation
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in pin-reservation-save:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});