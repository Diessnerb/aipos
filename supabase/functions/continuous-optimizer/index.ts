import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { DateTime } from "https://esm.sh/luxon@3.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationRequest {
  companyId: string;
  mode?: 'immediate' | 'strategic' | 'space_making' | 'make_space_for_incoming';
  pin?: string;
  isAuthenticatedAdmin?: boolean;
  automated?: boolean;
  targetDate?: string;
  targetTime?: string;
  targetPartySize?: number;
  preferredTables?: number[];
  forceDeepOptimization?: boolean;
  allowImminentMoves?: boolean; // Allow moving reservations within 30 minutes of starting (for manual overrides)
  allowStartedMoves?: boolean; // Allow moving reservations that have already started (for table service)
  forceMoveReservationIds?: string[]; // Specific reservation IDs to force move (override all protection)
  overrideImminentProtection?: boolean; // When true, skip imminent protection for forceMoveReservationIds
}

interface OptimizationResult {
  success: boolean;
  movesCount: number;
  sessionId: string;
  reason?: string;
  freedPreferredTables?: boolean; // True if preferred tables are now free for incoming reservation
  movedReservations?: Array<{
    id: string;
    customerName: string;
    fromTables: number[];
    toTables: number[];
  }>;
  blockedReasons?: string[];
  appliedOverrides?: {
    overrideImminentProtection: boolean;
    forcedReservationCount: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request body
    let requestBody;
    try {
      const text = await req.text();
      requestBody = text ? JSON.parse(text) : {};
    } catch {
      requestBody = {};
    }

    const { companyId, mode = 'immediate', pin, isAuthenticatedAdmin, automated = true, targetDate, targetTime, targetPartySize, preferredTables, forceDeepOptimization = false, allowImminentMoves = false, allowStartedMoves = false, forceMoveReservationIds = [], overrideImminentProtection = false } = requestBody as OptimizationRequest;
    
    const isMakeSpaceMode = mode === 'make_space_for_incoming';

    // CRITICAL: Validate companyId immediately
    if (!companyId || companyId === 'undefined' || typeof companyId !== 'string') {
      console.error(`[ERROR] INVALID COMPANY ID RECEIVED:`, {
        companyId,
        type: typeof companyId,
        requestBody,
        headers: {
          authorization: req.headers.get('authorization')?.substring(0, 20) + '...',
          origin: req.headers.get('origin'),
        }
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or missing companyId',
          details: `Received: ${companyId} (type: ${typeof companyId})`
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[OPTIMIZER] UNIVERSAL OPTIMIZATION:`, { 
      companyId, 
      mode, 
      automated,
      allowImminentMoves,
      allowStartedMoves,
      targetPartySize: targetPartySize || 'N/A',
      preferredTables: preferredTables ? `[${preferredTables.join(', ')}]` : 'N/A',
      forceMoveReservationIds: forceMoveReservationIds.length > 0 ? `${forceMoveReservationIds.length} forced` : 'none',
      overrideImminentProtection
    });
    
    if (forceMoveReservationIds.length > 0 && overrideImminentProtection) {
      console.log(`🔓 FORCE OVERRIDE enabled for ${forceMoveReservationIds.length} reservation(s)`);
    }

    // Check company settings for optimization
    const { data: settings } = await supabase
      .from('company_settings')
      .select('optimization_enabled, optimization_mode, auto_assign_tables, optimization_horizon_days, timezone')
      .eq('company_id', companyId)
      .maybeSingle();

    console.log(`[SETTINGS] Company settings:`, settings);

    const optimizationEnabled = settings ? 
      (settings.optimization_enabled || settings.auto_assign_tables) && 
      settings.optimization_mode !== 'disabled' 
      : true;

    if (!optimizationEnabled) {
      console.log('[INFO] Optimization disabled for company:', companyId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          movesCount: 0, 
          sessionId: crypto.randomUUID(),
          reason: 'Optimization disabled'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get optimizable reservations
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const horizonDays = settings?.optimization_horizon_days || 90;
    const endDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const tz = settings?.timezone || 'Europe/London';
    const nowZoned = DateTime.now().setZone(tz);
    
    // Use company's imminent threshold (default 10 minutes, not 30)
    const imminentThresholdMinutes = settings?.imminent_booking_threshold_minutes || 10;
    const imminentZoned = nowZoned.plus({ minutes: imminentThresholdMinutes });
    const protectionCutoff30Sec = new Date(Date.now() - 30 * 1000);

    console.log(`[PROTECTION] Filters (tz=${tz}): now=${nowZoned.toISO()}, imminent=${imminentZoned.toISO()} (threshold: ${imminentThresholdMinutes} min)`);

    // Fetch all reservations in date range
    const { data: reservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('company_id', companyId)
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['confirmed', 'pending'])
      .or('is_locked.is.null,is_locked.eq.false')
      .or('locked.is.null,locked.eq.false')
      .lt('created_at', protectionCutoff30Sec.toISOString());

    // Additional filtering for imminent reservations and locked tables
    const eligibleReservations = reservations?.filter(r => {
      const isForceMove = forceMoveReservationIds.includes(r.id);
      
      // Parse reservation date/time
      const resDateTime = DateTime.fromISO(`${r.date}T${r.time}`, { zone: tz });
      
      // CRITICAL CHECK #1: Has the reservation started?
      // Any reservation with start time < current time is IMMEDIATELY PROTECTED
      // (unless explicitly allowed for table-down scenarios)
      const hasStarted = resDateTime < nowZoned;
      
      if (hasStarted && !allowStartedMoves && !isForceMove) {
        console.log(`[PROTECTED] Already started: ${r.customer_name} at ${resDateTime.toISO()}`);
        return false;
      }

      if (hasStarted && (allowStartedMoves || isForceMove)) {
        console.log(`[WARNING] ALLOWING STARTED MOVE: ${r.customer_name} started at ${resDateTime.toISO()}`);
      }
      
      // Calculate end time (reservation + 2 hours)
      const resEndTime = resDateTime.plus({ hours: 2 });
      
      // CRITICAL CHECK #2: Has the reservation ended?
      if (resEndTime < nowZoned) {
        console.log(`[SKIPPED] Past: ${r.customer_name} ended at ${resEndTime.toISO()}`);
        return false;
      }
      
      // Check if reservation is locked until a future time
      if (r.locked_until && !isForceMove) {
        const lockedUntilTime = new Date(r.locked_until).getTime();
        if (lockedUntilTime > Date.now()) {
          console.log(`[PROTECTED] Locked: ${r.customer_name} locked until ${r.locked_until}`);
          return false;
        }
      }

      const resZoned = DateTime.fromISO(`${r.date}T${r.time}`, { zone: tz });
      const isImminent = resZoned >= nowZoned && resZoned <= imminentZoned;
      
      // Apply imminent protection UNLESS this is a force-moved reservation with override enabled
      if (isImminent && !allowImminentMoves && !(isForceMove && overrideImminentProtection)) {
        console.log(`[PROTECTED] Imminent <${imminentThresholdMinutes}min: ${r.customer_name} at ${resZoned.toISO()}`);
        return false;
      }
      
      if (isImminent && (allowImminentMoves || (isForceMove && overrideImminentProtection))) {
        const reason = isForceMove ? 'FORCE OVERRIDE' : 'allowImminentMoves';
        console.log(`[OVERRIDE] ${reason}: ${r.customer_name} at ${resZoned.toISO()} (within ${imminentThresholdMinutes}min threshold)`);
      }
      
      return true;
    }) || [];

    console.log(`[INFO] Found ${eligibleReservations.length} eligible reservations for optimization`);

    // MAKE SPACE MODE: Find inefficient reservations blocking ideal tables for incoming booking
    let finalEligibleReservations = eligibleReservations;
    if (isMakeSpaceMode && targetDate && targetTime && targetPartySize) {
      console.log(`[MAKE SPACE] Finding inefficient reservations to relocate for party of ${targetPartySize}`);
      if (allowImminentMoves) {
        console.log(`[WARNING] ALLOWING IMMINENT MOVES: Will consider reservations <${imminentThresholdMinutes}min away for relocation`);
      }
      
      // Step 1: Identify ideal tables for the incoming reservation
      const idealTables = await identifyIdealTablesForParty(supabase, companyId, targetPartySize, targetDate, targetTime);
      console.log(`[INFO] Ideal tables for incoming ${targetPartySize}-party:`, idealTables.length > 0 ? `T${idealTables.join(',')}` : 'NONE FOUND');
      if (idealTables.length > 0) {
        console.log(`[INFO] Space-making blockers will be prioritized if they occupy: T${idealTables.join(',')}`);
      }
      
      if (idealTables.length === 0) {
        console.log(`[WARNING] No ideal tables identified for ${targetPartySize} guests - will still try to optimize inefficient assignments`);
      }
      
      // Step 2: Find reservations that are inefficiently placed or blocking ideal tables
      const inefficientReservations = await identifyInefficientReservations(
        supabase, 
        eligibleReservations, 
        idealTables, 
        targetDate, 
        targetTime
      );
      
      console.log(`[INFO] Found ${inefficientReservations.length} inefficient reservations to consider relocating`);
      
      // CRITICAL: Mark these reservations for space-making mode to allow lateral moves
      inefficientReservations.forEach(r => {
        (r as any).__space_making_mode = true;
      });
      
      finalEligibleReservations = inefficientReservations;
      
    } else if (mode === 'space_making' && targetDate && targetTime && preferredTables && preferredTables.length > 0) {
      console.log(`[SPACE-MAKING] Filtering for reservations on T${preferredTables.join(', ')} at ${targetDate} ${targetTime}`);
      
      const targetTimeMinutes = timeToMinutes(targetTime);
      
      finalEligibleReservations = eligibleReservations.filter(r => {
        // Must be on the target date
        if (r.date !== targetDate) return false;
        
        // Must be within ±120 minutes of target time
        const resTimeMinutes = timeToMinutes(r.time);
        const timeDiff = Math.abs(resTimeMinutes - targetTimeMinutes);
        if (timeDiff >= 120) return false;
        
        // Must overlap with target tables
        const resTables = r.table_numbers || (r.table_number ? [r.table_number] : []);
        const overlaps = resTables.some((t: number) => preferredTables.includes(t));
        
        if (overlaps) {
          console.log(`[INFO] Found ${r.customer_name} on T${resTables.join(',')} at ${r.time} (overlaps with target, time diff: ${timeDiff}min)`);
        }
        
        return overlaps;
      });
      
      console.log(`[INFO] Space-making: ${finalEligibleReservations.length} reservations need to be moved`);
    }

    if (finalEligibleReservations.length === 0 && forceMoveReservationIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          movesCount: 0, 
          sessionId: crypto.randomUUID(),
          reason: mode === 'space_making' ? 'Target tables already free' : 'No eligible reservations'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = crypto.randomUUID();
    let movesCount = 0;
    const movedReservations: Array<{
      id: string;
      customerName: string;
      fromTables: number[];
      toTables: number[];
    }> = [];
    const blockedReasons: string[] = [];
    
    // Prioritize force-moved reservations first
    const forceMoveResList = finalEligibleReservations.filter(r => forceMoveReservationIds.includes(r.id));
    const otherResList = finalEligibleReservations.filter(r => !forceMoveReservationIds.includes(r.id));
    const prioritizedReservations = [...forceMoveResList, ...otherResList];
    
    if (forceMoveResList.length > 0) {
      console.log(`🎯 Prioritizing ${forceMoveResList.length} force-moved reservation(s):`, 
        forceMoveResList.map(r => `${r.customer_name} (${r.party_size} guests)`).join(', ')
      );
    }

    // FORCE MOVE MODE: Relocate specific reservations to free up preferredTables
    if (forceMoveReservationIds.length > 0 && overrideImminentProtection) {
      console.log(`\n🔓 FORCE MOVE MODE: Attempting to relocate ${forceMoveReservationIds.length} reservation(s)`);
      
      // Fetch operational tables for the company
      const { data: operationalTables } = await supabase
        .rpc('get_operational_tables', { p_company_id: companyId });
      
      if (!operationalTables || operationalTables.length === 0) {
        console.error('[ERROR] No operational tables found');
        blockedReasons.push('no_operational_tables');
      } else {
        console.log(`[INFO] Found ${operationalTables.length} operational tables`);
        
        // Fetch table groups with memberships
        const { data: tableGroupsData } = await supabase
          .from('table_groups')
          .select(`
            id,
            group_name,
            is_active,
            table_group_memberships (
              table_id,
              priority_order,
              tables (
                table_number,
                seats
              )
            )
          `)
          .eq('company_id', companyId)
          .eq('is_active', true);

        const tableGroups = (tableGroupsData || []).map((g: any) => {
          const memberships = g.table_group_memberships || [];
          const tableNumbers = memberships
            .sort((a: any, b: any) => (a.priority_order || 0) - (b.priority_order || 0))
            .map((m: any) => m.tables?.table_number)
            .filter((tn: number | undefined) => tn !== undefined);
          
          const totalSeats = memberships.reduce((sum: number, m: any) => 
            sum + (m.tables?.seats || 0), 0);
          
          console.log(`[GROUP LOADED] "${g.group_name}": T${tableNumbers.join(',')} (${totalSeats} seats)`);
          
          return {
            id: g.id,
            group_name: g.group_name,
            table_numbers: tableNumbers,
            total_seats: totalSeats
          };
        });

        console.log(`[INFO] Found ${tableGroups.length} active table groups`);
        
        // Process each forced reservation
        for (const resId of forceMoveReservationIds) {
          let reservation = forceMoveResList.find(r => r.id === resId);
          
          if (!reservation) {
            // Bypass eligibility filters: load forced reservation directly
            const { data: forcedRes, error: forcedErr } = await supabase
              .from('reservations')
              .select('*')
              .eq('company_id', companyId)
              .eq('id', resId)
              .not('status', 'in', '(cancelled,no-show,completed,table-complete)')
              .maybeSingle();
            
            if (forcedErr) {
              console.error(`[ERROR] Failed to load forced reservation ${resId}:`, forcedErr);
            }
            
            if (!forcedRes) {
              console.log(`[SKIP] Reservation ${resId} not found or inaccessible`);
              blockedReasons.push(`reservation_${resId}_not_found`);
              continue;
            }
            
            // Validate it actually blocks the target (tables and time window)
            if (targetDate && targetTime && Array.isArray(preferredTables) && preferredTables.length > 0) {
              const resTables = forcedRes.table_numbers || (forcedRes.table_number ? [forcedRes.table_number] : []);
              const hasTableOverlap = resTables.some((t: number) => preferredTables.includes(t));
              const targetMins = timeToMinutes(targetTime);
              const resMins = timeToMinutes(forcedRes.time);
              const timeDiff = Math.abs(resMins - targetMins);
              const overlapsWindow = forcedRes.date === targetDate && timeDiff < 120;
              if (!hasTableOverlap || !overlapsWindow) {
                console.log(`[SKIP] Forced reservation ${forcedRes.customer_name} not blocking target (tables overlap: ${hasTableOverlap}, timeDiff: ${timeDiff}min)`);
                blockedReasons.push(`forced_res_not_blocking_${resId}`);
                continue;
              }
            }
            
            reservation = forcedRes as any;
          }
          
          const currentTables = reservation.table_numbers || (reservation.table_number ? [reservation.table_number] : []);
          console.log(`\n🎯 Processing: ${reservation.customer_name} (${reservation.party_size} guests) currently on T${currentTables.join(',')}`);
          
          // Build candidate destinations
          const candidates: Array<{
            tables: number[];
            totalSeats: number;
            wastedSeats: number;
            type: 'group' | 'combo';
            groupName?: string;
          }> = [];
          
          // Helper: Check if candidate intersects with preferred tables
          const intersectsPreferredTables = (candidateTables: number[]): boolean => {
            if (!preferredTables || preferredTables.length === 0) return false;
            return candidateTables.some(t => preferredTables.includes(t));
          };
          
          // 1. Try table groups first (tightest fit, ascending)
          console.log(`[CANDIDATES] Evaluating table groups for ${reservation.customer_name} (${reservation.party_size} guests):`);
          for (const group of tableGroups) {
            const groupLabel = `"${group.group_name}" (T${group.table_numbers.join(',')}, ${group.total_seats} seats)`;
            
            if (group.total_seats < reservation.party_size) {
              console.log(`  [SKIP] ${groupLabel} - insufficient capacity (need ${reservation.party_size})`);
              continue;
            }
            
            // Skip if this group includes any of the preferred tables we're trying to free
            if (intersectsPreferredTables(group.table_numbers)) {
              console.log(`  [SKIP] ${groupLabel} - conflicts with target tables T${preferredTables?.join(',')}`);
              continue;
            }
            
            const wastedSeats = group.total_seats - reservation.party_size;
            console.log(`  [CANDIDATE] ${groupLabel} - ${wastedSeats} wasted seats`);
            candidates.push({
              tables: group.table_numbers,
              totalSeats: group.total_seats,
              wastedSeats,
              type: 'group',
              groupName: group.group_name
            });
          }
          
          // 2. Try single tables that can accommodate the party
          console.log(`[CANDIDATES] Evaluating single tables for ${reservation.customer_name} (${reservation.party_size} guests):`);
          for (const table of operationalTables) {
            const tableLabel = `T${table.table_number} (${table.seats} seats)`;
            
            if (table.seats < reservation.party_size) {
              continue; // Skip logging for obviously too-small tables
            }
            
            // Skip if this is one of the preferred tables we're trying to free
            if (intersectsPreferredTables([table.table_number])) {
              console.log(`  [SKIP] ${tableLabel} - is a target table for incoming reservation`);
              continue;
            }
            
            const wastedSeats = table.seats - reservation.party_size;
            console.log(`  [CANDIDATE] ${tableLabel} - ${wastedSeats} wasted seats`);
            candidates.push({
              tables: [table.table_number],
              totalSeats: table.seats,
              wastedSeats,
              type: 'combo'
            });
          }
          
          // Sort candidates: prefer tightest fit (least wasted seats), then fewest tables
          candidates.sort((a, b) => {
            if (a.wastedSeats !== b.wastedSeats) return a.wastedSeats - b.wastedSeats;
            return a.tables.length - b.tables.length;
          });
          
          console.log(`[SUMMARY] Generated ${candidates.length} candidates (sorted by waste, then table count)`);
          if (candidates.length === 0) {
            console.log(`[ERROR] NO CANDIDATES FOUND for ${reservation.customer_name}!`);
            console.log(`  - Available table groups: ${tableGroups.length}`);
            console.log(`  - Available single tables: ${operationalTables.filter(t => t.seats >= reservation.party_size).length}`);
            console.log(`  - preferredTables to avoid: T${preferredTables?.join(',')}`);
          }
          
          // Try each candidate until we find one without conflicts
          let relocated = false;
          for (const candidate of candidates) {
            const candidateLabel = candidate.type === 'group' 
              ? `${candidate.groupName} (T${candidate.tables.join(',')})` 
              : `T${candidate.tables.join(',')}`;
            
            console.log(`[TEST] Checking ${candidateLabel}: ${candidate.totalSeats} seats (${candidate.wastedSeats} wasted)`);
            
            // Check for conflicts using the database function
            const { data: conflictCheck, error: conflictError } = await supabase
              .rpc('check_table_conflict', {
                p_table_numbers: candidate.tables,
                p_date: reservation.date,
                p_time: reservation.time,
                p_exclude_reservation_id: reservation.id
              });
            
            if (conflictError) {
              console.error(`[ERROR] Conflict check failed for ${candidateLabel}:`, conflictError);
              continue;
            }
            
            console.log(`[CONFLICT CHECK] ${candidateLabel} at ${reservation.date} ${reservation.time}: ${conflictCheck ? '❌ HAS CONFLICTS' : '✅ AVAILABLE'}`);
            
            if (conflictCheck === true) {
              // Query which reservation is causing the conflict
              const { data: conflictingRes } = await supabase
                .from('reservations')
                .select('id, customer_name, party_size, time, table_numbers')
                .eq('date', reservation.date)
                .neq('id', reservation.id)
                .not('status', 'in', '(cancelled,no-show,completed,table-complete)')
                .limit(5);
              
              const conflicts = (conflictingRes || []).filter((cr: any) => {
                const crTables = cr.table_numbers || [];
                return candidate.tables.some((t: number) => crTables.includes(t));
              });
              
              if (conflicts.length > 0) {
                console.log(`[CONFLICT DETAIL] Blocked by: ${conflicts.map((c: any) => `${c.customer_name} on T${c.table_numbers?.join(',')}`).join(', ')}`);
              }
              
              continue;
            }
            
            // No conflicts! Update the reservation
            console.log(`✅ Found available destination: ${candidateLabel}`);
            
            const { error: updateError } = await supabase
              .from('reservations')
              .update({
                table_numbers: candidate.tables,
                table_number: candidate.tables[0],
                last_manual_move_time: new Date().toISOString()
              })
              .eq('id', reservation.id);
            
            if (updateError) {
              console.error(`[ERROR] Failed to update reservation:`, updateError);
              blockedReasons.push(`update_failed_${reservation.id}`);
              break;
            }
            
            console.log(`🎉 RELOCATED: ${reservation.customer_name} from T${currentTables.join(',')} → ${candidateLabel}`);
            
            movedReservations.push({
              id: reservation.id,
              customerName: reservation.customer_name,
              fromTables: currentTables,
              toTables: candidate.tables
            });
            movesCount++;
            relocated = true;
            break;
          }
          
          if (!relocated) {
            console.log(`❌ BLOCKED: No available destination found for ${reservation.customer_name}`);
            blockedReasons.push(`no_destination_${reservation.id}`);
          }
        }
        
        console.log(`\n✅ Force move complete: ${movesCount} successful, ${blockedReasons.length} blocked`);
        
        // Check if preferredTables are now actually free
        let freedPreferredTables = false;
        if (preferredTables && preferredTables.length > 0 && targetDate && targetTime) {
          console.log(`\n🔍 Verifying if T${preferredTables.join(',')} are now free for incoming reservation...`);
          
          const { data: finalConflictCheck } = await supabase
            .rpc('check_table_conflict', {
              p_table_numbers: preferredTables,
              p_date: targetDate,
              p_time: targetTime,
              p_exclude_reservation_id: null
            });
          
          freedPreferredTables = (finalConflictCheck === false);
          
          if (freedPreferredTables) {
            console.log(`✅ SUCCESS: T${preferredTables.join(',')} are now FREE for the incoming reservation!`);
          } else {
            console.log(`⚠️ WARNING: T${preferredTables.join(',')} still have conflicts after relocation`);
            if (blockedReasons.length === 0) {
              blockedReasons.push('preferred_tables_still_blocked');
            }
          }
        }
        
        // Return early with force-move results
        // Success is TRUE only if we freed the preferred tables
        return new Response(
          JSON.stringify({
            success: freedPreferredTables,
            freedPreferredTables,
            movesCount,
            sessionId,
            movedReservations,
            blockedReasons: blockedReasons.length > 0 ? blockedReasons : undefined,
            appliedOverrides: {
              overrideImminentProtection: true,
              forcedReservationCount: forceMoveReservationIds.length
            }
          } as OptimizationResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // FOR STRATEGIC MODE: Call AI Advisor for intelligent suggestions (1+ days ahead only)
    let aiSuggestions: any[] = [];
    let strategicTables: any[] = [];
    let strategicTableGroups: any[] = [];
    
    if (mode === 'strategic') {
      try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        // Get tables and groups for filtering
        const { data: allTablesForFilter } = await supabase
          .from('tables')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .neq('service_status', 'temporarily_removed')
          .neq('service_status', 'out_of_service');
        
        const { data: tableGroupsForFilter } = await supabase
          .from('table_groups')
          .select('id, group_name, table_numbers, is_active')
          .eq('company_id', companyId)
          .eq('is_active', true);
        
        // Store for later use in executeAISuggestion
        strategicTables = allTablesForFilter || [];
        
        const eligibleForAI = finalEligibleReservations.filter(r => {
          const resDate = new Date(r.date);
          resDate.setHours(0, 0, 0, 0);
          const daysAhead = Math.ceil((resDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Exclude if not today or future
          if (daysAhead < 0) return false;
          
          // PROTECTION: Exclude reservations on highly utilized standalone tables
          const currentTables = r.table_numbers || (r.table_number ? [r.table_number] : []);
          const standaloneUtilization = calculateStandaloneUtilization(
            currentTables,
            strategicTables,
            tableGroupsForFilter || [],
            r.party_size
          );
          
          if (standaloneUtilization.isHighUtilization) {
            console.log(`🛡️ EXCLUDED FROM AI: ${r.customer_name} on T${currentTables[0]} (${standaloneUtilization.utilizationPercent.toFixed(1)}% utilization) - protected standalone table`);
            return false;
          }
          
          return true;
        });

        if (eligibleForAI.length > 0) {
          console.log(`🤖 Calling AI Advisor for ${eligibleForAI.length} reservations...`);
          
          const { data: tableGroupsData } = await supabase
            .from('table_groups')
            .select(`
              id,
              group_name,
              is_active,
              table_group_memberships (
                table_id,
                priority_order,
                tables (
                  table_number,
                  seats
                )
              )
            `)
            .eq('company_id', companyId)
            .eq('is_active', true);

          const tableGroups = (tableGroupsData || []).map((g: any) => {
            const memberships = g.table_group_memberships || [];
            const tableNumbers = memberships
              .sort((a: any, b: any) => (a.priority_order || 0) - (b.priority_order || 0))
              .map((m: any) => m.tables?.table_number)
              .filter((tn: number | undefined) => tn !== undefined);
            const totalCapacity = memberships.reduce((sum: number, m: any) => 
              sum + (m.tables?.seats || 0), 0);

            return {
              id: g.id,
              group_name: g.group_name,
              table_numbers: tableNumbers,
              total_capacity: totalCapacity
            };
          });
          
          // Store for later use in executeAISuggestion
          strategicTableGroups = tableGroups;

          const aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-optimizer-advisor`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              companyId,
              reservations: eligibleForAI,
              tables: strategicTables,
              tableGroups,
              contextDate: eligibleForAI[0].date
            })
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiSuggestions = aiData.strategicMoves || [];
            console.log(`✨ AI Advisor suggested ${aiSuggestions.length} strategic moves`);
          }
        }
      } catch (aiError) {
        console.error('AI Advisor failed (continuing with standard optimization):', aiError);
      }
    }

    // Process each reservation through Universal Table Optimization Service
    for (const reservation of prioritizedReservations) {
      // Skip unassigned reservations
      if (!reservation.table_numbers?.length && !reservation.table_number) continue;

      // Calculate days ahead for this reservation
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const resDate = new Date(reservation.date);
      resDate.setHours(0, 0, 0, 0);
      const daysAhead = Math.max(0, Math.ceil((resDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // Mark reservation as space_making mode for relaxed improvement rules
      if (mode === 'space_making' || mode === 'make_space_for_incoming') {
        (reservation as any).__space_making_mode = true;
      }

      // Check if AI has a high-priority suggestion for this reservation
      const aiSuggestion = aiSuggestions.find(s => s.reservationId === reservation.id && s.priority === 'high');

      try {
        // If AI suggested a high-priority move, try it first
        if (aiSuggestion && mode === 'strategic') {
          console.log(`🎯 AI HIGH-PRIORITY: ${reservation.customer_name} -> T${aiSuggestion.suggestedTables.join(',')} (${aiSuggestion.reason})`);
          
          // Validate the AI suggestion and execute if valid
          const aiResult = await executeAISuggestion(supabase, companyId, reservation, aiSuggestion, daysAhead, strategicTables, strategicTableGroups);
          if (aiResult.success) {
            movesCount++;
            console.log(`✅ AI Move executed: ${aiSuggestion.reason}`);
            continue; // Skip standard optimization for this reservation
          }
        }

        // Standard optimization with Step D for strategic repositioning
        const result = await optimizeReservation(supabase, companyId, reservation, automated, daysAhead);
        
        if (result.success && result.improved) {
          const fromTables = reservation.table_numbers || (reservation.table_number ? [reservation.table_number] : []);
          const toTables = result.assignedTables || [];
          
          movesCount++;
          movedReservations.push({
            id: reservation.id,
            customerName: reservation.customer_name,
            fromTables,
            toTables
          });
          console.log(`✅ ${reservation.customer_name}: T${fromTables.join(',')} → T${toTables.join(',')} (${result.reason})`);
        } else if (!result.success) {
          console.log(`❌ ${reservation.customer_name}: ${result.reason}`);
          if (forceMoveReservationIds.includes(reservation.id)) {
            blockedReasons.push(`${reservation.customer_name}: ${result.reason}`);
          }
        } else {
          console.log(`⏭️ ${reservation.customer_name}: Already optimally assigned`);
        }
      } catch (error) {
        console.error(`Failed to optimize ${reservation.customer_name}:`, error);
      }
    }

    console.log(`🎉 Optimization completed: ${movesCount} moves executed`);

    const result: OptimizationResult = {
      success: movesCount > 0 || blockedReasons.length === 0,
      movesCount,
      sessionId,
      movedReservations: movedReservations.length > 0 ? movedReservations : undefined,
      blockedReasons: blockedReasons.length > 0 ? blockedReasons : undefined,
      appliedOverrides: forceMoveReservationIds.length > 0 ? {
        overrideImminentProtection,
        forcedReservationCount: forceMoveResList.length
      } : undefined,
      reason: movesCount === 0 && blockedReasons.length > 0 
        ? `Could not move: ${blockedReasons[0]}`
        : undefined
    };

    // Update last_optimized_at timestamp if any moves were made
    if (movesCount > 0) {
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({ last_optimized_at: new Date().toISOString() })
        .eq('company_id', companyId);
      
      if (updateError) {
        console.error('❌ Failed to update last_optimized_at:', updateError);
      } else {
        console.log('✅ Updated last_optimized_at timestamp');
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Optimization error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        movesCount: 0,
        sessionId: crypto.randomUUID()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ==============================================================================
// MAKE SPACE MODE HELPERS
// ==============================================================================

/**
 * Calculate if a standalone table assignment meets the 76% utilization threshold
 * Returns true if the reservation uses ≥76% of the table capacity
 */
function calculateStandaloneUtilization(
  currentTables: number[],
  tables: any[],
  tableGroups: any[],
  partySize: number
): { isHighUtilization: boolean; utilizationPercent: number } {
  // Only applies to single table assignments
  if (currentTables.length !== 1) {
    return { isHighUtilization: false, utilizationPercent: 0 };
  }

  // Check if table is part of a group
  const isPartOfGroup = tableGroups.some(g => 
    g.table_numbers && g.table_numbers.includes(currentTables[0])
  );
  
  // Only applies to standalone tables (not in any group)
  if (isPartOfGroup) {
    return { isHighUtilization: false, utilizationPercent: 0 };
  }

  // Get table capacity
  const table = tables.find(t => t.table_number === currentTables[0]);
  if (!table) {
    return { isHighUtilization: false, utilizationPercent: 0 };
  }

  // Calculate utilization percentage
  const utilizationPercent = (partySize / table.seats) * 100;
  const isHighUtilization = utilizationPercent >= 76;

  return { isHighUtilization, utilizationPercent };
}

/**
 * Analyze accessibility needs from notes
 */
function analyzeAccessibilityFromNotes(notes: string): { needsAccessible: boolean; avoidHighTop: boolean } {
  const lowerNotes = notes.toLowerCase();
  
  const accessibilityTerms = [
    'wheelchair', 'accessible', 'disability', 'disabled', 'mobility',
    'walker', 'crutches', 'accessibility', 'access needs'
  ];
  
  const highTopAvoidTerms = [
    'avoid bar', 'no bar', 'no high', 'standard seating', 'dining table',
    'prefer dining', 'regular table', 'avoid high-top', 'no high-top'
  ];
  
  const needsAccessible = accessibilityTerms.some(term => lowerNotes.includes(term));
  const avoidHighTop = highTopAvoidTerms.some(term => lowerNotes.includes(term));
  
  return { needsAccessible, avoidHighTop };
}

/**
 * Validate accessibility for table assignment
 */
function validateAccessibilityAssignment(
  tableNumbers: number[],
  allTables: any[],
  needsAccessible: boolean
): boolean {
  if (!needsAccessible) return true;
  
  // For multi-table: at least ONE must be accessible
  return tableNumbers.some(tn => {
    const table = allTables.find((t: any) => t.table_number === tn);
    return table?.accessibility_friendly === true;
  });
}

/**
 * Identify ideal tables for an incoming party size (with accessibility consideration)
 */
async function identifyIdealTablesForParty(
  supabase: any,
  companyId: string,
  partySize: number,
  date: string,
  time: string,
  notes?: string
): Promise<number[]> {
  // Analyze accessibility needs
  const { needsAccessible, avoidHighTop } = notes ? analyzeAccessibilityFromNotes(notes) : { needsAccessible: false, avoidHighTop: false };
  
  // Fetch available tables
  const { data: tables } = await supabase
    .from('tables')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .neq('service_status', 'temporarily_removed')
    .neq('service_status', 'out_of_service');
  
  if (!tables) return [];
  
  // Filter by accessibility requirements
  let filteredTables = tables;
  if (avoidHighTop) {
    filteredTables = filteredTables.filter((t: any) => !t.is_high_top);
  }
  
  // Step 1: Try to find single tables that can accommodate the party
  const singleTableMatches = filteredTables
    .filter((t: any) => {
      if (t.seats < partySize) return false;
      if (needsAccessible && !t.accessibility_friendly) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const wasteA = a.seats - partySize;
      const wasteB = b.seats - partySize;
      return wasteA - wasteB;
    })
    .slice(0, 3)
    .map((t: any) => t.table_number);
  
  if (singleTableMatches.length > 0) {
    console.log(`✅ Found ${singleTableMatches.length} single tables for ${partySize} guests:`, singleTableMatches);
    return singleTableMatches;
  }
  
  // Step 2: No single table fits - check table groups
  console.log(`🔍 No single table fits ${partySize} guests, checking table groups...`);
  
  // Fetch table groups - using two-step approach for reliability
  const { data: rawGroups, error: groupsError } = await supabase
    .from('table_groups')
    .select('id, group_name, is_active, max_combined_capacity')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (groupsError) {
    console.error(`❌ Error fetching table groups:`, groupsError);
    return [];
  }

  if (!rawGroups || rawGroups.length === 0) {
    console.log(`⚠️ No table groups found for company ${companyId}`);
    return [];
  }

  console.log(`[INFO] Found ${rawGroups.length} table groups, fetching memberships...`);

  // Fetch memberships for each group separately (more reliable than nested queries)
  const tableGroups = [];
  for (const group of rawGroups) {
    const { data: memberships, error: membErr } = await supabase
      .from('table_group_memberships')
      .select(`
        priority_order,
        tables!inner (
          table_number,
          seats
        )
      `)
      .eq('group_id', group.id)
      .order('priority_order', { ascending: true });
    
    if (membErr) {
      console.error(`[ERROR] Error fetching memberships for group ${group.group_name}:`, membErr);
      continue;
    }

    if (memberships && memberships.length > 0) {
      const tableNumbers = memberships.map((m: any) => m.tables.table_number);
      const totalSeats = memberships.reduce((sum: number, m: any) => sum + m.tables.seats, 0);
      
      tableGroups.push({
        id: group.id,
        group_name: group.group_name,
        is_active: group.is_active,
        table_numbers: tableNumbers,
        seats_data: memberships.map((m: any) => ({
          table_number: m.tables.table_number,
          seats: m.tables.seats
        }))
      });

      console.log(`  [OK] ${group.group_name}: T${tableNumbers.join(',')} (${totalSeats} seats)`);
    } else {
      console.log(`  [WARNING] ${group.group_name}: No memberships found`);
    }
  }
  
  console.log(`[INFO] Successfully loaded ${tableGroups.length} table groups with memberships`);
  
  // Find groups that can accommodate the party size
  const suitableGroups = tableGroups
    .filter((g: any) => {
      if (!g.table_numbers || g.table_numbers.length === 0) return false;
      
      // Use seats_data from the join to calculate total capacity accurately
      const totalSeats = g.seats_data.reduce((sum: number, t: any) => sum + t.seats, 0);
      
      // Must have sufficient capacity
      if (totalSeats < partySize) return false;
      
      // Must not waste too many seats (max 6 wasted)
      const wastedSeats = totalSeats - partySize;
      if (wastedSeats > 6) return false;
      
      // Check accessibility if needed
      if (needsAccessible) {
        const hasAccessible = g.table_numbers.some((tn: number) => {
          const table = filteredTables.find((t: any) => t.table_number === tn);
          return table?.accessibility_friendly === true;
        });
        if (!hasAccessible) return false;
      }
      
      return true;
    })
    .map((g: any) => {
      const totalSeats = g.seats_data.reduce((sum: number, t: any) => sum + t.seats, 0);
      const wastedSeats = totalSeats - partySize;
      
      return {
        group: g,
        tables: g.table_numbers,
        totalSeats,
        wastedSeats
      };
    })
    .sort((a: any, b: any) => {
      // Prefer groups with least wasted seats
      if (a.wastedSeats !== b.wastedSeats) {
        return a.wastedSeats - b.wastedSeats;
      }
      // Then prefer smaller groups (fewer tables)
      return a.tables.length - b.tables.length;
    });
  
  console.log(`📊 Evaluated ${tableGroups.length} groups, found ${suitableGroups.length} suitable for ${partySize} guests`);
  
  if (suitableGroups.length > 0) {
    const bestGroup = suitableGroups[0];
    console.log(`✅ Found table group for ${partySize} guests: ${bestGroup.group.group_name} (T${bestGroup.tables.join(',')}) - ${bestGroup.totalSeats} seats, ${bestGroup.wastedSeats} wasted`);
    return bestGroup.tables;
  }
  
  console.log(`❌ No suitable tables or groups found for ${partySize} guests`);
  return [];
}

/**
 * Identify inefficient reservations that should be relocated
 */
async function identifyInefficientReservations(
  supabase: any,
  allReservations: any[],
  idealTables: number[],
  targetDate: string,
  targetTime: string
): Promise<any[]> {
  const targetMinutes = timeToMinutes(targetTime);
  const targetEndMinutes = targetMinutes + 120;
  
  // Fetch table data for seat calculations
  const { data: tables } = await supabase
    .from('tables')
    .select('table_number, seats')
    .eq('is_active', true)
    .neq('service_status', 'temporarily_removed')
    .neq('service_status', 'out_of_service');
  
  const tableSeatsMap = new Map(tables?.map((t: any) => [t.table_number, t.seats]) || []);
  
  // Find reservations at the target time that are inefficiently placed
  const inefficientOnes = allReservations
    .filter((r: any) => {
      if (r.date !== targetDate) return false;
      
      const resMinutes = timeToMinutes(r.time);
      const resEndMinutes = resMinutes + 120;
      
      // Check if reservation overlaps with target time slot
      const overlaps = resMinutes < targetEndMinutes && resEndMinutes > targetMinutes;
      if (!overlaps) return false;
      
      // Get reservation's tables
      const resTables = r.table_numbers || (r.table_number ? [r.table_number] : []);
      
      // Calculate inefficiency score
      const totalSeats = resTables.reduce((sum: number, tn: number) => {
        return sum + (tableSeatsMap.get(tn) || 0);
      }, 0);
      
      const wastedSeats = totalSeats - r.party_size;
      const isBlockingIdealTable = resTables.some((tn: number) => idealTables.includes(tn));
      const isMultiTable = resTables.length > 1;
      
      // Consider inefficient if:
      // 1. Wasting 2+ seats OR
      // 2. Blocking an ideal table OR
      // 3. Using multiple tables for small party
      return wastedSeats >= 2 || isBlockingIdealTable || (isMultiTable && r.party_size <= 4);
    })
    .map((r: any) => {
      // Calculate inefficiency score for prioritization
      const resTables = r.table_numbers || (r.table_number ? [r.table_number] : []);
      const totalSeats = resTables.reduce((sum: number, tn: number) => {
        return sum + (tableSeatsMap.get(tn) || 0);
      }, 0);
      const wastedSeats = totalSeats - r.party_size;
      const isBlockingIdealTable = resTables.some((tn: number) => idealTables.includes(tn));
      
      const inefficiencyScore = 
        (wastedSeats * 10) +  // Penalize waste
        (isBlockingIdealTable ? 50 : 0) +  // High penalty for blocking ideal tables
        (resTables.length > 1 ? 20 : 0);  // Penalize multi-table assignments
      
      return { ...r, inefficiencyScore };
    })
    .sort((a: any, b: any) => b.inefficiencyScore - a.inefficiencyScore); // Highest inefficiency first
  
  if (inefficientOnes.length > 0) {
    console.log(`🔍 Found ${inefficientOnes.length} inefficient reservations blocking or wasting seats:`);
    inefficientOnes.slice(0, 5).forEach((r: any) => {
      const resTables = r.table_numbers || (r.table_number ? [r.table_number] : []);
      const isBlocking = resTables.some((tn: number) => idealTables.includes(tn));
      console.log(`  - ${r.customer_name} on T${resTables.join(',')} (${r.party_size} guests, score: ${r.inefficiencyScore})${isBlocking ? ' ⚠️ BLOCKING IDEAL TABLE' : ''}`);
    });
  } else {
    console.log(`✓ No inefficient reservations found`);
  }
  
  return inefficientOnes;
}

// ==============================================================================
// OPTIMIZATION LOGIC (Universal)
// ==============================================================================

/**
 * Optimize a single reservation using Universal Table Optimization Service logic
 */
/**
 * Execute an AI-suggested strategic move
 */
async function executeAISuggestion(
  supabase: any,
  companyId: string,
  reservation: any,
  suggestion: any,
  daysAhead: number,
  tables: any[],
  tableGroups: any[]
): Promise<{ success: boolean; reason: string }> {
  // PROTECTION: Check if current reservation is on a highly utilized standalone table
  const currentTables = reservation.table_numbers || (reservation.table_number ? [reservation.table_number] : []);
  const standaloneUtilization = calculateStandaloneUtilization(
    currentTables,
    tables,
    tableGroups,
    reservation.party_size
  );

  // Block AI suggestions that would move from highly utilized standalone to group/multi-table
  if (standaloneUtilization.isHighUtilization && suggestion.suggestedTables.length > 1) {
    console.log(`🛡️ PROTECTED: ${reservation.customer_name} on T${currentTables[0]} (${standaloneUtilization.utilizationPercent.toFixed(1)}% utilization) - AI suggestion blocked (would move to ${suggestion.suggestedTables.length} tables)`);
    return { success: false, reason: 'Protected: High utilization standalone table' };
  }

  // Verify suggested tables are available
  const availableTables = await getAvailableTables(
    supabase,
    companyId,
    reservation.date,
    reservation.time,
    reservation.id
  );

  const allAvailable = suggestion.suggestedTables.every((t: number) => availableTables.includes(t));
  if (!allAvailable) {
    return { success: false, reason: 'Suggested tables not available' };
  }

  // Execute the move
  const { error } = await supabase
    .from('reservations')
    .update({
      table_numbers: suggestion.suggestedTables,
      table_number: suggestion.suggestedTables[0]
    })
    .eq('id', reservation.id);

  if (error) {
    return { success: false, reason: `Database update failed: ${error.message}` };
  }

  // Log the AI decision
  await supabase
    .from('optimization_decisions')
    .insert({
      company_id: companyId,
      reservation_id: reservation.id,
      days_ahead: daysAhead,
      current_tables: reservation.table_numbers || [reservation.table_number],
      proposed_tables: suggestion.suggestedTables,
      action_taken: 'moved',
      reason: `AI Strategic: ${suggestion.reason}`,
      strategic_score: suggestion.strategicValue,
      was_ai_suggested: true
    });

  return { success: true, reason: suggestion.reason };
}

async function optimizeReservation(
  supabase: any,
  companyId: string,
  reservation: any,
  isAutomated: boolean,
  daysAhead: number = 0
): Promise<{ success: boolean; improved: boolean; reason: string }> {
  // Check if reservation is locked (respects both old and new lock fields)
  const isLocked = reservation.is_locked || reservation.locked;
  
  // Check for 10-second temporary lock (from manual moves)
  const manualMoveTime = reservation.last_manual_move_time;
  if (isAutomated && manualMoveTime) {
    const tenSecondsAgo = new Date(Date.now() - 10000);
    if (new Date(manualMoveTime) > tenSecondsAgo) {
      return { 
        success: false, 
        improved: false, 
        reason: 'Temporarily locked (recent manual move)' 
      };
    }
  }
  
  if (isLocked) {
    return { 
      success: false, 
      improved: false, 
      reason: 'Reservation is permanently locked' 
    };
  }

  // Get available tables at this time slot
  const availableTables = await getAvailableTables(
    supabase,
    companyId,
    reservation.date,
    reservation.time,
    reservation.id
  );

  // Get table data
  const { data: tables } = await supabase
    .from('tables')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .neq('service_status', 'temporarily_removed')
    .neq('service_status', 'out_of_service')
    .in('table_number', availableTables);

  if (!tables || tables.length === 0) {
    return { success: false, improved: false, reason: 'No tables available' };
  }

  // Get table groups using direct join for reliability
  const { data: rawGroups } = await supabase
    .from('table_groups')
    .select(`
      id,
      group_name,
      is_active,
      table_group_memberships!inner (
        priority_order,
        tables!inner (
          table_number,
          seats
        )
      )
    `)
    .eq('company_id', companyId)
    .eq('is_active', true);
  
  const tableGroups = rawGroups?.map((g: any) => ({
    id: g.id,
    group_name: g.group_name,
    is_active: g.is_active,
    table_numbers: g.table_group_memberships
      .sort((a: any, b: any) => a.priority_order - b.priority_order)
      .map((m: any) => m.tables.table_number),
    seats_data: g.table_group_memberships.map((m: any) => ({
      table_number: m.tables.table_number,
      seats: m.tables.seats
    }))
  })) || [];

  // Analyze accessibility from reservation notes
  const { needsAccessible, avoidHighTop } = reservation.notes ? analyzeAccessibilityFromNotes(reservation.notes) : { needsAccessible: false, avoidHighTop: false };
  
  // Filter tables by accessibility if needed
  let eligibleTables = tables;
  if (avoidHighTop) {
    eligibleTables = eligibleTables.filter((t: any) => !t.is_high_top);
  }

  // Get time-based risk assessment
  const timeBasedRisk = await assessTimeBasedRisk(
    supabase,
    companyId,
    reservation.date,
    reservation.time,
    reservation.party_size
  );

  // Try Step A: Single table (individual or from group)
  const stepAResult = await tryStepA(
    reservation.party_size,
    eligibleTables,
    tableGroups || [],
    supabase,
    companyId,
    reservation.date,
    reservation.time,
    timeBasedRisk
  );
  
  if (stepAResult.success && validateAccessibilityAssignment(stepAResult.tables, tables, needsAccessible)) {
    const currentTables = reservation.table_numbers || [reservation.table_number].filter(Boolean);
    const currentWaste = calculateWastedSeats(currentTables, tables, reservation.party_size);
    
    // PROTECTION: Block moves from high-utilization standalone tables (≥76%)
    const isSpaceMaking = (reservation as any).__space_making_mode === true;
    const standaloneUtilization = calculateStandaloneUtilization(currentTables, tables, tableGroups || [], reservation.party_size);
    if (standaloneUtilization.isHighUtilization && !isSpaceMaking) {
      console.log(`🛡️ 76% PROTECTION (Step A): ${reservation.customer_name} has ${standaloneUtilization.utilizationPercent.toFixed(1)}% utilization on T${currentTables[0]} - blocking move`);
      // Continue to next step instead of returning
    } else {
      if (standaloneUtilization.isHighUtilization && isSpaceMaking) {
        console.log(`🚨 OVERRIDING 76% PROTECTION via SPACE-MAKING (Step A): ${reservation.customer_name} on T${currentTables[0]}`);
      }
      // In space_making mode, allow moves even if not strictly better
      const isImprovement = isSpaceMaking || 
                           stepAResult.tables.length < currentTables.length ||
                           (stepAResult.tables.length === currentTables.length && stepAResult.wastedSeats < currentWaste);
      
      if (isImprovement) {
        await supabase
          .from('reservations')
          .update({
            table_numbers: stepAResult.tables,
            table_number: stepAResult.tables[0]
          })
          .eq('id', reservation.id);
        
        return { success: true, improved: true, reason: stepAResult.reason };
      }
    }
  }

  // Try Step B: Partial group (consecutive tables within a group)
  const stepBResult = await tryStepB(reservation.party_size, eligibleTables, tableGroups || []);
  
  if (stepBResult.success && validateAccessibilityAssignment(stepBResult.tables, tables, needsAccessible)) {
    const currentTables = reservation.table_numbers || [reservation.table_number].filter(Boolean);
    const currentWaste = calculateWastedSeats(currentTables, tables, reservation.party_size);
    
    // PROTECTION: Block moves from high-utilization standalone tables (≥76%)
    const isSpaceMaking = (reservation as any).__space_making_mode === true;
    const standaloneUtilization = calculateStandaloneUtilization(currentTables, tables, tableGroups || [], reservation.party_size);
    if (standaloneUtilization.isHighUtilization && !isSpaceMaking) {
      console.log(`🛡️ 76% PROTECTION (Step B): ${reservation.customer_name} has ${standaloneUtilization.utilizationPercent.toFixed(1)}% utilization on T${currentTables[0]} - blocking move`);
      // Continue to next step instead of returning
    } else {
      if (standaloneUtilization.isHighUtilization && isSpaceMaking) {
        console.log(`🚨 OVERRIDING 76% PROTECTION via SPACE-MAKING (Step B): ${reservation.customer_name} on T${currentTables[0]}`);
      }
      // Prefer valid consecutive group assignments over non-consecutive, even if waste is similar
      const currentIsConsecutive = isConsecutiveGroupAssignment(currentTables, tableGroups || []);
      
      // In space_making mode, allow moves even if not strictly better
      const isImprovement = isSpaceMaking || 
                           stepBResult.tables.length < currentTables.length ||
                           (!currentIsConsecutive && stepBResult.tables.length <= currentTables.length) ||
                           (stepBResult.tables.length === currentTables.length && stepBResult.wastedSeats < currentWaste);
      
      if (isImprovement) {
        if (isSpaceMaking) {
          console.log(`🎯 SPACE-MAKING (Step B): Accepting lateral move for ${reservation.customer_name} to ${stepBResult.reason}`);
        }
        
        await supabase
          .from('reservations')
          .update({
            table_numbers: stepBResult.tables,
            table_number: stepBResult.tables[0]
          })
          .eq('id', reservation.id);
        
        return { success: true, improved: true, reason: stepBResult.reason };
      }
    }
  }

  // Try Step C: Full group
  const stepCResult = await tryStepC(reservation.party_size, eligibleTables, tableGroups || []);
  
  if (stepCResult.success && validateAccessibilityAssignment(stepCResult.tables, tables, needsAccessible)) {
    const currentTables = reservation.table_numbers || [reservation.table_number].filter(Boolean);
    const currentWaste = calculateWastedSeats(currentTables, tables, reservation.party_size);
    
    // PROTECTION: Block moves from high-utilization standalone tables (≥76%)
    const isSpaceMaking = (reservation as any).__space_making_mode === true;
    const standaloneUtilization = calculateStandaloneUtilization(currentTables, tables, tableGroups || [], reservation.party_size);
    if (standaloneUtilization.isHighUtilization && !isSpaceMaking) {
      console.log(`🛡️ 76% PROTECTION (Step C): ${reservation.customer_name} has ${standaloneUtilization.utilizationPercent.toFixed(1)}% utilization on T${currentTables[0]} - blocking move`);
      // Continue to next step instead of returning
    } else {
      if (standaloneUtilization.isHighUtilization && isSpaceMaking) {
        console.log(`🚨 OVERRIDING 76% PROTECTION via SPACE-MAKING (Step C): ${reservation.customer_name} on T${currentTables[0]}`);
      }
      // In space_making mode, allow moves even if not strictly better
      const isImprovement = isSpaceMaking || stepCResult.wastedSeats < currentWaste;
      
      if (isImprovement) {
        if (isSpaceMaking) {
          console.log(`🎯 SPACE-MAKING (Step C): Accepting lateral move for ${reservation.customer_name} to ${stepCResult.reason}`);
        }
        
        await supabase
          .from('reservations')
          .update({
            table_numbers: stepCResult.tables,
            table_number: stepCResult.tables[0]
          })
          .eq('id', reservation.id);
        
        return { success: true, improved: true, reason: stepCResult.reason };
      }
    }
  }

  // STEP D: Strategic Space-Making (today and future reservations)
  if (daysAhead >= 0) {
    const stepDResult = await tryStepD_StrategicSpaceMaking(
      supabase,
      companyId,
      reservation,
      tables,
      tableGroups || [],
      availableTables,
      daysAhead
    );
    
    if (stepDResult.success) {
      console.log(`🎯 STEP D: ${stepDResult.reason} (Strategic Score: ${stepDResult.strategicScore})`);
      return { success: true, improved: true, reason: stepDResult.reason };
    }
  }

  return { success: false, improved: false, reason: 'No better assignment found' };
}

/**
 * STEP D: Strategic Space-Making (UNIFIED LOGIC)
 * NEW BEHAVIOR: Moves reservations FROM table groups TO standalone tables
 * Protects standalone tables - only moves if it improves the assignment
 * Integrates time-based risk assessment to prevent bad moves
 */
async function tryStepD_StrategicSpaceMaking(
  supabase: any,
  companyId: string,
  reservation: any,
  tables: any[],
  tableGroups: any[],
  availableTables: number[],
  daysAhead: number
): Promise<{ success: boolean; reason: string; strategicScore?: number }> {
  // CRITICAL: Never optimize reservations that have already started
  // This is a safety check in addition to the main filter
  const tz = 'Europe/London';
  const nowZoned = DateTime.now().setZone(tz);
  const resDateTime = DateTime.fromISO(`${reservation.date}T${reservation.time}`, { zone: tz });
  
  if (resDateTime < nowZoned) {
    console.log(`🚫 STRATEGIC PROTECTION: ${reservation.customer_name} has already started at ${resDateTime.toISO()} - current time is ${nowZoned.toISO()}`);
    return { 
      success: false, 
      reason: 'Reservation has already started - strategic optimization blocked' 
    };
  }
  
  const currentTables = reservation.table_numbers || [reservation.table_number].filter(Boolean);
  const partySize = reservation.party_size;

  // Check if currently on a standalone table (not part of any group)
  const currentlyOnGroup = tableGroups.some(g => 
    g.table_numbers && g.table_numbers.some((tn: number) => currentTables.includes(tn))
  );

  // PROTECTION: If already on a high-utilization standalone table (≥76%), DON'T move unless space-making
  const isSpaceMaking = (reservation as any).__space_making_mode === true;
  const standaloneUtilization = calculateStandaloneUtilization(currentTables, tables, tableGroups, partySize);
  if (standaloneUtilization.isHighUtilization && !isSpaceMaking) {
    console.log(`🛡️ 76% PROTECTION (Step D): ${reservation.customer_name} has ${standaloneUtilization.utilizationPercent.toFixed(1)}% utilization on T${currentTables[0]} - blocking move`);
    return { 
      success: false, 
      reason: `High utilization standalone table - ${standaloneUtilization.utilizationPercent.toFixed(1)}% on T${currentTables[0]}` 
    };
  }
  if (standaloneUtilization.isHighUtilization && isSpaceMaking) {
    console.log(`🚨 OVERRIDING 76% PROTECTION via SPACE-MAKING (Step D): ${reservation.customer_name} on T${currentTables[0]}`);
  }

  // NEW LOGIC: If currently on a table group, try to move TO a standalone table
  if (currentlyOnGroup) {
    console.log(`🔄 STRATEGIC OPPORTUNITY: ${reservation.customer_name} is on table group, checking for standalone options...`);
    
    // Find standalone tables (not part of any group)
    const standaloneTables = tables.filter(t => 
      !tableGroups.some(g => g.table_numbers && g.table_numbers.includes(t.table_number)) &&
      availableTables.includes(t.table_number) &&
      t.seats >= partySize &&
      t.seats - partySize <= 3 // Max 3 wasted seats
    );

    if (standaloneTables.length > 0) {
      // Find best standalone table
      const bestStandalone = standaloneTables.reduce((best, t) => {
        const waste = t.seats - partySize;
        const bestWaste = best.seats - partySize;
        return waste < bestWaste ? t : best;
      });

      const wastedSeats = bestStandalone.seats - partySize;
      const strategicScore = 200 - (wastedSeats * 10); // High base score for moving to standalone

      console.log(`✅ STRATEGIC MOVE: ${reservation.customer_name} FROM group TO standalone T${bestStandalone.table_number} (Score: ${strategicScore})`);

      // Execute move to standalone table
      const { error } = await supabase
        .from('reservations')
        .update({
          table_numbers: [bestStandalone.table_number],
          table_number: bestStandalone.table_number
        })
        .eq('id', reservation.id);

      if (error) {
        return { success: false, reason: `Database update failed: ${error.message}` };
      }

      // Log the decision
      await supabase
        .from('optimization_decisions')
        .insert({
          company_id: companyId,
          reservation_id: reservation.id,
          days_ahead: daysAhead,
          current_tables: currentTables,
          proposed_tables: [bestStandalone.table_number],
          action_taken: 'moved',
          reason: `Strategic move FROM group TO standalone T${bestStandalone.table_number} - reduced staff workload`,
          strategic_score: strategicScore,
          waste_after: wastedSeats
        });

      return {
        success: true,
        reason: `Strategic move to standalone T${bestStandalone.table_number} - reduced staff workload (${wastedSeats} wasted seats)`,
        strategicScore
      };
    }
  }

  // CRITICAL PROTECTION: NEVER move from standalone to group
  // Individual tables ALWAYS take precedence over table groups
  if (!currentlyOnGroup && currentTables.length === 1) {
    console.log(`🛡️ STANDALONE PRECEDENCE: ${reservation.customer_name} is on standalone T${currentTables[0]} - will NOT move to group`);
    return {
      success: false,
      reason: `Standalone table precedence - cannot move from T${currentTables[0]} to table group`
    };
  }

  // FALLBACK: Only move to a table group if time-based risk is acceptable
  // This section now only runs if reservation is currently ON a group
  if (currentTables.length === 1 && !currentlyOnGroup) {
    const currentTable = tables.find(t => t.table_number === currentTables[0]);
    if (!currentTable || currentTable.seats < 10) {
      return { success: false, reason: 'Not a strategic candidate for group move' };
    }

    // Check time-based risk before allowing move to group
    const riskAssessment = await assessTimeBasedRisk(
      supabase,
      companyId,
      reservation.date,
      reservation.time,
      partySize
    );

    console.log(`⏰ TIME-BASED RISK: ${reservation.customer_name} - ${riskAssessment.riskLevel} (${riskAssessment.reasoning})`);

    // HIGH risk = imminent booking, DO NOT move to table group
    if (riskAssessment.riskLevel === 'high') {
      return {
        success: false,
        reason: `Time-based protection: ${riskAssessment.reasoning}`
      };
    }

    // Find table groups that could fit this party
    const suitableGroups = tableGroups.filter(g => {
      if (!g.table_numbers || g.table_numbers.length < 2) return false;
      
      // All tables in group must be available
      const allAvailable = g.table_numbers.every((tn: number) => availableTables.includes(tn));
      if (!allAvailable) return false;

      // Calculate actual capacity from individual tables
      const groupTables = g.table_numbers.map((tn: number) => tables.find(t => t.table_number === tn)).filter(Boolean);
      const totalSeats = groupTables.reduce((sum: number, t: any) => sum + t.seats, 0);
      
      return totalSeats >= partySize && totalSeats - partySize <= 3; // Max 3 wasted seats
    });

    if (suitableGroups.length === 0) {
      return { success: false, reason: 'No suitable table groups available' };
    }

    // Find best group option with NEW strategic scoring
    let bestOption: any = null;
    let bestScore = -Infinity;

    for (const group of suitableGroups) {
      const groupTables = group.table_numbers.map((tn: number) => tables.find(t => t.table_number === tn)).filter(Boolean);
      const totalSeats = groupTables.reduce((sum: number, t: any) => sum + t.seats, 0);
      const wastedSeats = totalSeats - partySize;

      // NEW STRATEGIC SCORING: Penalize moving TO table groups
      const tableSeatsFreed = currentTable.seats;
      const timeBasedAdjustment = riskAssessment.scoreAdjustment || 0;
      
      const strategicScore = 
        -100 +                           // NEW: Penalty for using table group
        (tableSeatsFreed * 15) +         // Value of table freed (reduced weight)
        (daysAhead * 3) +                // Reduced days-ahead weight
        -(wastedSeats * 10) +            // Penalty for waste
        timeBasedAdjustment;             // NEW: Time-based adjustment

      // Much higher threshold: only move if score > 150 (was 100)
      const minScoreThreshold = 150;

      if (strategicScore > bestScore && strategicScore > minScoreThreshold) {
        bestScore = strategicScore;
        bestOption = {
          tables: group.table_numbers,
          groupName: group.group_name,
          totalSeats,
          wastedSeats,
          strategicScore
        };
      }
    }

    if (!bestOption) {
      return { success: false, reason: `No strategic benefit (score < 150, risk: ${riskAssessment.riskLevel})` };
    }

    console.log(`⚠️ STRATEGIC GROUP MOVE: ${reservation.customer_name} to ${bestOption.groupName} (Score: ${bestOption.strategicScore}, Risk: ${riskAssessment.riskLevel})`);

    // Execute the strategic move
    const { error } = await supabase
      .from('reservations')
      .update({
        table_numbers: bestOption.tables,
        table_number: bestOption.tables[0]
      })
      .eq('id', reservation.id);

    if (error) {
      return { success: false, reason: `Database update failed: ${error.message}` };
    }

    // Log the decision
    await supabase
      .from('optimization_decisions')
      .insert({
        company_id: companyId,
        reservation_id: reservation.id,
        days_ahead: daysAhead,
        current_tables: currentTables,
        proposed_tables: bestOption.tables,
        action_taken: 'moved',
        reason: `Strategic: Freed T${currentTables[0]} (${currentTable.seats} seats) - ${daysAhead}d ahead (Risk: ${riskAssessment.riskLevel})`,
        strategic_score: bestOption.strategicScore,
        waste_before: currentTable.seats - partySize,
        waste_after: bestOption.wastedSeats,
        large_tables_freed: 1
      });

    return {
      success: true,
      reason: `Strategic move to ${bestOption.groupName} [T${bestOption.tables.join(',')}] - freed T${currentTables[0]} (${currentTable.seats} seats) for future bookings`,
      strategicScore: bestOption.strategicScore
    };
  }

  return { success: false, reason: 'No strategic optimization available' };
}

/**
 * Assess time-based risk for table group assignment
 * Returns risk level and score adjustment
 */
async function assessTimeBasedRisk(
  supabase: any,
  companyId: string,
  reservationDate: string,
  reservationTime: string,
  partySize: number
): Promise<{ riskLevel: string; reasoning: string; scoreAdjustment: number }> {
  // Get company settings for thresholds
  const { data: settings } = await supabase
    .from('company_settings')
    .select('imminent_booking_threshold_minutes, short_term_horizon_minutes, large_party_lead_time_threshold_minutes, enable_time_based_group_protection')
    .eq('company_id', companyId)
    .single();

  // If feature disabled, return safe
  if (settings && settings.enable_time_based_group_protection === false) {
    return { riskLevel: 'safe', reasoning: 'Time-based protection disabled', scoreAdjustment: 0 };
  }

  const imminentThreshold = settings?.imminent_booking_threshold_minutes || 30; // Use actual setting (30 min default)
  const shortTermThreshold = settings?.short_term_horizon_minutes || 120;
  const largePartyThreshold = settings?.large_party_lead_time_threshold_minutes || 240;

  // Calculate minutes until reservation
  const now = new Date();
  const resDateTime = new Date(`${reservationDate}T${reservationTime}`);
  const minutesUntil = Math.floor((resDateTime.getTime() - now.getTime()) / (1000 * 60));

  // IMMINENT booking (< 30 min) = HIGH risk - DON'T MOVE
  if (minutesUntil < imminentThreshold) {
    return {
      riskLevel: 'high',
      reasoning: `Imminent booking (${minutesUntil} min). Guests arriving soon - do not move.`,
      scoreAdjustment: -200 // Strong penalty to block moves
    };
  }

  // SHORT-TERM booking (30 min - 2 hours) = LOW risk - OPTIMIZE FOR EFFICIENCY
  if (minutesUntil < shortTermThreshold) {
    return {
      riskLevel: 'low',
      reasoning: `Last 2 hours (${minutesUntil} min). Optimize for immediate efficiency - don't save space.`,
      scoreAdjustment: -20 // Small penalty, but still allow beneficial moves
    };
  }

  // MEDIUM-TERM booking (2-4 hours) = MODERATE risk - BALANCED
  if (minutesUntil < largePartyThreshold) {
    return {
      riskLevel: 'moderate',
      reasoning: `Medium-term booking (${minutesUntil} min). Balanced approach - some strategic benefit.`,
      scoreAdjustment: +30 // Small bonus for strategic moves
    };
  }

  // LONG-TERM booking (4+ hours) = SAFE - FULL STRATEGIC MODE
  return {
    riskLevel: 'safe',
    reasoning: `Long-term booking (${minutesUntil} min). Full strategic optimization - maximize efficiency.`,
    scoreAdjustment: +100
  };
}

/**
 * Check if a table has back-to-back booking potential
 * Returns score: +100 for back-to-back on both sides, +50 for one side, 0 otherwise
 * ONLY returns bonus if table utilization will be ≥74%
 */
async function calculateBackToBackScore(
  supabase: any,
  companyId: string,
  tableNumber: number,
  tableSeats: number,
  partySize: number,
  date: string,
  time: string
): Promise<{ score: number; reasoning: string }> {
  // Calculate utilization percentage
  const utilizationPercent = (partySize / tableSeats) * 100;
  
  // CRITICAL: Only consider back-to-back bonus if utilization ≥74%
  if (utilizationPercent < 74) {
    return { 
      score: 0, 
      reasoning: `Utilization ${utilizationPercent.toFixed(1)}% < 74% threshold - no back-to-back bonus` 
    };
  }

  const targetMinutes = timeToMinutes(time);
  const beforeMinutes = targetMinutes - 120; // 2 hours before
  const afterMinutes = targetMinutes + 120;  // 2 hours after
  
  // Get all reservations on this specific table for this date
  const { data: reservations } = await supabase
    .from('reservations')
    .select('time, party_size')
    .eq('company_id', companyId)
    .eq('date', date)
    .not('status', 'in', '("cancelled","no-show")')
    .or(`table_number.eq.${tableNumber},table_numbers.cs.{${tableNumber}}`);
  
  if (!reservations || reservations.length === 0) {
    return { score: 0, reasoning: `${utilizationPercent.toFixed(1)}% utilization but no other bookings` };
  }
  
  let hasBefore = false;
  let hasAfter = false;
  
  for (const res of reservations) {
    const resMinutes = timeToMinutes(res.time);
    const timeDiff = Math.abs(resMinutes - targetMinutes);
    
    // Check if there's a booking within 2 hours before or after
    if (timeDiff > 0 && timeDiff <= 120) {
      if (resMinutes < targetMinutes) hasBefore = true;
      if (resMinutes > targetMinutes) hasAfter = true;
    }
  }
  
  if (hasBefore && hasAfter) {
    return { 
      score: 100, 
      reasoning: `${utilizationPercent.toFixed(1)}% utilization + back-to-back both sides (max efficiency)` 
    };
  } else if (hasBefore || hasAfter) {
    return { 
      score: 50, 
      reasoning: `${utilizationPercent.toFixed(1)}% utilization + back-to-back one side` 
    };
  }
  
  return { 
    score: 0, 
    reasoning: `${utilizationPercent.toFixed(1)}% utilization but no back-to-back opportunity` 
  };
}

/**
 * Get available tables at a specific time
 */
async function getAvailableTables(
  supabase: any,
  companyId: string,
  date: string,
  time: string,
  excludeReservationId?: string
): Promise<number[]> {
  const { data: allTables } = await supabase
    .from('tables')
    .select('table_number')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .neq('service_status', 'temporarily_removed')
    .neq('service_status', 'out_of_service');

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, time, table_number, table_numbers')
    .eq('company_id', companyId)
    .eq('date', date)
    .not('status', 'in', '("cancelled","no-show")');

  const occupiedTables = new Set<number>();
  
  reservations?.forEach(r => {
    if (r.id === excludeReservationId) return;
    
    // Guard against null/undefined time
    if (!r.time) return;
    
    const resTime = timeToMinutes(r.time);
    const targetTime = timeToMinutes(time);
    
    if (Math.abs(resTime - targetTime) < 120) {
      if (r.table_numbers?.length) {
        r.table_numbers.forEach((t: number) => occupiedTables.add(t));
      } else if (r.table_number) {
        occupiedTables.add(r.table_number);
      }
    }
  });

  return allTables?.map(t => t.table_number).filter(t => !occupiedTables.has(t)) || [];
}

/**
 * Step A: Try single table assignment
 * PRIORITY 1: Minimize wasted seats
 * PRIORITY 2: Back-to-back booking potential (ONLY if utilization ≥74%)
 * PRIORITY 3: Prefer standalone over group tables
 */
async function tryStepA(
  partySize: number,
  tables: any[],
  groups: any[],
  supabase: any,
  companyId: string,
  date: string,
  time: string,
  timeBasedRisk?: { riskLevel: string; reasoning: string; scoreAdjustment: number }
): Promise<any> {
  const isAggressiveMode = timeBasedRisk?.riskLevel === 'low';
  
  // Separate standalone and group tables
  const nonGroupTables = tables.filter(t => !groups.some(g => g.table_numbers?.includes(t.table_number)));
  const groupTables = tables.filter(t => groups.some(g => g.table_numbers?.includes(t.table_number)));
  
  // Evaluate standalone tables with back-to-back scoring
  const standaloneCandidates = [];
  
  for (const table of nonGroupTables) {
    if (table.seats >= partySize) {
      const waste = table.seats - partySize;
      const backToBackResult = await calculateBackToBackScore(
        supabase, 
        companyId, 
        table.table_number, 
        table.seats, 
        partySize, 
        date, 
        time
      );
      
      // Scoring formula:
      // - Waste penalty: waste * 10 (higher waste = lower score)
      // - Back-to-back bonus: 0, 50, or 100 (only if utilization ≥74%)
      const totalScore = backToBackResult.score - (waste * 10);
      
      standaloneCandidates.push({
        table,
        waste,
        backToBackScore: backToBackResult.score,
        backToBackReason: backToBackResult.reasoning,
        totalScore
      });
      
      console.log(`📊 T${table.table_number}: ${table.seats} seats, ${waste} waste, ${backToBackResult.reasoning}, SCORE: ${totalScore}`);
    }
  }
  
  // Sort by total score (highest first)
  standaloneCandidates.sort((a, b) => b.totalScore - a.totalScore);
  
  // Check if best standalone has reasonable waste (≤3 seats)
  if (standaloneCandidates.length > 0) {
    const best = standaloneCandidates[0];
    
    // Calculate utilization percentage for best standalone
    const bestUtilization = (partySize / best.table.seats) * 100;
    
    // If utilization is GOOD (≥74%), use standalone immediately
    if (bestUtilization >= 74) {
      const reason = best.backToBackScore > 0 
        ? `T${best.table.table_number} (${best.table.seats} seats, ${bestUtilization.toFixed(1)}% utilization) - ${best.backToBackReason}`
        : `Standalone table T${best.table.table_number} (${best.table.seats} seats, ${bestUtilization.toFixed(1)}% utilization)`;
        
      return {
        success: true,
        tables: [best.table.table_number],
        wastedSeats: best.waste,
        reason
      };
    }
    
    // AGGRESSIVE MODE: If utilization is LOW (<74%) AND we're in last 2 hours, find a better table
    if (isAggressiveMode && bestUtilization < 74) {
      console.log(`⚡ AGGRESSIVE MODE: Standalone has ${bestUtilization.toFixed(1)}% utilization (<74%) - finding better table`);
      
      // Evaluate SINGLE group tables (not combinations)
      const singleGroupCandidates = [];
      
      for (const table of groupTables) {
        if (table.seats >= partySize) {
          const waste = table.seats - partySize;
          
          // Calculate utilization for this group table
          const groupUtilization = (partySize / table.seats) * 100;
          
          // Consider if utilization is better (closer to or above 74%)
          if (groupUtilization > bestUtilization) {
            const backToBackResult = await calculateBackToBackScore(
              supabase, 
              companyId, 
              table.table_number, 
              table.seats, 
              partySize, 
              date, 
              time
            );
            
            const totalScore = backToBackResult.score - (waste * 10);
            
            singleGroupCandidates.push({
              table,
              waste,
              backToBackScore: backToBackResult.score,
              backToBackReason: backToBackResult.reasoning,
              totalScore
            });
            
            console.log(`📊 [GROUP] T${table.table_number}: ${table.seats} seats, ${waste} waste, SCORE: ${totalScore}`);
          }
        }
      }
      
      // If a single group table is SIGNIFICANTLY better, use it
      if (singleGroupCandidates.length > 0) {
        singleGroupCandidates.sort((a, b) => b.totalScore - a.totalScore);
        const bestGroup = singleGroupCandidates[0];
        
        // Calculate group utilization
        const bestGroupUtilization = (partySize / bestGroup.table.seats) * 100;
        
        // Use group table if utilization is meaningfully better
        if (bestGroupUtilization > bestUtilization) {
          return {
            success: true,
            tables: [bestGroup.table.table_number],
            wastedSeats: bestGroup.waste,
            reason: `⚡ Single group table T${bestGroup.table.table_number} (${bestGroup.table.seats} seats, ${bestGroupUtilization.toFixed(1)}% utilization) - better than T${best.table.table_number} (${bestUtilization.toFixed(1)}%) [AGGRESSIVE MODE]`
          };
        }
      }
      
      // If no better group table, use the standalone even with low utilization
      console.log(`No better single group table found - using standalone T${best.table.table_number} at ${bestUtilization.toFixed(1)}% utilization`);
    }
    
    // Use best standalone (even if utilization is low)
    const reason = best.backToBackScore > 0 
      ? `T${best.table.table_number} (${best.table.seats} seats, ${bestUtilization.toFixed(1)}% utilization) - ${best.backToBackReason}`
      : `Standalone table T${best.table.table_number} (${best.table.seats} seats, ${bestUtilization.toFixed(1)}% utilization)`;
      
    return {
      success: true,
      tables: [best.table.table_number],
      wastedSeats: best.waste,
      reason
    };
  }

  // ONLY consider group tables if NO standalone tables fit
  for (const table of groupTables.sort((a, b) => a.seats - b.seats)) {
    if (table.seats >= partySize && (table.seats - partySize) <= 3) {
      return {
        success: true,
        tables: [table.table_number],
        wastedSeats: table.seats - partySize,
        reason: `Single group table T${table.table_number} (${table.seats} seats) - no standalone available`
      };
    }
  }

  return { success: false };
}

/**
 * Step B: Try consecutive tables within a group
 */
async function tryStepB(partySize: number, tables: any[], groups: any[]): Promise<any> {
  let bestCombo: any = null;

  for (const group of groups) {
    if (!group.table_numbers?.length) continue;

    const groupTables = tables.filter(t => group.table_numbers.includes(t.table_number))
      .sort((a, b) => group.table_numbers.indexOf(a.table_number) - group.table_numbers.indexOf(b.table_number));

    // Try all consecutive combinations
    for (let start = 0; start < groupTables.length; start++) {
      let totalSeats = 0;
      const combo: number[] = [];

      for (let end = start; end < groupTables.length; end++) {
        const table = groupTables[end];
        combo.push(table.table_number);
        totalSeats += table.seats;

        if (totalSeats >= partySize) {
          // Validate consecutive combination
          if (!isValidConsecutive(combo, group.table_numbers)) {
            continue; // Skip invalid combinations
          }

          const wastedSeats = totalSeats - partySize;
          // Priority 1: Fewest tables, Priority 2: Least waste
          if (!bestCombo || 
              combo.length < bestCombo.tables.length ||
              (combo.length === bestCombo.tables.length && wastedSeats < bestCombo.wastedSeats)) {
            bestCombo = {
              success: true,
              tables: [...combo],
              wastedSeats,
              reason: `${combo.length} consecutive tables in ${group.group_name}: [${combo.join(',')}]`
            };
          }
          // Don't break - continue checking other combinations for fewer tables
        }
      }
    }
  }

  return bestCombo || { success: false };
}

/**
 * Step C: Try full group assignment
 */
async function tryStepC(partySize: number, tables: any[], groups: any[]): Promise<any> {
  let bestGroup: any = null;

  for (const group of groups) {
    if (!group.table_numbers?.length) continue;

    // Validate full group is consecutive
    if (!isValidConsecutive(group.table_numbers, group.table_numbers)) {
      continue; // Skip invalid groups
    }

    const groupTables = tables.filter(t => group.table_numbers.includes(t.table_number));
    const totalSeats = groupTables.reduce((sum, t) => sum + t.seats, 0);

    if (totalSeats >= partySize) {
      const wastedSeats = totalSeats - partySize;
      if (!bestGroup || totalSeats < bestGroup.totalSeats) {
        bestGroup = {
          success: true,
          tables: group.table_numbers,
          totalSeats,
          wastedSeats,
          reason: `Full group ${group.group_name} (${totalSeats} seats)`
        };
      }
    }
  }

  return bestGroup || { success: false };
}

function timeToMinutes(time: string): number {
  if (!time) return 0;
  const parts = time.split(':');
  if (parts.length < 2) return 0;
  const [hours, minutes] = parts.map(Number);
  return hours * 60 + minutes;
}

function calculateWastedSeats(tableNumbers: number[], tables: any[], partySize: number): number {
  const usedTables = tables.filter(t => tableNumbers.includes(t.table_number));
  const totalSeats = usedTables.reduce((sum, t) => sum + t.seats, 0);
  return totalSeats - partySize;
}

/**
 * Check if table numbers form a consecutive group assignment
 */
function isConsecutiveGroupAssignment(tableNumbers: number[], groups: any[]): boolean {
  if (tableNumbers.length <= 1) return true;
  
  for (const group of groups) {
    if (!group.table_numbers?.length) continue;
    
    // Check if all tables are in this group
    const allInGroup = tableNumbers.every(t => group.table_numbers.includes(t));
    if (!allInGroup) continue;
    
    // Check if they're consecutive in the group's order
    const positions = tableNumbers.map(t => group.table_numbers.indexOf(t)).sort((a, b) => a - b);
    const isConsecutive = positions.every((pos, idx) => idx === 0 || pos === positions[idx - 1] + 1);
    
    if (isConsecutive) return true;
  }
  
  return false;
}

/**
 * Validate if tables are consecutive within a group
 * Helper function for optimization validation
 */
function isValidConsecutive(tablesToCheck: number[], groupTables: number[]): boolean {
  if (tablesToCheck.length <= 1) return true;
  
  // Find positions of tables in the group
  const positions = tablesToCheck
    .map(t => groupTables.indexOf(t))
    .filter(pos => pos !== -1)
    .sort((a, b) => a - b);
  
  // Check if positions are consecutive
  return positions.every((pos, idx) => idx === 0 || pos === positions[idx - 1] + 1);
}
