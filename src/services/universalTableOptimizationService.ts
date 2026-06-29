import { supabase } from '@/integrations/supabase/client';
import { Table } from '@/types/table';
import { Reservation } from '@/types/reservation';
import { isValidTableCombination } from '@/utils/tableGroupUtils';
import { analyzeAccessibilityNotes } from '@/utils/accessibilityDetection';

export interface TableGroupWithTables {
  id: string;
  group_name: string;
  table_numbers: number[];
  total_capacity: number;
  is_active: boolean;
}

export interface OptimizationResult {
  success: boolean;
  tables: number[];
  reason: string;
  strategy: 'single_individual' | 'single_group_table' | 'partial_group' | 'full_group' | 'failed';
  wastedSeats: number;
  totalSeats: number;
  groupName?: string;
  error?: string;
  locked?: boolean;
  spaceMakingApplied?: boolean;
  globalRebalancingApplied?: boolean;
  movedReservations?: number;
  capacityScore?: number; // NEW: Score for capacity optimization
}

const TEMPORARY_LOCK_DURATION_MS = 10000; // 10 seconds
const WASTAGE_TOLERANCE = 3; // Seats we're willing to waste if it improves global capacity

/**
 * Universal Table Optimization Service
 * Applies consistent optimization logic across ALL table assignment scenarios
 */
export class UniversalTableOptimizationService {
  /**
   * Calculate days ahead for a reservation date
   */
  private static getDaysAhead(reservationDate: string): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const resDate = new Date(reservationDate);
    resDate.setHours(0, 0, 0, 0);
    const diffTime = resDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Calculate capacity score for a table assignment
   * Higher score = better for global capacity optimization
   * ENHANCED: Now considers days ahead for strategic large table protection
   */
  private static calculateCapacityScore(
    assignedTables: number[],
    totalSeats: number,
    wastedSeats: number,
    partySize: number,
    allTables: Table[],
    availableTables: number[],
    daysAhead: number = 0,
    tableGroups?: TableGroupWithTables[],
    timeBasedRiskAdjustment: number = 0
  ): number {
    let score = 1000; // Base score
    
    // 1. Penalize number of tables (fewer is better)
    score -= assignedTables.length * 50;
    
    // 2. Penalize wasted seats (but with tolerance)
    if (wastedSeats > WASTAGE_TOLERANCE) {
      score -= (wastedSeats - WASTAGE_TOLERANCE) * 20;
    }
    
    // 3. BONUS: Using smaller tables for smaller parties
    const avgTableSize = totalSeats / assignedTables.length;
    if (partySize <= 4 && avgTableSize <= 6) {
      score += 30; // Reward using small tables for small parties
    }
    
    // 4. BONUS: Leaving larger single tables available (ENHANCED with days-ahead multiplier)
    const largeTablesStillAvailable = availableTables.filter(tn => {
      if (assignedTables.includes(tn)) return false; // This table would be used
      const table = allTables.find(t => t.table_number === tn);
      return table && table.seats >= 8;
    }).length;
    
    // Protection multiplier: More days ahead = more aggressive protection
    const protectionMultiplier = Math.min(1 + (daysAhead * 0.5), 7); // Cap at 7x for 12+ days ahead
    score += largeTablesStillAvailable * 15 * protectionMultiplier;
    
    // 4b. BONUS: Leaving large table GROUPS available for future
    if (tableGroups) {
      const largeGroupsStillAvailable = tableGroups.filter(group => {
        // Check if group is still fully available
        const allAvailable = group.table_numbers.every(tn => 
          availableTables.includes(tn) && !assignedTables.includes(tn)
        );
        return allAvailable && group.total_capacity >= 10; // Consider groups that can seat 10+
      }).length;
      score += largeGroupsStillAvailable * 40 * protectionMultiplier;
    }
    
    // 5. PENALTY: Using accessibility tables for non-accessibility reservations
    // BUT: Only penalize if the assignment is wasteful AND capacity is very tight
    const accessibilityWaste = assignedTables.reduce((waste, tn) => {
      const table = allTables.find(t => t.table_number === tn);
      if (!table?.accessibility_friendly) return waste;
      
      // Calculate waste for this accessible table
      const tableSeats = table.seats;
      const perTableGuests = partySize / assignedTables.length;
      const tableWaste = tableSeats - perTableGuests;
      const wastePercent = (tableWaste / tableSeats) * 100;
      
      // Only count as "wasteful" if > 25% of accessible table is unused
      return wastePercent > 25 ? waste + 1 : waste;
    }, 0);
    
    // Calculate availability ratio
    const totalSeatsAvailable = availableTables.reduce((sum, tn) => {
      const table = allTables.find(t => t.table_number === tn);
      return sum + (table?.seats || 0);
    }, 0);
    const totalSeatsInRestaurant = allTables.reduce((sum, t) => sum + t.seats, 0);
    const availabilityRatio = totalSeatsAvailable / totalSeatsInRestaurant;
    
    // Only penalize accessible tables when:
    // 1. Capacity is VERY tight (< 10% available = 90%+ full)
    // 2. The assignment is wasteful (> 25% of accessible table unused)
    // 3. Assignment is NOT a perfect fit (wastedSeats > 0)
    if (availabilityRatio < 0.10 && accessibilityWaste > 0 && wastedSeats > 0) {
      score -= accessibilityWaste * 15; // Reduced penalty, only for wasteful use
      console.log('[CapacityScore] Accessibility penalty applied:', {
        availabilityRatio: availabilityRatio.toFixed(2),
        accessibilityWaste,
        penalty: accessibilityWaste * 15
      });
    }
    
    // 6. BONUS: Perfect fit (zero waste)
    if (wastedSeats === 0) {
      score += 50;
    }
    
    // 7. Check if this uses ALL standalone tables vs group tables
    const allStandalone = assignedTables.every(tn => {
      return !tableGroups?.some(g => g.table_numbers.includes(tn));
    });
    
    const isGroup = assignedTables.length > 1 && 
      tableGroups?.some(g => g.table_numbers.some(tn => assignedTables.includes(tn)));
    
    // 8. HUGE BONUS for standalone tables (prefer single tables not in groups)
    if (allStandalone && assignedTables.length === 1) {
      score += 500; // VERY strong preference for standalone single tables - always beats group tables
    } else if (allStandalone) {
      score += 75; // Moderate bonus for multiple standalone tables
    }
    
    // 9. PENALTY for using table groups (requires staff to push tables)
    if (isGroup) {
      score -= 200; // Strong penalty for table groups - prefer standalone tables
    }
    
    // 10. TIME-BASED RISK ADJUSTMENT (passed in from caller)
    score += timeBasedRiskAdjustment;
    
    console.log('[CapacityScore] Assignment analysis:', {
      tables: assignedTables,
      allStandalone,
      isGroup,
      timeRiskAdj: timeBasedRiskAdjustment,
      finalScore: score.toFixed(0)
    });
    
    return score;
  }
  
  /**
   * Assess time-based risk of using a table group for an imminent reservation
   */
  private static async assessTableGroupRisk(
    companyId: string,
    reservationDateTime: Date,
    currentDateTime: Date,
    tableGroup: TableGroupWithTables,
    allTables: Table[],
    availableTables: number[]
  ): Promise<{
    riskLevel: 'safe' | 'low' | 'moderate' | 'high';
    reasoning: string;
    allowUsage: boolean;
    minutesUntilReservation: number;
    largePartyProbability: number;
  }> {
    // Calculate time gap
    const minutesUntilReservation = Math.floor(
      (reservationDateTime.getTime() - currentDateTime.getTime()) / 60000
    );
    
    // Get company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('imminent_booking_threshold_minutes, short_term_horizon_minutes, large_party_lead_time_threshold_minutes, enable_time_based_group_protection')
      .eq('id', companyId)
      .single();
    
    if (!settings?.enable_time_based_group_protection) {
      return {
        riskLevel: 'high',
        reasoning: 'Time-based protection disabled',
        allowUsage: false,
        minutesUntilReservation,
        largePartyProbability: 0
      };
    }
    
    const imminentThreshold = settings.imminent_booking_threshold_minutes || 150; // 2.5 hours
    const shortTermThreshold = settings.short_term_horizon_minutes || 120;
    const largePartyLeadTime = settings.large_party_lead_time_threshold_minutes || 240;
    
    // Check historical lead times for large parties
    const { data: historicalData } = await supabase
      .from('reservations')
      .select('created_at, date, time, party_size')
      .eq('company_id', companyId)
      .gte('party_size', tableGroup.total_capacity * 0.6) // Large parties for this group
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 90 days
      .limit(50);
    
    let avgLeadTimeMinutes = largePartyLeadTime;
    if (historicalData && historicalData.length > 0) {
      const leadTimes = historicalData
        .map(r => {
          const reservationTime = new Date(`${r.date}T${r.time}`).getTime();
          const createdTime = new Date(r.created_at).getTime();
          return (reservationTime - createdTime) / 60000;
        })
        .filter(lt => lt > 0 && lt < 10000); // Filter out invalid data
      
      if (leadTimes.length > 0) {
        avgLeadTimeMinutes = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
      }
    }
    
    // Calculate timeline density
    const { data: existingReservations } = await supabase
      .from('reservations')
      .select('table_number, table_numbers')
      .eq('company_id', companyId)
      .eq('date', reservationDateTime.toISOString().split('T')[0])
      .not('status', 'in', '(cancelled,no-show,completed,table-complete)');
    
    const occupiedTables = new Set<number>();
    existingReservations?.forEach((res: any) => {
      if (res.table_numbers) {
        res.table_numbers.forEach((tn: number) => occupiedTables.add(tn));
      } else if (res.table_number) {
        occupiedTables.add(res.table_number);
      }
    });
    
    const timelineFillPercent = (occupiedTables.size / allTables.length) * 100;
    
    // Decision logic
    if (minutesUntilReservation < imminentThreshold) {
      // IMMINENT: Very safe to use
      return {
        riskLevel: 'safe',
        reasoning: `Imminent booking (${minutesUntilReservation}min). Large parties typically book ${Math.round(avgLeadTimeMinutes)}min ahead`,
        allowUsage: true,
        minutesUntilReservation,
        largePartyProbability: 0.05
      };
    }
    
    if (minutesUntilReservation < shortTermThreshold) {
      // SHORT-TERM: Check historical patterns
      if (avgLeadTimeMinutes > shortTermThreshold && timelineFillPercent < 70) {
        return {
          riskLevel: 'low',
          reasoning: `Short-term booking (${minutesUntilReservation}min). Average lead time ${Math.round(avgLeadTimeMinutes)}min, timeline ${timelineFillPercent.toFixed(0)}% full`,
          allowUsage: true,
          minutesUntilReservation,
          largePartyProbability: 0.2
        };
      }
      
      return {
        riskLevel: 'moderate',
        reasoning: `Short-term (${minutesUntilReservation}min) but timeline is ${timelineFillPercent.toFixed(0)}% full`,
        allowUsage: false,
        minutesUntilReservation,
        largePartyProbability: 0.4
      };
    }
    
    // LONG-TERM: Full protection if not heavily booked
    if (timelineFillPercent > 90) {
      return {
        riskLevel: 'low',
        reasoning: `Timeline ${timelineFillPercent.toFixed(0)}% full - saving groups is pointless`,
        allowUsage: true,
        minutesUntilReservation,
        largePartyProbability: 0.1
      };
    }
    
    return {
      riskLevel: 'high',
      reasoning: `Long-term booking (${minutesUntilReservation}min), protect for large parties`,
      allowUsage: false,
      minutesUntilReservation,
      largePartyProbability: 0.6
    };
  }
  
  /**
   * Check if a reservation is locked (permanent or temporary)
   * @param reservation - The reservation to check
   * @param isAutomated - Whether this is an automated optimization (true) or manual user action (false)
   */
  static isReservationLocked(reservation: Reservation | null, isAutomated: boolean): { locked: boolean; reason?: string } {
    if (!reservation) return { locked: false };

    // Check permanent lock
    if (reservation.is_locked) {
      return { locked: true, reason: 'Reservation has a permanent user lock' };
    }

    // Temporary lock only applies to AUTOMATED operations
    if (isAutomated && reservation.last_manual_move_time) {
      const lastMoveTime = new Date(reservation.last_manual_move_time).getTime();
      const currentTime = Date.now();
      const timeSinceMove = currentTime - lastMoveTime;

      if (timeSinceMove < TEMPORARY_LOCK_DURATION_MS) {
        const remainingMs = TEMPORARY_LOCK_DURATION_MS - timeSinceMove;
        return { 
          locked: true, 
          reason: `Reservation has a temporary lock (${Math.ceil(remainingMs / 1000)}s remaining)` 
        };
      }
    }

    return { locked: false };
  }

  /**
   * Find the optimal table assignment following strict prioritization rules
   * @param companyId - Company ID
   * @param partySize - Number of guests
   * @param date - Reservation date
   * @param time - Reservation time
   * @param excludeReservationId - Reservation ID to exclude from conflict checks (for edits)
   * @param existingReservation - Existing reservation (for lock checks)
   * @param isAutomated - Whether this is automated optimization
   * @param notes - Reservation notes (for accessibility detection)
   * @param preferredAnchorTable - Preferred table to include in assignment (user drop intent)
   */
  static async findOptimalAssignment(
    companyId: string,
    partySize: number,
    date: string,
    time: string,
    excludeReservationId?: string,
    existingReservation?: Reservation | null,
    isAutomated: boolean = false,
    notes?: string,
    preferredAnchorTable?: number
  ): Promise<OptimizationResult> {
    // Calculate days ahead for strategic optimization
    const daysAhead = this.getDaysAhead(date);
    console.log(`[UniversalOptimization] Days ahead: ${daysAhead} (date: ${date})`);
    // Check if reservation is locked
    if (existingReservation) {
      const lockCheck = this.isReservationLocked(existingReservation, isAutomated);
      if (lockCheck.locked) {
        return {
          success: false,
          tables: [],
          reason: lockCheck.reason || 'Reservation is locked',
          strategy: 'failed',
          wastedSeats: 0,
          totalSeats: 0,
          locked: true,
          error: lockCheck.reason
        };
      }
    }

    // Fetch all operational tables
    const { data: rawTables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or('service_status.is.null,service_status.eq.available')
      .order('table_number');

    if (tablesError || !rawTables) {
      return {
        success: false,
        tables: [],
        reason: 'Failed to fetch tables',
        strategy: 'failed',
        wastedSeats: 0,
        totalSeats: 0,
        error: tablesError?.message
      };
    }

    const tables = rawTables as Table[];

    // Fetch table groups with their members (using correct schema)
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
            table_number
          )
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('group_name');

    const groups: TableGroupWithTables[] = (tableGroupsData || []).map((g: any) => {
      const memberships = g.table_group_memberships || [];
      const tableNumbers = memberships
        .sort((a: any, b: any) => (a.priority_order || 0) - (b.priority_order || 0))
        .map((m: any) => m.tables?.table_number)
        .filter((tn: number | undefined) => tn !== undefined);

      return {
        id: g.id,
        group_name: g.group_name,
        is_active: g.is_active,
        table_numbers: tableNumbers,
        total_capacity: tableNumbers.reduce((sum: number, tn: number) => {
          const table = tables.find(t => t.table_number === tn);
          return sum + (table?.seats || 0);
        }, 0)
      };
    });

    console.log('[UniversalOptimization] Fetched table groups:', groups.map(g => ({
      name: g.group_name,
      tables: g.table_numbers,
      capacity: g.total_capacity
    })));

    // Analyze accessibility needs from notes
    const accessibilityNeeds = notes ? analyzeAccessibilityNotes(notes) : { needsAccessible: false, avoidHighTop: false, confidence: 'none' as const, reasons: [] };
    console.log('🔍 Accessibility analysis:', accessibilityNeeds);

    // Get available tables (check conflicts)
    let availableTables = await this.getAvailableTables(tables, companyId, date, time, excludeReservationId);
    console.log('[UniversalOptimization] Available tables for company', companyId, ':', availableTables);
    
    // Filter tables based on accessibility requirements
    if (accessibilityNeeds.needsAccessible) {
      const hasAccessibleTable = tables.some(t => 
        availableTables.includes(t.table_number) && t.accessibility_friendly === true
      );
      
      if (!hasAccessibleTable) {
        return {
          success: false,
          tables: [],
          reason: 'No accessible tables available for this time slot',
          strategy: 'failed',
          wastedSeats: 0,
          totalSeats: 0,
          error: 'Accessibility requirement not met'
        };
      }
    }
    
    if (accessibilityNeeds.avoidHighTop) {
      const nonHighTopTables = tables.filter(t => 
        availableTables.includes(t.table_number) && !t.is_high_top
      );
      availableTables = nonHighTopTables.map(t => t.table_number);
      
      if (availableTables.length === 0) {
        return {
          success: false,
          tables: [],
          reason: 'No standard-height tables available (high-tops avoided per notes)',
          strategy: 'failed',
          wastedSeats: 0,
          totalSeats: 0,
          error: 'High-top avoidance requirement not met'
        };
      }
    }
    
    // Helper: validate accessibility for assignment
    const validateAccessibility = (tableNumbers: number[]): boolean => {
      if (!accessibilityNeeds.needsAccessible) return true;
      // For multi-table: at least ONE must be accessible
      return tableNumbers.some(tn => {
        const table = tables.find(t => t.table_number === tn);
        return table?.accessibility_friendly === true;
      });
    };

    // STEP A: Single Individual Tables (with capacity scoring + days ahead + time-based risk)
    const stepAResult = await this.tryStepA_SingleIndividualTables(
      partySize,
      tables,
      availableTables,
      groups,
      daysAhead,
      preferredAnchorTable,
      companyId,
      date,
      time
    );

    if (stepAResult.success && validateAccessibility(stepAResult.tables)) {
      return stepAResult;
    } else if (stepAResult.success && !validateAccessibility(stepAResult.tables)) {
      console.log('⚠️ Step A found tables but not accessible:', stepAResult.tables);
    }

    // STEP B: Partial Table Groups (with capacity scoring + days ahead)
    const stepBResult = await this.tryStepB_PartialGroups(
      partySize,
      tables,
      availableTables,
      groups,
      daysAhead,
      preferredAnchorTable
    );

    if (stepBResult.success && validateAccessibility(stepBResult.tables)) {
      return stepBResult;
    } else if (stepBResult.success && !validateAccessibility(stepBResult.tables)) {
      console.log('⚠️ Step B found tables but not accessible:', stepBResult.tables);
    }

    // STEP C: Full Table Groups
    const stepCResult = await this.tryStepC_FullGroups(
      partySize,
      tables,
      availableTables,
      groups
    );

    if (stepCResult.success && validateAccessibility(stepCResult.tables)) {
      return stepCResult;
    } else if (stepCResult.success && !validateAccessibility(stepCResult.tables)) {
      console.log('⚠️ Step C found tables but not accessible:', stepCResult.tables);
    }

    // No suitable assignment found
    const reason = accessibilityNeeds.needsAccessible 
      ? `No accessible table configuration found for ${partySize} guests`
      : `No suitable table configuration found for ${partySize} guests`;
      
    return {
      success: false,
      tables: [],
      reason,
      strategy: 'failed',
      wastedSeats: 0,
      totalSeats: 0
    };
  }

  /**
   * STEP A: Single Individual Tables
   * Priority: Non-group tables first, but can use group table if significantly better
   * ENHANCED: Now includes time-based risk assessment for table groups
   */
  private static async tryStepA_SingleIndividualTables(
    partySize: number,
    allTables: Table[],
    availableTables: number[],
    groups: TableGroupWithTables[],
    daysAhead: number = 0,
    preferredAnchorTable?: number,
    companyId?: string,
    date?: string,
    time?: string
  ): Promise<OptimizationResult> {
    // Identify which tables are in groups
    const tablesInGroups = new Set<number>();
    groups.forEach(group => {
      group.table_numbers.forEach(tn => tablesInGroups.add(tn));
    });

    console.log('[StepA] Starting single table search:', {
      partySize,
      totalTables: allTables.length,
      availableTables: availableTables.length,
      tablesInGroups: Array.from(tablesInGroups).map(t => `T${t}`).join(', '),
      preferredAnchor: preferredAnchorTable ? `T${preferredAnchorTable}` : 'none'
    });

    // Find non-group tables that fit
    const nonGroupTablesPreSort = allTables.filter(t => {
      const inGroup = tablesInGroups.has(t.table_number);
      const isAvailable = availableTables.includes(t.table_number);
      const fitsParty = t.seats >= partySize;
      const passes = !inGroup && isAvailable && fitsParty;
      
      // Log status for 2-seater tables
      if (t.seats === 2) {
        console.log(`[StepA] 2-seater T${t.table_number}:`, {
          seats: t.seats,
          inGroup,
          isAvailable,
          fitsParty,
          accessible: t.accessibility_friendly,
          passes
        });
      }
      
      return passes;
    });

    console.log('[StepA] Non-group tables before sorting:', 
      nonGroupTablesPreSort.map(t => `T${t.table_number}(${t.seats}s,waste=${t.seats - partySize})`).join(', ')
    );

    const nonGroupTables = nonGroupTablesPreSort.sort((a, b) => {
      // Boost score if this is the preferred anchor table
      if (preferredAnchorTable) {
        if (a.table_number === preferredAnchorTable) return -1;
        if (b.table_number === preferredAnchorTable) return 1;
      }
      // Priority 1: Minimize wasted seats
      const wasteA = a.seats - partySize;
      const wasteB = b.seats - partySize;
      if (wasteA !== wasteB) return wasteA - wasteB;
      // Tie-breaker: Smaller table
      return a.seats - b.seats;
    });

    console.log('[StepA] Non-group tables after sorting:', 
      nonGroupTables.map(t => `T${t.table_number}(${t.seats}s,waste=${t.seats - partySize})`).join(', ')
    );

    const bestNonGroupTable = nonGroupTables[0];

    console.log('[StepA] Best non-group table:', bestNonGroupTable ? {
      table: `T${bestNonGroupTable.table_number}`,
      seats: bestNonGroupTable.seats,
      waste: bestNonGroupTable.seats - partySize,
      accessible: bestNonGroupTable.accessibility_friendly
    } : '❌ NONE FOUND');

    // Find best single group table that fits
    const groupTables = allTables
      .filter(t => 
        tablesInGroups.has(t.table_number) &&
        availableTables.includes(t.table_number) &&
        t.seats >= partySize
      )
      .sort((a, b) => {
        const wasteA = a.seats - partySize;
        const wasteB = b.seats - partySize;
        if (wasteA !== wasteB) return wasteA - wasteB;
        return a.seats - b.seats;
      });

    const bestGroupTable = groupTables[0];

    // Decision logic: Use capacity scoring with time-based risk assessment
    if (bestNonGroupTable) {
      const nonGroupWaste = bestNonGroupTable.seats - partySize;
      const nonGroupScore = this.calculateCapacityScore(
        [bestNonGroupTable.table_number],
        bestNonGroupTable.seats,
        nonGroupWaste,
        partySize,
        allTables,
        availableTables,
        daysAhead,
        groups,
        0 // No time-based adjustment for standalone tables
      );
      
      console.log('[StepA] Non-group table score:', {
        table: `T${bestNonGroupTable.table_number}`,
        seats: bestNonGroupTable.seats,
        waste: nonGroupWaste,
        score: nonGroupScore.toFixed(0)
      });
      
      // Compare with group table if available
      if (bestGroupTable && companyId && date && time) {
        // Find which group this table belongs to
        const tableGroup = groups.find(g => g.table_numbers.includes(bestGroupTable.table_number));
        
        if (tableGroup) {
          // Perform time-based risk assessment
          const reservationDateTime = new Date(`${date}T${time}`);
          const currentDateTime = new Date();
          
          const riskAssessment = await this.assessTableGroupRisk(
            companyId,
            reservationDateTime,
            currentDateTime,
            tableGroup,
            allTables,
            availableTables
          );
          
          // Calculate time-based adjustment
          let timeBasedAdjustment = 0;
          switch (riskAssessment.riskLevel) {
            case 'safe':
              timeBasedAdjustment = 100; // Within 2.5 hours - safe to use group tables
              break;
            case 'low':
              timeBasedAdjustment = 30; // Low risk
              break;
            case 'moderate':
              timeBasedAdjustment = -50; // Some protection needed
              break;
            case 'high':
              timeBasedAdjustment = -200; // Strong protection - save for large parties
              break;
          }
          
          const groupWaste = bestGroupTable.seats - partySize;
          const groupScore = this.calculateCapacityScore(
            [bestGroupTable.table_number],
            bestGroupTable.seats,
            groupWaste,
            partySize,
            allTables,
            availableTables,
            daysAhead,
            groups,
            timeBasedAdjustment
          );
          
          console.log('[StepA] Time-based risk comparison:', {
            nonGroupTable: bestNonGroupTable.table_number,
            nonGroupScore,
            groupTable: bestGroupTable.table_number,
            groupScore,
            riskLevel: riskAssessment.riskLevel,
            minutesUntil: riskAssessment.minutesUntilReservation,
            reasoning: riskAssessment.reasoning
          });
          
          // Use whichever has better capacity score (now includes time-based risk)
          if (groupScore > nonGroupScore) {
            const groupName = this.findGroupNameForTable(bestGroupTable.table_number, groups);
            return {
              success: true,
              tables: [bestGroupTable.table_number],
              reason: `Single table from ${groupName} group (${bestGroupTable.seats} seats) - ${riskAssessment.reasoning} (score: ${groupScore.toFixed(0)})`,
              strategy: 'single_group_table',
              wastedSeats: groupWaste,
              totalSeats: bestGroupTable.seats,
              groupName,
              capacityScore: groupScore
            };
          }
        }
      } else if (bestGroupTable) {
        // Fallback: no time-based assessment available
        const groupWaste = bestGroupTable.seats - partySize;
        const groupScore = this.calculateCapacityScore(
          [bestGroupTable.table_number],
          bestGroupTable.seats,
          groupWaste,
          partySize,
          allTables,
          availableTables,
          daysAhead,
          groups,
          -100 // Default group penalty
        );
        
        if (groupScore > nonGroupScore) {
          const groupName = this.findGroupNameForTable(bestGroupTable.table_number, groups);
          return {
            success: true,
            tables: [bestGroupTable.table_number],
            reason: `Single table from ${groupName} group (${bestGroupTable.seats} seats) - better for global capacity (score: ${groupScore.toFixed(0)})`,
            strategy: 'single_group_table',
            wastedSeats: groupWaste,
            totalSeats: bestGroupTable.seats,
            groupName,
            capacityScore: groupScore
          };
        }
      }

      // Use non-group table
      console.log('[StepA] ✅ SELECTED non-group table:', {
        table: `T${bestNonGroupTable.table_number}`,
        seats: bestNonGroupTable.seats,
        waste: nonGroupWaste,
        score: nonGroupScore.toFixed(0),
        reason: 'Best available individual table'
      });
      
      return {
        success: true,
        tables: [bestNonGroupTable.table_number],
        reason: `Single individual table (${bestNonGroupTable.seats} seats) - optimal capacity (score: ${nonGroupScore.toFixed(0)}, ${daysAhead}d ahead)`,
        strategy: 'single_individual',
        wastedSeats: nonGroupWaste,
        totalSeats: bestNonGroupTable.seats,
        capacityScore: nonGroupScore
      };
    }

    // Only group tables available
    if (bestGroupTable) {
      const groupWaste = bestGroupTable.seats - partySize;
      const groupScore = this.calculateCapacityScore(
        [bestGroupTable.table_number],
        bestGroupTable.seats,
        groupWaste,
        partySize,
        allTables,
        availableTables,
        daysAhead,
        groups
      );
      const groupName = this.findGroupNameForTable(bestGroupTable.table_number, groups);
      return {
        success: true,
        tables: [bestGroupTable.table_number],
        reason: `Single table from ${groupName} group (${bestGroupTable.seats} seats) - no suitable non-group tables (score: ${groupScore.toFixed(0)})`,
        strategy: 'single_group_table',
        wastedSeats: groupWaste,
        totalSeats: bestGroupTable.seats,
        groupName,
        capacityScore: groupScore
      };
    }

    return {
      success: false,
      tables: [],
      reason: 'No single table found',
      strategy: 'failed',
      wastedSeats: 0,
      totalSeats: 0
    };
  }

  /**
   * STEP B: Partial Table Groups (Consecutive tables only)
   */
  private static async tryStepB_PartialGroups(
    partySize: number,
    allTables: Table[],
    availableTables: number[],
    groups: TableGroupWithTables[],
    daysAhead: number = 0,
    preferredAnchorTable?: number
  ): Promise<OptimizationResult> {
    const tableMap = new Map(allTables.map(t => [t.table_number, t]));
    let bestOption: OptimizationResult | null = null;

    // If anchor table specified, prioritize groups containing it
    const groupsWithAnchor: typeof groups = [];
    const groupsWithoutAnchor: typeof groups = [];

    if (preferredAnchorTable) {
      for (const group of groups) {
        if (group.table_numbers.includes(preferredAnchorTable)) {
          groupsWithAnchor.push(group);
        } else {
          groupsWithoutAnchor.push(group);
        }
      }
      console.log('🎯 STEP B: Anchor-aware group prioritization', {
        anchor: preferredAnchorTable,
        groupsWithAnchor: groupsWithAnchor.map(g => g.group_name),
        groupsWithoutAnchor: groupsWithoutAnchor.map(g => g.group_name)
      });
    }

    // Process groups with anchor first, then others
    const orderedGroups = preferredAnchorTable 
      ? [...groupsWithAnchor, ...groupsWithoutAnchor]
      : groups;

    for (const group of orderedGroups) {
      // Try all consecutive combinations
      for (let start = 0; start < group.table_numbers.length; start++) {
        for (let end = start + 1; end <= group.table_numbers.length; end++) {
          const consecutiveTables = group.table_numbers.slice(start, end);
          
          // Check if all tables are available
          const allAvailable = consecutiveTables.every(tn => availableTables.includes(tn));
          if (!allAvailable) continue;

          // Calculate total capacity
          const totalSeats = consecutiveTables.reduce((sum, tn) => {
            const table = tableMap.get(tn);
            return sum + (table?.seats || 0);
          }, 0);

          if (totalSeats < partySize) continue;

          // Validate consecutive combination
          const validation = isValidTableCombination(consecutiveTables, groups as any);
          if (!validation.valid) {
            continue; // Skip invalid combinations
          }

          const wastedSeats = totalSeats - partySize;
          const numTables = consecutiveTables.length;

          // Calculate capacity score for this combination
          let currentScore = this.calculateCapacityScore(
            consecutiveTables,
            totalSeats,
            wastedSeats,
            partySize,
            allTables,
            availableTables,
            daysAhead,
            groups
          );

          // Bonus for combinations that include the preferred anchor table
          const includesAnchor = preferredAnchorTable 
            ? consecutiveTables.includes(preferredAnchorTable)
            : false;
          
          if (includesAnchor) {
            currentScore += 200; // Significant bonus for respecting user's drop intent
            console.log('✅ Anchor bonus applied', {
              tables: consecutiveTables,
              anchor: preferredAnchorTable,
              scoreWithBonus: currentScore
            });
          }

          const bestScore = bestOption?.capacityScore ?? -Infinity;

          // Use capacity scoring to determine best option
          if (currentScore > bestScore) {
            bestOption = {
              success: true,
              tables: consecutiveTables,
              reason: `Partial group ${group.group_name} (${numTables} tables, ${totalSeats} seats)${includesAnchor ? ' [includes anchor]' : ''} - optimal capacity (score: ${currentScore.toFixed(0)})`,
              strategy: 'partial_group',
              wastedSeats,
              totalSeats,
              groupName: group.group_name,
              capacityScore: currentScore
            };
          }
        }
      }
    }

    return bestOption || {
      success: false,
      tables: [],
      reason: 'No suitable partial group found',
      strategy: 'failed',
      wastedSeats: 0,
      totalSeats: 0
    };
  }

  /**
   * STEP C: Full Table Groups
   */
  private static async tryStepC_FullGroups(
    partySize: number,
    allTables: Table[],
    availableTables: number[],
    groups: TableGroupWithTables[]
  ): Promise<OptimizationResult> {
    const tableMap = new Map(allTables.map(t => [t.table_number, t]));

    const suitableGroups = groups
      .map(group => {
        // Validate full group is consecutive
        const validation = isValidTableCombination(group.table_numbers, groups as any);
        if (!validation.valid) return null; // Skip invalid groups

        // Check if all tables in group are available
        const allAvailable = group.table_numbers.every(tn => availableTables.includes(tn));
        if (!allAvailable) return null;

        const totalSeats = group.table_numbers.reduce((sum, tn) => {
          const table = tableMap.get(tn);
          return sum + (table?.seats || 0);
        }, 0);

        if (totalSeats < partySize) return null;

        return {
          group,
          totalSeats,
          wastedSeats: totalSeats - partySize
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Priority: Smallest group that fits
        if (a!.totalSeats !== b!.totalSeats) return a!.totalSeats - b!.totalSeats;
        return a!.wastedSeats - b!.wastedSeats;
      });

    const bestGroup = suitableGroups[0];
    if (bestGroup) {
      return {
        success: true,
        tables: bestGroup.group.table_numbers,
        reason: `Full group ${bestGroup.group.group_name} (${bestGroup.group.table_numbers.length} tables, ${bestGroup.totalSeats} seats)`,
        strategy: 'full_group',
        wastedSeats: bestGroup.wastedSeats,
        totalSeats: bestGroup.totalSeats,
        groupName: bestGroup.group.group_name
      };
    }

    return {
      success: false,
      tables: [],
      reason: 'No suitable full group found',
      strategy: 'failed',
      wastedSeats: 0,
      totalSeats: 0
    };
  }

  /**
   * Get available tables by checking conflicts AND service status
   */
  private static async getAvailableTables(
    tables: Table[],
    companyId: string,
    date: string,
    time: string,
    excludeReservationId?: string
  ): Promise<number[]> {
    console.log('[getAvailableTables] Starting availability check:', {
      date,
      time,
      totalTables: tables.length,
      excludeReservationId
    });

    // Filter out tables that are not in service
    const operationalTables = tables.filter(t => {
      const isAvailable = t.is_active && 
        (!t.service_status || t.service_status === 'available');
      
      if (!isAvailable) {
        console.log('[getAvailableTables] ❌ Table excluded (not operational):', {
          table_number: t.table_number,
          is_active: t.is_active,
          service_status: t.service_status
        });
      }
      
      return isAvailable;
    });

    console.log('[getAvailableTables] Operational tables:', {
      count: operationalTables.length,
      tables: operationalTables.map(t => `T${t.table_number}(${t.seats})`).join(', ')
    });

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, table_number, table_numbers, time')
      .eq('company_id', companyId)
      .eq('date', date)
      .not('status', 'in', '(cancelled,no-show,completed,table-complete)');

    console.log('[getAvailableTables] Same-day reservations:', {
      count: reservations?.length || 0
    });

    if (!reservations) return operationalTables.map(t => t.table_number);

    const conflictingTables = new Set<number>();
    const reqTimeMinutes = this.timeToMinutes(time);
    const reqStart = reqTimeMinutes;
    const reqEnd = reqTimeMinutes + 120; // 2-hour window

    reservations.forEach((res: any) => {
      if (excludeReservationId && res.id === excludeReservationId) {
        return;
      }

      // PROPER 2-hour overlap check: (start1 < end2) AND (end1 > start2)
      const resTimeMinutes = this.timeToMinutes(res.time);
      const resStart = resTimeMinutes;
      const resEnd = resTimeMinutes + 120;
      
      const overlap = (reqStart < resEnd) && (reqEnd > resStart);

      if (overlap) {
        const affectedTables: number[] = [];
        if (res.table_numbers) {
          affectedTables.push(...res.table_numbers);
          res.table_numbers.forEach((tn: number) => conflictingTables.add(tn));
        } else if (res.table_number) {
          affectedTables.push(res.table_number);
          conflictingTables.add(res.table_number);
        }
        
        console.log('[getAvailableTables] ⚠️ Conflict detected:', {
          reservation_id: res.id.substring(0, 8),
          res_time: res.time,
          affected_tables: affectedTables.map(t => `T${t}`).join(', '),
          overlap_reason: `Req[${reqStart}-${reqEnd}] overlaps Res[${resStart}-${resEnd}]`
        });
      }
    });

    const availableTables = operationalTables
      .map(t => t.table_number)
      .filter(tn => !conflictingTables.has(tn));

    // Explicitly check T19, T23, T24 status
    const twoSeaterTables = [19, 23, 24];
    const twoSeaterStatus = twoSeaterTables.map(tn => {
      const table = tables.find(t => t.table_number === tn);
      const isOperational = operationalTables.some(t => t.table_number === tn);
      const hasConflict = conflictingTables.has(tn);
      const isAvailable = availableTables.includes(tn);
      
      return {
        table: `T${tn}`,
        seats: table?.seats || 0,
        operational: isOperational,
        conflict: hasConflict,
        available: isAvailable
      };
    });

    console.log('[getAvailableTables] 🎯 2-seater status (T19/T23/T24):', twoSeaterStatus);
    console.log('[getAvailableTables] ✅ Final available tables:', {
      count: availableTables.length,
      tables: availableTables.map(t => `T${t}`).join(', ')
    });

    return availableTables;
  }

  /**
   * Helper: Convert time string to minutes
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Helper: Find group name for a table
   */
  private static findGroupNameForTable(tableNumber: number, groups: TableGroupWithTables[]): string {
    const group = groups.find(g => g.table_numbers.includes(tableNumber));
    return group?.group_name || 'Unknown Group';
  }

  /**
   * Update reservation's manual move timestamp (for temporary lock)
   */
  static async updateManualMoveTimestamp(reservationId: string): Promise<void> {
    await supabase
      .from('reservations')
      .update({ last_manual_move_time: new Date().toISOString() })
      .eq('id', reservationId);
  }

  /**
   * Toggle permanent lock on reservation
   */
  static async togglePermanentLock(reservationId: string, locked: boolean): Promise<void> {
    await supabase
      .from('reservations')
      .update({ is_locked: locked })
      .eq('id', reservationId);
  }
}
