import { supabase } from '@/integrations/supabase/client';
import { isValidTableCombination } from '@/utils/tableGroupUtils';

interface RebalanceMove {
  reservationId: string;
  customerName: string;
  partySize: number;
  currentTables: number[];
  targetTables: number[];
  reason: string;
  priority: number;
}

interface RebalanceChain {
  moves: RebalanceMove[];
  beneficiaryReservation: {
    id: string;
    customerName: string;
    partySize: number;
  };
  totalSeatsFreed: number;
  efficiencyGain: number;
}

export class GlobalTableRebalanceService {
  /**
   * Main entry point for global rebalancing
   * Attempts to find and execute cascading moves to accommodate unassigned reservations
   */
  static async executeGlobalRebalancing(
    companyId: string,
    date: string,
    time: string,
    unassignedReservation?: {
      id: string;
      customerName: string;
      partySize: number;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    movesExecuted: number;
    message: string;
    rebalanceChains?: RebalanceChain[];
  }> {
    console.log('🌍 Starting global table rebalancing for company:', companyId);
    
    try {
      // Step 1: Identify blocked/unassigned reservations
      const blockedReservations = await this.findBlockedReservations(companyId, date, unassignedReservation);
      
      if (blockedReservations.length === 0) {
        return {
          success: true,
          movesExecuted: 0,
          message: 'No blocked reservations found'
        };
      }

      console.log(`📋 Found ${blockedReservations.length} blocked reservations`);

      // Step 2: Generate rebalance chains for each blocked reservation
      const rebalanceChains: RebalanceChain[] = [];
      
      for (const blocked of blockedReservations) {
        const chain = await this.generateRebalanceChain(companyId, date, time, blocked);
        if (chain) {
          rebalanceChains.push(chain);
        }
      }

      if (rebalanceChains.length === 0) {
        return {
          success: false,
          movesExecuted: 0,
          message: 'No viable rebalancing chains found'
        };
      }

      // Step 3: Sort chains by efficiency gain and execute the best one
      rebalanceChains.sort((a, b) => b.efficiencyGain - a.efficiencyGain);
      const bestChain = rebalanceChains[0];

      console.log(`🎯 Executing best rebalancing chain: ${bestChain.moves.length} moves for ${bestChain.beneficiaryReservation.customerName}`);

      // Step 4: Execute the chain
      const executionResult = await this.executeRebalanceChain(companyId, bestChain);
      
      return {
        success: executionResult.success,
        movesExecuted: executionResult.movesExecuted,
        message: executionResult.success 
          ? `Successfully rebalanced ${executionResult.movesExecuted} reservations to accommodate ${bestChain.beneficiaryReservation.customerName}`
          : `Failed to execute rebalancing: ${executionResult.error}`,
        rebalanceChains
      };

    } catch (error) {
      console.error('Global rebalancing error:', error);
      return {
        success: false,
        movesExecuted: 0,
        message: `Global rebalancing failed: ${error}`
      };
    }
  }

  /**
   * Find reservations that are blocked from assignment
   */
  private static async findBlockedReservations(
    companyId: string,
    date: string,
    unassignedReservation?: {
      id: string;
      customerName: string;
      partySize: number;
      notes?: string;
    }
  ): Promise<Array<{
    id: string;
    customerName: string;
    partySize: number;
    notes?: string;
  }>> {
    const blockedReservations = [];

    // Add the specific unassigned reservation if provided
    if (unassignedReservation) {
      blockedReservations.push(unassignedReservation);
    }

    // Find other unassigned reservations in the system
    const { data: unassignedReservations } = await supabase
      .from('reservations')
      .select('id, customer_name, party_size, notes, table_numbers, table_number')
      .eq('company_id', companyId)
      .eq('date', date)
      .eq('status', 'confirmed')
      .or('table_numbers.is.null,table_number.is.null');

    if (unassignedReservations) {
      for (const reservation of unassignedReservations) {
        // Skip if already in our list
        if (blockedReservations.some(b => b.id === reservation.id)) continue;
        
        // Only include if truly unassigned (no table_numbers and no table_number)
        if (!reservation.table_numbers?.length && !reservation.table_number) {
          blockedReservations.push({
            id: reservation.id,
            customerName: reservation.customer_name,
            partySize: reservation.party_size,
            notes: reservation.notes
          });
        }
      }
    }

    // Sort by party size (larger parties first - they have fewer options)
    return blockedReservations.sort((a, b) => b.partySize - a.partySize);
  }

  /**
   * Generate a rebalancing chain for a blocked reservation
   */
  private static async generateRebalanceChain(
    companyId: string,
    date: string,
    time: string,
    blockedReservation: {
      id: string;
      customerName: string;
      partySize: number;
      notes?: string;
    }
  ): Promise<RebalanceChain | null> {
    console.log(`🔗 Generating rebalance chain for ${blockedReservation.customerName} (${blockedReservation.partySize} guests)`);

    // Step 1: Find table groups that could accommodate this reservation
    const { data: tableGroups } = await supabase
      .rpc('get_table_groups_with_tables', { p_company_id: companyId });

    if (!tableGroups?.length) {
      console.log('❌ No table groups available');
      return null;
    }

    // Filter groups that can accommodate the party size
    const viableGroups = tableGroups.filter(group => 
      group.max_combined_capacity >= blockedReservation.partySize
    );

    if (viableGroups.length === 0) {
      console.log(`❌ No groups can accommodate ${blockedReservation.partySize} guests`);
      return null;
    }

    console.log(`🎯 Found ${viableGroups.length} viable groups:`, viableGroups.map(g => `${g.group_name} (${g.max_combined_capacity} capacity)`));

    // Step 2: Check which groups are currently occupied and by whom
    for (const group of viableGroups) {
      const groupTableNumbers = group.table_numbers || [];
      
      // Find reservations currently using these tables (include lock fields)
      const { data: currentOccupants } = await supabase
        .from('reservations')
        .select('id, customer_name, party_size, table_numbers, table_number, notes, is_locked, last_manual_move_time')
        .eq('company_id', companyId)
        .eq('date', date)
        .eq('status', 'confirmed')
        .or(
          groupTableNumbers.map(tableNum => 
            `table_numbers.cs.{${tableNum}},table_number.eq.${tableNum}`
          ).join(',')
        );

      if (!currentOccupants?.length) {
        // Group is free - this shouldn't happen if we got here, but handle it
        console.log(`✅ Group ${group.group_name} is free - could assign directly`);
        continue;
      }

      console.log(`🔍 Group ${group.group_name} occupied by:`, currentOccupants.map(r => `${r.customer_name} (${r.party_size})`));

      // Step 3: Check if current occupants can be moved to alternative tables
      const moves: RebalanceMove[] = [];
      let canRebalance = true;

      for (const occupant of currentOccupants) {
        // Check if occupant is locked before attempting to move
        if (occupant.is_locked) {
          console.log(`🔒 Cannot rebalance locked reservation: ${occupant.customer_name}`);
          canRebalance = false;
          break;
        }

        // Check temporary lock (recently manually moved)
        if (occupant.last_manual_move_time) {
          const moveTime = new Date(occupant.last_manual_move_time).getTime();
          if (Date.now() - moveTime < 10000) { // 10-second temporary lock
            console.log(`⏱️ Cannot rebalance recently moved: ${occupant.customer_name}`);
            canRebalance = false;
            break;
          }
        }

        const alternativeAssignment = await this.findAlternativeTableAssignment(
          companyId,
          date,
          time,
          {
            id: occupant.id,
            customerName: occupant.customer_name,
            partySize: occupant.party_size,
            notes: occupant.notes,
            currentTables: occupant.table_numbers || [occupant.table_number].filter(Boolean)
          },
          groupTableNumbers // Exclude the group we're trying to free
        );

        if (!alternativeAssignment.success) {
          console.log(`❌ Cannot find alternative for ${occupant.customer_name}`);
          canRebalance = false;
          break;
        }

        moves.push({
          reservationId: occupant.id,
          customerName: occupant.customer_name,
          partySize: occupant.party_size,
          currentTables: occupant.table_numbers || [occupant.table_number].filter(Boolean),
          targetTables: alternativeAssignment.targetTables,
          reason: alternativeAssignment.reason,
          priority: 1
        });
      }

      if (canRebalance) {
        // Calculate efficiency gain
        const totalSeatsFreed = groupTableNumbers.reduce((sum, tableNum) => {
          // This would need table data to calculate actual seats
          return sum + 8; // Approximate - would need actual table data
        }, 0);

        const efficiencyGain = this.calculateEfficiencyGain(moves, blockedReservation.partySize, totalSeatsFreed);

        console.log(`✅ Found viable rebalance chain for group ${group.group_name}: ${moves.length} moves, efficiency gain: ${efficiencyGain}`);

        return {
          moves,
          beneficiaryReservation: blockedReservation,
          totalSeatsFreed,
          efficiencyGain
        };
      }
    }

    console.log(`❌ No viable rebalance chain found for ${blockedReservation.customerName}`);
    return null;
  }

  /**
   * Find alternative table assignment for a reservation being displaced
   */
  private static async findAlternativeTableAssignment(
    companyId: string,
    date: string,
    time: string,
    reservation: {
      id: string;
      customerName: string;
      partySize: number;
      notes?: string;
      currentTables: number[];
    },
    excludeTables: number[]
  ): Promise<{
    success: boolean;
    targetTables: number[];
    reason: string;
    error?: string;
  }> {
    // Get available tables excluding the ones we need to free
    const { data: tables } = await supabase
      .from('tables')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('service_status', 'available');

    if (!tables) {
      return { success: false, targetTables: [], reason: '', error: 'No tables data' };
    }

    // Filter out excluded tables and current tables
    const availableTables = tables.filter(t => 
      !excludeTables.includes(t.table_number) &&
      !reservation.currentTables.includes(t.table_number)
    );

        // Check for conflicts with existing reservations
        const { data: conflicts } = await supabase.rpc('check_table_conflict', {
          p_table_numbers: availableTables.map(t => t.table_number),
          p_date: date,
          p_time: time,
          p_exclude_reservation_id: reservation.id
        });

        const conflictFreeTables = availableTables.filter(t => 
          !conflicts || !Array.isArray(conflicts) || !conflicts.includes(t.table_number)
        );

    // Try to find a single table that can accommodate the party
    const suitableTable = conflictFreeTables
      .filter(t => t.seats >= reservation.partySize)
      .sort((a, b) => a.seats - b.seats)[0]; // Smallest suitable table

    if (suitableTable) {
      return {
        success: true,
        targetTables: [suitableTable.table_number],
        reason: `Alternative single table assignment (${suitableTable.seats} seats for ${reservation.partySize} guests)`
      };
    }

    // If no single table works, try table groups (but exclude the one we're freeing)
    const { data: alternativeGroups } = await supabase
      .rpc('get_table_groups_with_tables', { p_company_id: companyId });

    if (alternativeGroups) {
      for (const group of alternativeGroups) {
        const groupTables = group.table_numbers || [];
        
        // Validate group is consecutive before considering it
        const validation = isValidTableCombination(groupTables, alternativeGroups);
        if (!validation.valid) {
          continue; // Skip invalid groups
        }

        // Skip if this group overlaps with excluded tables
        if (groupTables.some(t => excludeTables.includes(t))) continue;
        
        // Check if group can accommodate party size
        if (group.max_combined_capacity >= reservation.partySize) {
          // Check for conflicts
          const { data: groupConflicts } = await supabase.rpc('check_table_conflict', {
            p_table_numbers: groupTables,
            p_date: date,
            p_time: time,
            p_exclude_reservation_id: reservation.id
          });

          if (!groupConflicts) {
            return {
              success: true,
              targetTables: groupTables,
              reason: `Alternative group assignment: ${group.group_name} (${group.max_combined_capacity} capacity)`
            };
          }
        }
      }
    }

    return {
      success: false,
      targetTables: [],
      reason: '',
      error: `No suitable alternative found for ${reservation.customerName} (${reservation.partySize} guests)`
    };
  }

  /**
   * Execute a rebalancing chain
   */
  private static async executeRebalanceChain(
    companyId: string,
    chain: RebalanceChain
  ): Promise<{
    success: boolean;
    movesExecuted: number;
    error?: string;
  }> {
    console.log(`🚀 Executing rebalance chain: ${chain.moves.length} moves`);
    
    let movesExecuted = 0;
    
    // Execute moves in sequence to avoid conflicts
    for (const move of chain.moves) {
      try {
        console.log(`🔄 Moving ${move.customerName} from T${move.currentTables.join(',')} to T${move.targetTables.join(',')}`);
        
        // Update reservation tables
        const updateData = move.targetTables.length === 1 
          ? { 
              table_number: move.targetTables[0],
              table_numbers: move.targetTables
            }
          : {
              table_number: null,
              table_numbers: move.targetTables
            };

        const { error } = await supabase
          .from('reservations')
          .update(updateData)
          .eq('id', move.reservationId)
          .eq('company_id', companyId);

        if (error) {
          console.error(`❌ Failed to move ${move.customerName}:`, error);
          return {
            success: false,
            movesExecuted,
            error: `Failed to move ${move.customerName}: ${error.message}`
          };
        }

        // Log the move
        await supabase
          .from('manual_override_feedback')
          .insert({
            company_id: companyId,
            reservation_id: move.reservationId,
            old_table_numbers: move.currentTables,
            new_table_numbers: move.targetTables,
            feedback_reasons: ['global_rebalancing'],
            additional_notes: `Global rebalancing move: ${move.reason}`
          });

        movesExecuted++;
        console.log(`✅ Successfully moved ${move.customerName}`);
        
      } catch (error) {
        console.error(`❌ Error executing move for ${move.customerName}:`, error);
        return {
          success: false,
          movesExecuted,
          error: `Error moving ${move.customerName}: ${error}`
        };
      }
    }

    console.log(`🎉 Successfully executed ${movesExecuted} moves in rebalancing chain`);
    return {
      success: true,
      movesExecuted
    };
  }

  /**
   * Calculate efficiency gain from a rebalancing chain
   */
  private static calculateEfficiencyGain(
    moves: RebalanceMove[],
    beneficiaryPartySize: number,
    totalSeatsFreed: number
  ): number {
    // Calculate current waste (over-allocation)
    const currentWaste = moves.reduce((waste, move) => {
      const currentSeats = move.currentTables.length * 8; // Approximate
      const partySize = move.partySize;
      return waste + Math.max(0, currentSeats - partySize);
    }, 0);

    // Calculate new waste after moves
    const newWaste = moves.reduce((waste, move) => {
      const newSeats = move.targetTables.length * 8; // Approximate
      const partySize = move.partySize;
      return waste + Math.max(0, newSeats - partySize);
    }, 0);

    // Factor in the benefit of accommodating the blocked reservation
    const accommodationBenefit = totalSeatsFreed >= beneficiaryPartySize ? 100 : 0;

    // Calculate efficiency gain
    const wasteReduction = currentWaste - newWaste;
    const efficiencyGain = wasteReduction + accommodationBenefit;

    return Math.max(0, efficiencyGain);
  }
}