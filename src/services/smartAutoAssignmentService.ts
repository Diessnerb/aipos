import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReservationConflictService } from './reservationConflictService';
import { AssignmentRulesEngine, RuleEvaluationContext } from './assignmentRulesEngine';
import { ReservationAnalyticsService } from './reservationAnalyticsService';
import { VisualCapacityService } from './visualCapacityService';
import { CapacityLogicService } from './capacityLogicService';
import { Table, TableGroupWithTables, AdvancedGroupSettings } from '@/types/table';
import { Reservation } from '@/types/reservation';

export interface AutoAssignmentResult {
  success: boolean;
  assignedTable?: number;
  assignedTables?: number[];
  tableSeats?: number;
  accessibilityFriendly?: boolean;
  alternativeTimes?: string[];
  message?: string;
  conflictsDetected?: boolean;
  conflictResolution?: string;
  assignmentStrategy?: 'single' | 'multi-table' | 'accessibility' | 'capacity-match' | 'rules_engine' | 'visual-efficiency';
  appliedRules?: string[];
  efficiencyScore?: number;
  visualCapacityUsed?: boolean;
}

interface ContiguousSelectionResult {
  is_contiguous: boolean;
  reason: string;
  selected_tables: number[];
  total_capacity: number;
}

/**
 * Simplified Smart Auto-Assignment Service
 * Logic: Try single tables, then groups, then optimization
 */
export class SmartAutoAssignmentService {
  /**
   * Simple auto-assignment: try single tables, then groups, then optimization
   */
  static async assignBestTable(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string
  ): Promise<AutoAssignmentResult> {
    try {
      console.log(`🚀 [SIMPLE-ASSIGN] Starting assignment for party of ${partySize} on ${date} at ${time}`);

      // Get available tables
      const availableTables = await this.getAvailableTables(companyId);
      if (!availableTables.length) {
        return {
          success: false,
          message: 'No tables available for this company',
          conflictsDetected: false
        };
      }

      // Analyze accessibility needs
      const { analyzeAccessibilityNotes } = await import('../utils/accessibilityDetection');
      const accessibilityAnalysis = analyzeAccessibilityNotes(notes || '');
      
      console.log(`♿ [SIMPLE-ASSIGN] Accessibility needed: ${accessibilityAnalysis.needsAccessible}`);

      // STEP 1: Try individual tables first (any single table outside groups or the best single table in groups)
      console.log(`🎯 [SIMPLE-ASSIGN] Step 1: Trying individual table assignment`);
      const singleResult = await this.tryIndividualTableAssignment(
        companyId, date, time, partySize, accessibilityAnalysis.needsAccessible, availableTables
      );
      if (singleResult.success) {
        console.log(`✅ [SIMPLE-ASSIGN] SUCCESS via individual table:`, singleResult);
        return singleResult;
      }

      // STEP 2: Try table groups using max_combined_capacity
      console.log(`👥 [SIMPLE-ASSIGN] Step 2: Trying table group assignment`);
      const groupResult = await this.tryTableGroupAssignment(
        companyId, date, time, partySize, accessibilityAnalysis.needsAccessible
      );
      if (groupResult.success) {
        console.log(`✅ [SIMPLE-ASSIGN] SUCCESS via table groups:`, groupResult);
        return groupResult;
      }

      // STEP 3: Try optimization (move existing reservations to make space)
      console.log(`🔄 [SIMPLE-ASSIGN] Step 3: Trying optimization`);
      const optimizationResult = await this.trySimpleOptimization(
        companyId, date, time, partySize
      );
      if (optimizationResult.success) {
        console.log(`✅ [SIMPLE-ASSIGN] SUCCESS via optimization:`, optimizationResult);
        return optimizationResult;
      }

      console.log(`❌ [SIMPLE-ASSIGN] All assignment methods failed`);
      return {
        success: false,
        message: `No suitable tables available even with optimization`,
        conflictsDetected: true
      };

    } catch (error) {
      console.error('❌ [SIMPLE-ASSIGN] Auto-assignment error:', error);
      return { 
        success: false, 
        message: 'Unable to auto-assign table. Please try again.',
        conflictsDetected: true
      };
    }
  }

  /**
   * Try individual table assignment - prioritize standalone tables outside groups
   */
  private static async tryIndividualTableAssignment(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    accessibilityNeeded: boolean,
    availableTables: any[]
  ): Promise<AutoAssignmentResult> {
    console.log(`🎯 [INDIVIDUAL] Looking for individual table for ${partySize} people (accessibility: ${accessibilityNeeded})`);
    
    // Get table group information to identify which tables are NOT in groups
    const { data: membershipData } = await supabase
      .from('table_group_memberships')
      .select(`
        table_id,
        tables!inner(table_number, company_id)
      `)
      .eq('tables.company_id', companyId);

    const tablesInGroups = new Set<number>();
    if (membershipData) {
      membershipData.forEach((membership: any) => {
        if (membership.tables?.table_number) {
          tablesInGroups.add(membership.tables.table_number);
        }
      });
    }

    // Filter tables that can fit the party
    const suitableTables = availableTables.filter(table => {
      const canFit = table.seats >= partySize;
      const isAccessible = !accessibilityNeeded || table.accessibility_friendly;
      return canFit && isAccessible;
    });

    if (suitableTables.length === 0) {
      console.log(`❌ [INDIVIDUAL] No tables can fit party of ${partySize}`);
      return { success: false, message: 'No individual table can accommodate this party size' };
    }

    // Prioritize tables NOT in groups, then tables in groups
    const standaloneOnlyTables = suitableTables.filter(table => !tablesInGroups.has(table.table_number));
    const tablesInGroupsList = suitableTables.filter(table => tablesInGroups.has(table.table_number));

    // Sort by efficiency (smallest table that fits)
    const tablesToCheck = [
      ...standaloneOnlyTables.sort((a, b) => a.seats - b.seats),
      ...tablesInGroupsList.sort((a, b) => a.seats - b.seats)
    ];

    console.log(`🎯 [INDIVIDUAL] Found ${standaloneOnlyTables.length} standalone + ${tablesInGroupsList.length} group tables`);

    // Check availability for each table
    const existingReservations = await this.getExistingReservations(companyId, date);
    
    for (const table of tablesToCheck) {
      const isAvailable = this.checkSingleTableAvailability(
        table.table_number, date, time, existingReservations
      );
      
      if (isAvailable) {
        const isStandalone = !tablesInGroups.has(table.table_number);
        console.log(`✅ [INDIVIDUAL] Found available ${isStandalone ? 'standalone' : 'grouped'} table T${table.table_number} (${table.seats} seats)`);
        return {
          success: true,
          assignedTable: table.table_number,
          assignedTables: [table.table_number],
          tableSeats: table.seats,
          assignmentStrategy: 'single',
          accessibilityFriendly: table.accessibility_friendly,
          message: `Assigned to ${isStandalone ? 'standalone' : 'individual'} table ${table.table_number} (${table.seats} seats)`
        };
      }
    }

    console.log(`❌ [INDIVIDUAL] All suitable tables are occupied`);
    return { success: false, message: 'All suitable individual tables are occupied' };
  }

  /**
   * Table group assignment - evaluates ALL contiguous combinations across ALL groups for optimal efficiency
   */
  private static async tryTableGroupAssignment(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    accessibilityNeeded: boolean
  ): Promise<AutoAssignmentResult> {
    console.log(`👥 [TABLE-GROUP] Looking for OPTIMAL table combination for ${partySize} people`);
    
    try {
      // Get table groups using the existing RPC
      const { data: groupsData, error } = await supabase
        .rpc('get_table_groups_with_tables', { p_company_id: companyId });

      if (error) {
        console.error('❌ [TABLE-GROUP] Error getting table groups:', error);
        return { success: false, message: 'Error checking table group availability' };
      }

      if (!groupsData || groupsData.length === 0) {
        console.log('❌ [TABLE-GROUP] No table groups found');
        return { success: false, message: 'No table groups available' };
      }

      // Get all tables with their seat counts
      const { data: allTablesData } = await supabase
        .from('tables')
        .select('table_number, seats')
        .eq('company_id', companyId)
        .eq('is_active', true);

      const availableTables = allTablesData || [];

      // Use the global optimization function from tableGroupUtils
      const { findGlobalOptimalAssignment } = await import('../utils/tableGroupUtils');
      const optimalResult = findGlobalOptimalAssignment(
        partySize,
        groupsData,
        availableTables
      );

      if (optimalResult.tables.length === 0) {
        console.log('❌ [TABLE-GROUP] No viable combinations found');
        return { success: false, message: 'No suitable table groups have sufficient capacity' };
      }

      console.log(`🎯 [TABLE-GROUP] Global optimization found: ${optimalResult.groupName} - T${optimalResult.tables.join(',')} (${optimalResult.actualCapacity} seats, ${optimalResult.actualCapacity - partySize} waste)`);

      // Check if the optimal combination is available
      const isAvailable = await this.checkGroupAvailability(
        companyId, date, time, optimalResult.tables
      );
      
      if (isAvailable) {
        const typeLabel = optimalResult.isPartial ? 'PARTIAL' : 'FULL';
        const waste = optimalResult.actualCapacity - partySize;
        console.log(`✅ [TABLE-GROUP] ${typeLabel} assignment to "${optimalResult.groupName}": T${optimalResult.tables.join(',')} (${optimalResult.tables.length} tables, ${optimalResult.actualCapacity} seats, ${waste} waste)`);
        
        return {
          success: true,
          assignedTable: optimalResult.tables[0],
          assignedTables: optimalResult.tables,
          tableSeats: optimalResult.actualCapacity,
          assignmentStrategy: 'multi-table',
          efficiencyScore: Math.round((partySize / optimalResult.actualCapacity) * 100),
          message: `${typeLabel}: "${optimalResult.groupName}" - T${optimalResult.tables.join(',')} (${optimalResult.tables.length} tables, ${optimalResult.actualCapacity} seats, ${waste} waste)`
        };
      }

      // If the optimal combination is not available, try next best options
      // by evaluating all contiguous slices manually
      const allCombinations: Array<{
        groupId: string;
        groupName: string;
        tables: number[];
        totalSeats: number;
        waste: number;
        tableCount: number;
        isPartial: boolean;
        score: number;
      }> = [];

      // Build a seat map for quick lookups
      const seatMap = new Map<number, number>(availableTables.map(t => [t.table_number, t.seats]));

      // Evaluate all contiguous windows from each group
      for (const group of groupsData) {
        const order = group.table_numbers || [];
        if (order.length === 0) continue;

        // Evaluate all contiguous windows
        for (let size = 1; size <= order.length; size++) {
          for (let start = 0; start + size <= order.length; start++) {
            const slice = order.slice(start, start + size);
            const capacity = slice.reduce((sum, tn) => sum + (seatMap.get(tn) ?? 0), 0);
            
            if (capacity >= partySize) {
              const waste = capacity - partySize;
              const score = (slice.length * 100) + waste; // Prioritize fewer tables, then less waste
              
              allCombinations.push({
                groupId: group.group_id,
                groupName: group.group_name,
                tables: slice,
                totalSeats: capacity,
                waste: waste,
                tableCount: slice.length,
                isPartial: slice.length < order.length,
                score: score
              });
              
              console.log(`📊 [COMBO] "${group.group_name}": T${slice.join(',')} = ${capacity} seats, ${waste} waste, score ${score}`);
            }
          }
        }
      }

      if (allCombinations.length === 0) {
        console.log('❌ [TABLE-GROUP] No alternative combinations found');
        return { success: false, message: 'All suitable table combinations are occupied' };
      }

      // Sort by score (lower is better)
      allCombinations.sort((a, b) => a.score - b.score);

      console.log(`🎯 [TABLE-GROUP] Evaluating ${allCombinations.length} alternative combinations`);

      // Try each combination in order of efficiency
      for (const combo of allCombinations) {
        const isAvailable = await this.checkGroupAvailability(
          companyId, date, time, combo.tables
        );
        
        if (isAvailable) {
          const typeLabel = combo.isPartial ? 'PARTIAL' : 'FULL';
          console.log(`✅ [TABLE-GROUP] ${typeLabel} assignment to "${combo.groupName}": T${combo.tables.join(',')} (${combo.tableCount} tables, ${combo.totalSeats} seats, ${combo.waste} waste)`);
          
          return {
            success: true,
            assignedTable: combo.tables[0],
            assignedTables: combo.tables,
            tableSeats: combo.totalSeats,
            assignmentStrategy: 'multi-table',
            efficiencyScore: Math.round(((combo.totalSeats - combo.waste) / combo.totalSeats) * 100),
            message: `${typeLabel}: "${combo.groupName}" - T${combo.tables.join(',')} (${combo.tableCount} tables, ${combo.totalSeats} seats, ${combo.waste} waste)`
          };
        }
      }

      console.log('❌ [TABLE-GROUP] All combinations are occupied');
      return { success: false, message: 'All suitable table combinations are occupied' };

    } catch (error) {
      console.error('❌ [TABLE-GROUP] Error during group assignment:', error);
      return { success: false, message: 'Error during group assignment' };
    }
  }

  /**
   * Try partial group assignment using minimal tables
   */
  private static async tryPartialGroupAssignment(
    groupId: string,
    groupName: string,
    partialAssignment: { tables: any[]; actualCapacity: number; efficiency: number },
    companyId: string,
    date: string,
    time: string,
    partySize: number
  ): Promise<AutoAssignmentResult> {
    console.log(`🎯 [PARTIAL-GROUP] Trying partial assignment for "${groupName}": ${partialAssignment.tables.length} tables, ${partialAssignment.efficiency}% efficiency`);

    const tableNumbers = partialAssignment.tables.map(t => t.table_number);
    
    // Check if the selected partial tables are available
    const isPartialAvailable = await this.checkGroupAvailability(
      companyId, date, time, tableNumbers
    );
    
    if (isPartialAvailable) {
      console.log(`✅ [PARTIAL-GROUP] Partial assignment successful: ${tableNumbers.join(', ')}`);
      
      return {
        success: true,
        assignedTable: tableNumbers[0],
        assignedTables: tableNumbers,
        tableSeats: partialAssignment.actualCapacity,
        assignmentStrategy: 'multi-table',
        efficiencyScore: partialAssignment.efficiency,
        message: `Assigned to partial group "${groupName}" (${tableNumbers.length}/${partialAssignment.tables.length} tables, ${partialAssignment.actualCapacity} seats, ${partialAssignment.efficiency}% efficiency)`
      };
    }

    console.log(`❌ [PARTIAL-GROUP] Partial tables are occupied: ${tableNumbers.join(', ')}`);
    return { success: false, message: 'Partial group tables are occupied' };
  }

  /**
   * Simple optimization - try to move existing reservations to make space
   */
  private static async trySimpleOptimization(
    companyId: string,
    date: string,
    time: string,
    partySize: number
  ): Promise<AutoAssignmentResult> {
    console.log(`🔄 [SIMPLE-OPTIMIZATION] Trying optimization for ${partySize} people`);
    
    try {
      // Check for global optimization hold
      try {
        const win = window as any;
        const localHold = localStorage.getItem('optimization_hold_until');
        const holdUntilMs = Math.max(
          typeof win.__OPTIMIZATION_HOLD_UNTIL === 'number' ? win.__OPTIMIZATION_HOLD_UNTIL : 0,
          localHold ? new Date(localHold).getTime() : 0
        );
        const nowMs = Date.now();
        if (holdUntilMs && nowMs < holdUntilMs) {
          console.log(`⏸️ OPT_HOLD_DEFERRED (AutoAssignment): Hold active`);
          return { success: false, message: 'Optimization blocked due to recent manual changes' };
        }
      } catch {}

      // Call the optimizer
      const { data, error } = await supabase.functions.invoke('continuous-optimizer', {
        body: { 
          companyId, 
          targetDate: date,
          targetTime: time,
          targetPartySize: partySize,
          mode: 'immediate' 
        }
      });

      if (error) {
        console.error('❌ [SIMPLE-OPTIMIZATION] Optimizer error:', error);
        return { success: false, message: 'Optimization service unavailable' };
      }

      if (data?.success && data?.optimized_count > 0) {
        console.log(`✅ [SIMPLE-OPTIMIZATION] Optimized ${data.optimized_count} reservations`);
        
        // Try assignment again after optimization
        const availableTables = await this.getAvailableTables(companyId);
        const singleResult = await this.tryIndividualTableAssignment(
          companyId, date, time, partySize, false, availableTables
        );
        
        if (singleResult.success) {
          return {
            ...singleResult,
            message: `${singleResult.message} (after ${data.optimized_count} optimization moves)`
          };
        }

        // Try groups after optimization
        const groupResult = await this.tryTableGroupAssignment(
          companyId, date, time, partySize, false
        );
        
        if (groupResult.success) {
          return {
            ...groupResult,
            message: `${groupResult.message} (after ${data.optimized_count} optimization moves)`
          };
        }
      }

      console.log(`❌ [SIMPLE-OPTIMIZATION] Optimization could not create suitable assignment`);
      return { success: false, message: 'Optimization could not create suitable assignment' };

    } catch (error) {
      console.error('❌ [SIMPLE-OPTIMIZATION] Error during optimization:', error);
      return { success: false, message: 'Error during optimization' };
    }
  }

  /**
   * Try to select contiguous tables within a group using the database function
   */
  private static async tryContiguousGroupSelection(
    groupId: string,
    partySize: number,
    companyId: string,
    groupName: string
  ): Promise<AutoAssignmentResult> {
    try {
      console.log(`🔗 [CONTIGUOUS] Selecting optimal table combination for party of ${partySize} in "${groupName}"`);
      
      const { data, error } = await supabase.rpc('select_contiguous_group_tables', {
        p_group_id: groupId,
        p_party_size: partySize,
        p_company_id: companyId
      });

      if (error) {
        console.error('❌ [CONTIGUOUS] Database function error:', error);
        return { success: false, message: 'Error selecting contiguous tables' };
      }

      if (!data || data.length === 0) {
        console.log('❌ [CONTIGUOUS] No contiguous selection returned');
        return { success: false, message: 'No contiguous table combination found' };
      }

      // Cast the result to proper type and handle Json type for selected_tables
      const rawSelection = data[0] as any;
      const selectedTables = Array.isArray(rawSelection.selected_tables) 
        ? rawSelection.selected_tables as number[]
        : [];
      
      if (!selectedTables || selectedTables.length === 0) {
        console.log('❌ [CONTIGUOUS] Empty table selection returned');
        return { success: false, message: 'No tables selected by contiguous algorithm' };
      }

      const selection: ContiguousSelectionResult = {
        is_contiguous: rawSelection.is_contiguous || false,
        reason: rawSelection.reason || 'Contiguous selection found',
        selected_tables: selectedTables,
        total_capacity: rawSelection.total_capacity || 0
      };

      // Calculate efficiency score: how well the tables match the party size
      const efficiencyScore = partySize / selection.total_capacity;
      
      console.log(`✅ [CONTIGUOUS] Selected tables: ${selection.selected_tables.join(', ')} (${selection.total_capacity} seats, ${(efficiencyScore * 100).toFixed(1)}% efficiency)`);

      return {
        success: true,
        assignedTable: selection.selected_tables[0],
        assignedTables: selection.selected_tables,
        tableSeats: selection.total_capacity,
        assignmentStrategy: 'multi-table',
        efficiencyScore: Math.round(efficiencyScore * 100),
        message: `Contiguous group assignment: ${selection.selected_tables.length} tables from "${groupName}" (${(efficiencyScore * 100).toFixed(1)}% efficiency)`
      };

    } catch (error) {
      console.error('❌ [CONTIGUOUS] Error during contiguous selection:', error);
      return { success: false, message: 'Error during contiguous table selection' };
    }
  }

  /**
   * Try visual efficiency assignment (fallback method)
   */
  private static async tryVisualEfficiencyAssignment(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    accessibilityNeeded: boolean
  ): Promise<AutoAssignmentResult> {
    try {
      console.log(`🎨 [VISUAL-EFF] Trying visual efficiency assignment as fallback`);
      
      // Simple fallback - just return failure since we want to keep logic simple
      return {
        success: false,
        message: 'Visual efficiency assignment not available',
        conflictsDetected: true
      };
    } catch (error) {
      console.error('❌ Visual efficiency assignment failed:', error);
      return {
        success: false,
        message: 'Visual efficiency assignment failed',
        conflictsDetected: true
      };
    }
  }

  /**
   * Check if a single table is available at a specific time
   */
  private static checkSingleTableAvailability(
    tableNumber: number,
    date: string,
    time: string,
    existingReservations: any[]
  ): boolean {
    const requestTime = new Date(`${date}T${time}`);
    const requestEndTime = new Date(requestTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    for (const reservation of existingReservations) {
      // Skip reservations where table is definitely free
      if (reservation.status === 'cancelled' || 
          reservation.status === 'no-show' || 
          reservation.status === 'completed' || 
          reservation.status === 'table-complete') {
        continue;
      }

      const isOnTable = reservation.table_number === tableNumber || 
                       (reservation.table_numbers && reservation.table_numbers.includes(tableNumber));

      if (isOnTable) {
        const reservationTime = new Date(`${reservation.date}T${reservation.time}`);
        const reservationEndTime = new Date(reservationTime.getTime() + 2 * 60 * 60 * 1000);

        if (requestTime < reservationEndTime && requestEndTime > reservationTime) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all available tables for a company
   */
  private static async getAvailableTables(companyId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .neq('service_status', 'temporarily_removed')
        .order('table_number');

      if (error) {
        console.error('Error fetching available tables:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAvailableTables:', error);
      return [];
    }
  }

  /**
   * Get existing reservations for a date
   */
  private static async getExistingReservations(companyId: string, date: string) {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('company_id', companyId)
        .eq('date', date)
        .not('status', 'in', '(cancelled,no-show,completed,table-complete)');

      if (error) {
        console.error('Error fetching existing reservations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getExistingReservations:', error);
      return [];
    }
  }

  /**
   * Check if all tables in a group are available for booking
   */
  private static async checkGroupAvailability(
    companyId: string,
    date: string,
    time: string,
    tableNumbers: number[]
  ): Promise<boolean> {
    const existingReservations = await this.getExistingReservations(companyId, date);
    
    // Check each table in the group
    for (const tableNumber of tableNumbers) {
      const isAvailable = this.checkSingleTableAvailability(
        tableNumber, date, time, existingReservations
      );
      if (!isAvailable) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get smart suggestions for alternative times
   */
  static async getSmartSuggestions(
    companyId: string,
    partySize: number,
    currentDate?: string,
    currentTime?: string
  ): Promise<string[]> {
    // Simple implementation - suggest common dining times
    const suggestions = [
      '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ];

    // Filter out the current time if provided
    if (currentTime) {
      return suggestions.filter(time => time !== currentTime);
    }

    return suggestions;
  }

  /**
   * Check if auto-assignment is possible for a party size
   */
  static async canAutoAssign(companyId: string, partySize: number): Promise<boolean> {
    try {
      const availableTables = await this.getAvailableTables(companyId);
      
      // Check if any single table can fit
      const hasSuitableTable = availableTables.some(table => table.seats >= partySize);
      if (hasSuitableTable) return true;

      // Check if any table groups exist (simplified check)
      const { data, error } = await supabase
        .from('tables')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .neq('service_status', 'temporarily_removed')
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      console.error('Error checking auto-assign capability:', error);
      return false;
    }
  }
}