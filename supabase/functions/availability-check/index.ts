import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('📋 Availability check request received');

    // Parse query parameters and body
    const url = new URL(req.url);
    const searchParams = url.searchParams;
    
    let params: any = {};
    
    // Try to get parameters from query string first
    if (searchParams.has('date') || searchParams.has('time')) {
      params = {
        date: searchParams.get('date'),
        time: searchParams.get('time'),
        party_size: searchParams.get('party_size'),
        company_id: searchParams.get('company_id'),
        duration_minutes: searchParams.get('duration_minutes')
      };
    } else {
      // Fallback to body parameters
      const body = await req.json().catch(() => ({}));
      params = body.query || body;
    }

    console.log('📝 Request parameters:', {
      date: params.date,
      time: params.time,
      party_size: params.party_size,
      company_id: params.company_id,
      duration_minutes: params.duration_minutes
    });

    // Validate required parameters
    const dateRaw = String(params.date ?? '').trim();
    const timeRaw = String(params.time ?? '').trim();
    const partySizeRaw = params.party_size;
    const companyIdRaw = params.company_id;

    // Validate date format (YYYY-MM-DD)
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : '';
    
    // Normalize time input
    function normTime(t: string) {
      t = (t ?? '').toString().trim().toLowerCase();
      if (!t) return null;

      // Supports: "13", "13:00", "1pm", "1:30 pm", "01:30:00"
      const m = t.match(/^(\d{1,2})(?::?(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/);
      if (!m) return null;

      let h = parseInt(m[1], 10);
      const mm = parseInt(m[2] ?? '0', 10);
      const ap = m[4];

      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;

      if (h > 23 || mm > 59) return null;

      const HH = String(h).padStart(2, '0');
      const MM = String(mm).padStart(2, '0');
      return { hhmm: `${HH}:${MM}`, full: `${HH}:${MM}:00` };
    }

    const time = normTime(timeRaw);
    const partySize = parseInt(partySizeRaw) || 0;
    const durationMinutes = parseInt(params.duration_minutes) || 120;

    // Validation
    if (!date || !time || partySize <= 0) {
      console.error('❌ Invalid parameters:', { date, time: time?.hhmm, partySize });
      return new Response(
        JSON.stringify({
          error: true,
          message: 'Missing or invalid required parameters: date (YYYY-MM-DD), time (HH:MM), party_size (number > 0)',
          available: false,
          reason: 'invalid_request'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If company_id is provided, use it; otherwise try to determine from context
    let companyId = companyIdRaw;
    
    // If no company_id provided, we could implement logic to determine it
    // For now, we'll require it to be provided
    if (!companyId) {
      console.error('❌ No company_id provided');
      return new Response(
        JSON.stringify({
          error: true,
          message: 'company_id parameter is required',
          available: false,
          reason: 'missing_company_id'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔍 Checking availability for:', {
      company_id: companyId,
      date,
      time: time.hhmm,
      party_size: partySize,
      duration_minutes: durationMinutes
    });

    // Call the comprehensive availability check function
    const { data: availabilityResult, error: availabilityError } = await supabase.rpc(
      'check_comprehensive_availability',
      {
        p_company_id: companyId,
        p_date: date,
        p_time: time.full,
        p_party_size: partySize,
        p_duration_minutes: durationMinutes
      }
    );

    if (availabilityError) {
      console.error('❌ Database error:', availabilityError);
      return new Response(
        JSON.stringify({
          error: true,
          message: 'Failed to check availability',
          available: false,
          reason: 'database_error'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Availability check completed:', availabilityResult);

    // Generate independent suggestions using +15/-15, +30/-30 pattern around requested time
    function hhmmToMinutes(v: string): number {
      const [H, M] = v.split(':').map((x) => parseInt(x, 10));
      return (H % 24) * 60 + (M % 60);
    }
    function minutesToHhmm(total: number): string {
      const m = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
      const H = String(Math.floor(m / 60)).padStart(2, '0');
      const M = String(m % 60).padStart(2, '0');
      return `${H}:${M}`;
    }

    const requestedMinutes = hhmmToMinutes(time.hhmm);
    // Use 15-minute intervals: +15, -15, +30, -30, +45, -45, etc.
    const offsets = [15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90];
    const suggestionCandidates: string[] = [];

    // Generate suggestions independently based on time offsets
    for (const off of offsets) {
      const candidate = minutesToHhmm(requestedMinutes + off);
      // Basic business hours check (10:00 - 22:00)
      const candidateMinutes = hhmmToMinutes(candidate);
      const businessStart = 10 * 60; // 10:00
      const businessEnd = 22 * 60;   // 22:00
      
      if (candidateMinutes >= businessStart && candidateMinutes <= businessEnd) {
        suggestionCandidates.push(candidate);
      }
      if (suggestionCandidates.length >= 6) break; // Generate more candidates than needed
    }

    // Enforce exact-slot capacity caps (hard limits)
    const MAX_BOOKINGS_PER_SLOT = 3;
    const MAX_GUESTS_PER_SLOT = 18;

    // Prepare exact-slot times to inspect (requested + suggestion candidates)
    const timesFullUnique = Array.from(
      new Set([time.full, ...suggestionCandidates.map((t) => `${t}:00`)])
    );

    // Fetch all reservations for the exact date and these exact times in a single query
    const { data: slotRows, error: slotErr } = await supabase
      .from('reservations')
      .select('time, party_size, status')
      .eq('company_id', companyId)
      .eq('date', date)
      .in('time', timesFullUnique)
      .not('status', 'in', '("cancelled","no-show")');

    if (slotErr) {
      console.error('❌ Slot metrics query failed:', slotErr);
    }

    // Build metrics per exact time slot (HH:MM)
    const slotMetrics: Record<string, { bookings: number; guests: number }> = {};
    for (const row of slotRows || []) {
      const key = String(row.time).slice(0, 5); // 'HH:MM'
      if (!slotMetrics[key]) slotMetrics[key] = { bookings: 0, guests: 0 };
      slotMetrics[key].bookings += 1;
      slotMetrics[key].guests += Number(row.party_size || 0);
    }

    const requestedSlot = slotMetrics[time.hhmm] || { bookings: 0, guests: 0 };
    const capExceeded =
      requestedSlot.bookings >= MAX_BOOKINGS_PER_SLOT ||
      requestedSlot.guests + partySize > MAX_GUESTS_PER_SLOT;

    const finalAvailable = (availabilityResult.available === true) && !capExceeded;

    // Filter suggestions to only include slots under caps when adding this party
    const filteredSuggestions = suggestionCandidates.filter((s) => {
      const sm = slotMetrics[s] || { bookings: 0, guests: 0 };
      return (
        sm.bookings < MAX_BOOKINGS_PER_SLOT &&
        sm.guests + partySize <= MAX_GUESTS_PER_SLOT
      );
    }).slice(0, 2);

    // Build appropriate message based on final availability
    let conciseMessage: string;
    if (finalAvailable) {
      conciseMessage = `Great news! We have availability for your party of ${partySize} at ${time.hhmm} on ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
    } else if (filteredSuggestions.length > 0) {
      if (filteredSuggestions.length === 1) {
        conciseMessage = `Unfortunately, we're fully booked for that time. How about ${filteredSuggestions[0]} instead?`;
      } else {
        conciseMessage = `Unfortunately, we're fully booked for that time. How about ${filteredSuggestions[0]} or ${filteredSuggestions[1]} instead?`;
      }
    } else {
      conciseMessage = `Unfortunately, we're fully booked around that time with no alternative slots available.`;
    }

    const response = {
      available: finalAvailable,
      message: conciseMessage,
      load_status: capExceeded ? 'slot_cap_reached' : (availabilityResult.load_status || 'unknown'),
      needs_staff_approval: availabilityResult.needs_staff_approval || false,
      requested: {
        date: date,
        time: time.hhmm,
        party_size: partySize,
        duration_minutes: durationMinutes
      },
      current_load: {
        ...(availabilityResult.current_load || {}),
        slot_usage: {
          bookings: requestedSlot.bookings,
          guests: requestedSlot.guests,
        },
        slot_caps: {
          max_bookings: MAX_BOOKINGS_PER_SLOT,
          max_guests: MAX_GUESTS_PER_SLOT,
        },
      },
      suggestions: filteredSuggestions,
      business_rules: {
        ...(availabilityResult.business_rules || {}),
        max_bookings_per_slot: MAX_BOOKINGS_PER_SLOT,
        max_guests_per_slot: MAX_GUESTS_PER_SLOT,
      },
      // Legacy compatibility fields for n8n
      count: availabilityResult.current_load?.available_capacity || 0,
      // Add timestamp for debugging
      checked_at: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: true,
        message: 'Internal server error',
        available: false,
        reason: 'server_error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});