import { supabase } from '@/integrations/supabase/client';
import { isValidTableCombination } from '@/utils/tableGroupUtils';

export interface SpaceMakingOption {
  targetTables: number[];
  totalSeats: number;
  currentOccupants: Array<{
    reservationId: string;
    customerName: string;
    partySize: number;
    currentTables: number[];
    suggestedAlternatives: number[]; // Now supports multi-table alternatives
  }>;
  movesRequired: number;
  efficiency: number;
  confidence: number;
  freesUpSeats: number;
}

/**
 * Service for analyzing space-making opportunities
 * Identifies which reservations can be moved to free up optimal table combinations for large parties
 */
export class SpaceMakingAnalysisService {
  
  /**
   * Analyze space-making opportunities for a target party size
   * Returns options for moving existing reservations to free up table combinations
   */
  static async analyzeSpaceMakingOptions(
    companyId: string,
    date: string,
    time: string,
    targetPartySize: number
  ): Promise<SpaceMakingOption[]> {
    console.log(`🔍 [SPACE-MAKING] Analyzing options for ${targetPartySize} guests at ${date} ${time}`);
    
    try {
      // Get all tables and their groups
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .neq('service_status', 'temporarily_removed')
        .order('table_number');

      if (tablesError || !tables) {
        console.error('[SPACE-MAKING] Failed to fetch tables:', tablesError);
        return [];
      }

      console.log(`📊 [SPACE-MAKING] Found ${tables.length} operational tables:`, 
        tables.map(t => `T${t.table_number}(${t.seats})`).join(', '));

      // Get table groups with their table numbers via RPC
      const { data: tableGroupsData } = await supabase
        .rpc('get_table_groups_with_tables', { p_company_id: companyId });
      
      const tableGroups = tableGroupsData || [];
      
      console.log(`📊 [SPACE-MAKING] Found ${tableGroups.length} table groups:`,
        tableGroups.map((g: any) => `${g.group_name}(T${g.table_numbers?.join(',') || 'empty'})`).join(', '));

      // Get existing reservations for the time slot
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('company_id', companyId)
        .eq('date', date)
        .in('status', ['confirmed', 'pending']);

      if (resError || !reservations) {
        console.error('[SPACE-MAKING] Failed to fetch reservations:', resError);
        return [];
      }

      // Find optimal table combinations for the target party size
      const optimalCombinations = this.findOptimalTableCombinations(
        tables,
        tableGroups || [],
        targetPartySize
      );

      console.log(`📊 [SPACE-MAKING] Found ${optimalCombinations.length} optimal combinations`);

      // For each combination, check if it's occupied and if we can move those reservations
      const spaceMakingOptions: SpaceMakingOption[] = [];

      for (const combo of optimalCombinations) {
        const option = await this.analyzeTableCombination(
          combo.tables,
          combo.totalSeats,
          reservations,
          tables,
          date,
          time,
          targetPartySize
        );

        if (option) {
          spaceMakingOptions.push(option);
        }
      }

      // Sort by efficiency (fewest moves, best seat efficiency)
      spaceMakingOptions.sort((a, b) => {
        if (a.movesRequired !== b.movesRequired) {
          return a.movesRequired - b.movesRequired; // Fewer moves = better
        }
        return b.efficiency - a.efficiency; // Higher efficiency = better
      });

      console.log(`✅ [SPACE-MAKING] Found ${spaceMakingOptions.length} viable options`);
      return spaceMakingOptions.slice(0, 3); // Return top 3 options

    } catch (error) {
      console.error('[SPACE-MAKING] Analysis error:', error);
      return [];
    }
  }

  /**
   * Find optimal table combinations that could accommodate the target party size
   */
  private static findOptimalTableCombinations(
    tables: any[],
    tableGroups: any[],
    targetPartySize: number
  ): Array<{ tables: number[], totalSeats: number, isGroup: boolean }> {
    const combinations: Array<{ tables: number[], totalSeats: number, isGroup: boolean }> = [];

    // Check table groups first (they're usually optimal for large parties)
    for (const group of tableGroups) {
      if (!group.table_numbers || group.table_numbers.length === 0) continue;

      // Validate group is consecutive before considering it
      const validation = isValidTableCombination(group.table_numbers, tableGroups);
      if (!validation.valid) {
        continue; // Skip invalid groups
      }

      const groupTables = group.table_numbers
        .map((num: number) => tables.find(t => t.table_number === num))
        .filter((t: any) => t);

      const totalSeats = groupTables.reduce((sum: number, t: any) => sum + t.seats, 0);

      if (totalSeats >= targetPartySize && totalSeats <= targetPartySize + 6) {
        combinations.push({
          tables: group.table_numbers,
          totalSeats,
          isGroup: true
        });
      }
    }

    // Also check individual large tables
    for (const table of tables) {
      if (table.seats >= targetPartySize && table.seats <= targetPartySize + 4) {
        combinations.push({
          tables: [table.table_number],
          totalSeats: table.seats,
          isGroup: false
        });
      }
    }

    // Check consecutive table combinations if no groups found
    if (combinations.length === 0) {
      const sortedTables = [...tables].sort((a, b) => a.table_number - b.table_number);
      
      for (let i = 0; i < sortedTables.length - 1; i++) {
        const combo = [sortedTables[i], sortedTables[i + 1]];
        const totalSeats = combo.reduce((sum, t) => sum + t.seats, 0);
        
        if (totalSeats >= targetPartySize && totalSeats <= targetPartySize + 6) {
          combinations.push({
            tables: combo.map(t => t.table_number),
            totalSeats,
            isGroup: false
          });
        }
      }
    }

    return combinations;
  }

  /**
   * Analyze a specific table combination to see if we can free it up by moving existing reservations
   */
  private static async analyzeTableCombination(
    targetTables: number[],
    totalSeats: number,
    reservations: any[],
    allTables: any[],
    date: string,
    time: string,
    targetPartySize: number
  ): Promise<SpaceMakingOption | null> {
    
    const timeMinutes = this.timeToMinutes(time);
    const occupants: Array<{
      reservationId: string;
      customerName: string;
      partySize: number;
      currentTables: number[];
      suggestedAlternatives: number[];
    }> = [];

      // Find reservations occupying any of the target tables within 2-hour window
    for (const res of reservations) {
      const resTime = this.timeToMinutes(res.time);
      const timeDiff = Math.abs(resTime - timeMinutes);
      
      if (timeDiff > 120) continue; // Outside 2-hour window

      const resTables = res.table_numbers || (res.table_number ? [res.table_number] : []);
      const hasOverlap = resTables.some((t: number) => targetTables.includes(t));

      if (hasOverlap) {
        console.log(`🎯 [SPACE-MAKING] Found occupant on target tables: ${res.customer_name} (${res.party_size} guests) on T${resTables.join(',')}`);
        
        // Check if reservation is locked - skip locked reservations
        if (res.is_locked) {
          console.log(`🔒 Skipping locked reservation: ${res.customer_name}`);
          return null; // Can't move locked reservations
        }

        // Check temporary lock (recently manually moved)
        if (res.last_manual_move_time) {
          const moveTime = new Date(res.last_manual_move_time).getTime();
          const now = Date.now();
          if (now - moveTime < 10000) { // 10-second temporary lock
            console.log(`⏱️ Skipping recently moved reservation: ${res.customer_name}`);
            return null; // Can't move recently moved reservations
          }
        }

        // Find alternative tables for this reservation
        console.log(`🔍 [SPACE-MAKING] Searching alternatives for ${res.customer_name}...`);
        const alternatives = await this.findAlternativeTablesForReservation(
          res,
          allTables,
          reservations,
          targetTables
        );

        // Convert multi-table alternatives to single best option for now
        const bestAlternative = alternatives.length > 0 ? alternatives[0] : [];
        
        if (bestAlternative.length > 0) {
          console.log(`✅ [SPACE-MAKING] Found ${alternatives.length} alternatives for ${res.customer_name}, best: T${bestAlternative.join(',')}`);
        } else {
          console.log(`❌ [SPACE-MAKING] No alternatives found for ${res.customer_name}`);
        }
        
        occupants.push({
          reservationId: res.id,
          customerName: res.customer_name,
          partySize: res.party_size,
          currentTables: resTables,
          suggestedAlternatives: bestAlternative // Now an array of table numbers
        });
      }
    }

    // If no occupants, this combination is already available
    if (occupants.length === 0) {
      return null; // Not a space-making scenario
    }

    // Check if all occupants have valid alternatives
    const allHaveAlternatives = occupants.every(o => o.suggestedAlternatives.length > 0);
    
    if (!allHaveAlternatives) {
      return null; // Can't move all reservations
    }

    // Calculate efficiency
    const wastedSeats = totalSeats - targetPartySize;
    const efficiency = Math.max(0, 100 - (wastedSeats / totalSeats) * 100);
    
    // Calculate confidence based on how easy the moves are
    const avgAlternatives = occupants.reduce((sum, o) => sum + o.suggestedAlternatives.length, 0) / occupants.length;
    const confidence = Math.min(100, avgAlternatives * 25); // More alternatives = higher confidence

    return {
      targetTables,
      totalSeats,
      currentOccupants: occupants,
      movesRequired: occupants.length,
      efficiency,
      confidence,
      freesUpSeats: totalSeats
    };
  }

  /**
   * Find alternative tables for a reservation that needs to be moved
   * Now supports multi-table alternatives (partial groups and full groups)
   */
  private static async findAlternativeTablesForReservation(
    reservation: any,
    allTables: any[],
    existingReservations: any[],
    excludeTables: number[]
  ): Promise<number[][]> {
    const alternatives: number[][] = [];
    const resTime = this.timeToMinutes(reservation.time);
    const partySize = reservation.party_size;

    console.log(`🔍 [ALT-SEARCH] Finding alternatives for ${reservation.customer_name} (${partySize} guests)`);

    // Helper to check if tables are available
    const areTablesAvailable = (tableNumbers: number[]): boolean => {
      return tableNumbers.every(tableNum => {
        if (excludeTables.includes(tableNum)) return false;
        
        return !existingReservations.some(res => {
          if (res.id === reservation.id) return false;
          
          const checkTime = this.timeToMinutes(res.time);
          const timeDiff = Math.abs(checkTime - resTime);
          if (timeDiff > 120) return false;

          const resTables = res.table_numbers || (res.table_number ? [res.table_number] : []);
          return resTables.includes(tableNum);
        });
      });
    };

    // 1. Try single tables first (most efficient)
    for (const table of allTables) {
      if (excludeTables.includes(table.table_number)) continue;
      if (table.seats < partySize) continue;

      if (areTablesAvailable([table.table_number])) {
        alternatives.push([table.table_number]);
        console.log(`  ✓ Single table T${table.table_number} (${table.seats} seats)`);
      }
    }

    // 2. Try consecutive table combinations (partial groups)
    const sortedTables = [...allTables]
      .filter(t => !excludeTables.includes(t.table_number))
      .sort((a, b) => a.table_number - b.table_number);

    for (let i = 0; i < sortedTables.length; i++) {
      let totalSeats = 0;
      const combo: number[] = [];

      for (let j = i; j < sortedTables.length && j < i + 4; j++) {
        combo.push(sortedTables[j].table_number);
        totalSeats += sortedTables[j].seats;

        if (totalSeats >= partySize && areTablesAvailable(combo)) {
          // Validate consecutive combination (need groups for validation)
          const { data: groupsForValidation } = await supabase
            .rpc('get_table_groups_with_tables', { p_company_id: reservation.company_id });
          
          const validation = isValidTableCombination(combo, groupsForValidation || []);
          if (validation.valid) {
            alternatives.push([...combo]);
            console.log(`  ✓ Consecutive combo T${combo.join(',')} (${totalSeats} seats)`);
          }
          break;
        }
      }
    }

    // 3. Try table groups (fetch groups if needed)
    try {
      const { data: tableGroups } = await supabase
        .rpc('get_table_groups_with_tables', { p_company_id: reservation.company_id });

      if (tableGroups) {
        for (const group of tableGroups) {
          if (!group.table_numbers?.length) continue;

          const groupTableNumbers = group.table_numbers as number[];
          
          // Validate group is consecutive before considering it
          const validation = isValidTableCombination(groupTableNumbers, tableGroups);
          if (!validation.valid) {
            continue; // Skip invalid groups
          }

          const groupTables = groupTableNumbers
            .map((num: number) => allTables.find(t => t.table_number === num))
            .filter((t: any) => t && !excludeTables.includes(t.table_number));

          const totalSeats = groupTables.reduce((sum: number, t: any) => sum + t.seats, 0);

          if (totalSeats >= partySize && areTablesAvailable(groupTableNumbers)) {
            alternatives.push(groupTableNumbers);
            console.log(`  ✓ Full group ${group.group_name} T${groupTableNumbers.join(',')} (${totalSeats} seats)`);
          }
        }
      }
    } catch (error) {
      console.error('[ALT-SEARCH] Error fetching table groups:', error);
    }

    // Sort alternatives: prefer fewer tables, then less wasted seats
    alternatives.sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      
      const seatsA = a.reduce((sum, tNum) => {
        const table = allTables.find(t => t.table_number === tNum);
        return sum + (table?.seats || 0);
      }, 0);
      
      const seatsB = b.reduce((sum, tNum) => {
        const table = allTables.find(t => t.table_number === tNum);
        return sum + (table?.seats || 0);
      }, 0);
      
      return (seatsA - partySize) - (seatsB - partySize);
    });

    console.log(`📊 [ALT-SEARCH] Found ${alternatives.length} alternative configurations`);
    return alternatives.slice(0, 5); // Return top 5
  }

  /**
   * Convert time string to minutes since midnight
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Execute space-making optimization by moving the identified reservations
   * Now supports multi-table assignments
   */
  static async executeSpaceMaking(
    option: SpaceMakingOption,
    companyId: string,
    targetDate: string,
    targetTime: string
  ): Promise<{ success: boolean; message: string }> {
    console.log(`🚀 [SPACE-MAKING] Executing space-making for ${option.movesRequired} reservation(s)`);

    try {
      // First, trigger the continuous optimizer to move the occupants with manual override enabled
      // This allows moving reservations even if they're within 30 minutes of starting
      const { data: optimizerResult, error: optimizerError } = await supabase.functions.invoke(
        'continuous-optimizer',
        {
          body: {
            companyId,
            mode: 'space_making',
            automated: false, // This is a manual user action
            allowImminentMoves: true, // Allow moving reservations within 30 minutes
            targetDate,
            targetTime,
            preferredTables: option.targetTables
          }
        }
      );

      if (optimizerError) {
        console.error(`❌ Optimizer invocation failed:`, optimizerError);
        return {
          success: false,
          message: 'Failed to invoke optimizer for space-making'
        };
      }

      console.log(`✅ Optimizer result:`, optimizerResult);

      if (optimizerResult?.success && optimizerResult.movesCount > 0) {
        return {
          success: true,
          message: `Successfully moved ${optimizerResult.movesCount} reservation(s) to free up ${option.freesUpSeats} seats`
        };
      } else {
        return {
          success: false,
          message: optimizerResult?.reason || 'No moves were made'
        };
      }

    } catch (error) {
      console.error('[SPACE-MAKING] Execution error:', error);
      return {
        success: false,
        message: 'Failed to execute space-making optimization'
      };
    }
  }
}
