import { supabase } from '@/integrations/supabase/client';
import { VisualCapacityService } from './visualCapacityService';
import { AutoAssignmentResult } from './smartAutoAssignmentService';

/**
 * Extensions to SmartAutoAssignmentService for visual efficiency integration
 */
export class SmartAutoAssignmentServiceExtensions {
  /**
   * Try assignment using visual efficiency calculations
   * Now prioritizes single tables for smaller parties
   */
  static async tryVisualEfficiencyAssignment(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    accessibilityNeeded: boolean
  ): Promise<AutoAssignmentResult> {
    try {
      // For smaller parties (≤6), first try to find single tables within groups
      if (partySize <= 6) {
        const singleTableFromGroup = await this.trySingleTableFromGroups(
          companyId, date, time, partySize, accessibilityNeeded
        );
        
        if (singleTableFromGroup.success) {
          return singleTableFromGroup;
        }
      }

      // Get table groups with efficiency data for multi-table assignments
      const { data: groupsData, error: groupsError } = await supabase
        .rpc('get_available_table_groups_with_status', { p_company_id: companyId });

      if (groupsError || !groupsData?.length) {
        return {
          success: false,
          message: 'No table groups available for visual efficiency analysis',
          conflictsDetected: false
        };
      }

      // Analyze each group for visual efficiency
      const groupAnalyses = await Promise.all(
        groupsData.map(async (group) => {
          try {
            const optimalCombination = await VisualCapacityService.findOptimalCombination(
              group.group_id,
              partySize,
              companyId
            );

            if (!optimalCombination) return null;

            // Check table availability
            const isAvailable = await this.checkTablesAvailability(
              companyId,
              date,
              time,
              optimalCombination.table_combination
            );

            if (!isAvailable) return null;

            return {
              group,
              combination: optimalCombination,
              efficiencyScore: optimalCombination.efficiency_score
            };
          } catch (error) {
            console.error(`Error analyzing group ${group.group_id}:`, error);
            return null;
          }
        })
      );

      // Filter out null results and sort by efficiency
      const validAnalyses = groupAnalyses
        .filter(analysis => analysis !== null)
        .sort((a, b) => b!.efficiencyScore - a!.efficiencyScore);

      if (!validAnalyses.length) {
        return {
          success: false,
          message: 'No suitable combinations found with visual efficiency analysis',
          conflictsDetected: true
        };
      }

      // Use the most efficient combination
      const bestAnalysis = validAnalyses[0]!;
      const { combination, group } = bestAnalysis;

      return {
        success: true,
        assignedTable: combination.table_combination[0],
        assignedTables: combination.table_combination,
        assignmentStrategy: 'visual-efficiency',
        efficiencyScore: combination.efficiency_score,
        visualCapacityUsed: true,
        message: `Visual efficiency assignment: ${combination.table_combination.length} table(s) from "${group.group_name}" (${combination.efficiency_score.toFixed(1)}% efficiency)`
      };

    } catch (error) {
      console.error('Visual efficiency assignment error:', error);
      return {
        success: false,
        message: 'Error during visual efficiency assignment',
        conflictsDetected: true
      };
    }
  }

  /**
   * Try to find optimal single tables within table groups
   */
  private static async trySingleTableFromGroups(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    accessibilityNeeded: boolean
  ): Promise<AutoAssignmentResult> {
    try {
      console.log(`🔍 Trying single tables from groups for party of ${partySize}`);
      
      // Get table groups
      const { data: groupsData, error } = await supabase
        .rpc('get_available_table_groups_with_status', { p_company_id: companyId });

      if (error || !groupsData?.length) {
        return { success: false, message: 'No table groups available' };
      }

      // Collect all single tables from groups that can accommodate the party
      const singleTablesFromGroups: Array<{
        table_number: number;
        seats: number;
        group_name: string;
        accessibility_friendly: boolean;
        waste: number;
      }> = [];

      for (const group of groupsData) {
        if (group.table_numbers && group.can_combine) {
          // Get individual table details
          const { data: tables, error: tablesError } = await supabase
            .from('tables')
            .select('table_number, seats, accessibility_friendly')
            .eq('company_id', companyId)
            .in('table_number', group.table_numbers)
            .eq('is_active', true)
            .gte('seats', partySize);

          if (!tablesError && tables) {
            tables.forEach(table => {
              singleTablesFromGroups.push({
                ...table,
                group_name: group.group_name,
                waste: table.seats - partySize
              });
            });
          }
        }
      }

      if (!singleTablesFromGroups.length) {
        console.log('❌ No suitable single tables found in groups');
        return { success: false, message: 'No single tables from groups available' };
      }

      // Filter by accessibility if needed
      let availableTables = singleTablesFromGroups;
      if (accessibilityNeeded) {
        availableTables = singleTablesFromGroups.filter(t => t.accessibility_friendly);
        if (!availableTables.length) {
          return { success: false, message: 'No accessible single tables in groups' };
        }
      }

      // Sort by least waste, then smallest size
      availableTables.sort((a, b) => {
        if (a.waste !== b.waste) return a.waste - b.waste;
        return a.seats - b.seats;
      });

      console.log(`🎯 Found ${availableTables.length} single tables from groups, checking availability...`);

      // Try each table in order of efficiency
      for (const table of availableTables) {
        const isAvailable = await this.checkTablesAvailability(
          companyId, date, time, [table.table_number]
        );

        if (isAvailable) {
          const wasteInfo = table.waste === 0 ? 'perfect match' : 
            table.waste === 1 ? 'minimal waste' : `${table.waste} extra seats`;
          
          console.log(`✅ Found single table from group: T${table.table_number} in "${table.group_name}" (${wasteInfo})`);
          
          return {
            success: true,
            assignedTable: table.table_number,
            assignedTables: [table.table_number],
            assignmentStrategy: 'visual-efficiency',
            message: `Single table from group "${table.group_name}": T${table.table_number} (${table.seats} seats, ${wasteInfo})`
          };
        }
      }

      console.log('❌ All single tables from groups are occupied');
      return { success: false, message: 'All single tables from groups occupied' };

    } catch (error) {
      console.error('Error trying single tables from groups:', error);
      return { success: false, message: 'Error checking single tables from groups' };
    }
  }

  /**
   * Check if tables are available for assignment
   */
  private static async checkTablesAvailability(
    companyId: string,
    date: string,
    time: string,
    tableNumbers: number[]
  ): Promise<boolean> {
    try {
      // Company-scoped availability check to avoid cross-company conflicts
      const { data: existingReservations, error } = await supabase
        .from('reservations')
        .select('id, date, time, end_time, status, table_number, table_numbers')
        .eq('company_id', companyId)
        .eq('date', date);

      if (error) {
        console.error('Table availability check error:', error);
        return false;
      }

      const reservationTime = new Date(`${date}T${time}`);
      const reservationEndTime = new Date(reservationTime.getTime() + 120 * 60000);

      const hasConflict = (existingReservations || []).some(reservation => {
        // Skip cancelled and no-show
        if (reservation.status === 'cancelled' || reservation.status === 'no-show') return false;

        // Check if this reservation uses any of the target tables
        const usesTable = reservation.table_number ?
          tableNumbers.includes(reservation.table_number) :
          Array.isArray(reservation.table_numbers) && reservation.table_numbers.some((t: number) => tableNumbers.includes(t));
        if (!usesTable) return false;

        const existingTime = new Date(`${reservation.date}T${reservation.time}`);
        const existingEndTime = reservation.end_time 
          ? new Date(`${reservation.date}T${reservation.end_time}`)
          : new Date(existingTime.getTime() + 120 * 60000);

        return (reservationTime < existingEndTime && reservationEndTime > existingTime);
      });

      return !hasConflict;
    } catch (error) {
      console.error('Table availability check error:', error);
      return false;
    }
  }

  /**
   * Get efficiency-based assignment recommendations
   */
  static async getEfficiencyRecommendations(
    companyId: string,
    partySize: number
  ): Promise<Array<{
    groupName: string;
    tableCombination: number[];
    efficiencyScore: number;
    recommendations: string[];
  }>> {
    try {
      const { data: groupsData, error } = await supabase
        .rpc('get_available_table_groups_with_status', { p_company_id: companyId });

      if (error || !groupsData?.length) return [];

      const recommendations = await Promise.all(
        groupsData.map(async (group) => {
          try {
            const scenarios = await VisualCapacityService.getVisualCapacityScenarios(
              group.group_id,
              companyId
            );

            // Use total_seats for booking decisions (should represent Available Seats from scenarios)
            const suitableScenarios = scenarios.filter(s => s.total_seats >= partySize);
            if (!suitableScenarios.length) return null;

            const bestScenario = suitableScenarios.reduce((best, current) => 
              current.efficiency_score > best.efficiency_score ? current : best
            );

            const capacityAnalysis = await VisualCapacityService.getCachedVisualCapacity(
              group.group_id,
              bestScenario.table_combination,
              companyId
            );

            return {
              groupName: group.group_name,
              tableCombination: bestScenario.table_combination,
              efficiencyScore: bestScenario.efficiency_score,
              recommendations: capacityAnalysis.recommendations
            };
          } catch (error) {
            console.error(`Error getting recommendations for group ${group.group_id}:`, error);
            return null;
          }
        })
      );

      return recommendations.filter(rec => rec !== null);
    } catch (error) {
      console.error('Error getting efficiency recommendations:', error);
      return [];
    }
  }
}