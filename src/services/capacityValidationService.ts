import { supabase } from '@/integrations/supabase/client';
import { CapacityLogicService } from './capacityLogicService';
import { Table } from '@/types/table';

export interface CapacityValidationResult {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
  availableSeats: number;
  calculatedSeats: number;
  efficiency: number;
}

/**
 * Service to validate consistency between max_combined_capacity (Available Seats)
 * and calculated individual table totals
 */
export class CapacityValidationService {
  /**
   * Validate table group capacity consistency
   */
  static async validateGroupCapacity(
    groupId: string,
    companyId: string
  ): Promise<CapacityValidationResult> {
    try {
      // Get group configuration
      const { data: group, error: groupError } = await supabase
        .from('table_groups')
        .select('group_name, max_combined_capacity')
        .eq('id', groupId)
        .eq('company_id', companyId)
        .single();

      if (groupError || !group) {
        return {
          isValid: false,
          warnings: ['Could not fetch group configuration'],
          recommendations: ['Check if group exists and is accessible'],
          availableSeats: 0,
          calculatedSeats: 0,
          efficiency: 0
        };
      }

      // Get group tables
      const { data: tables, error: tablesError } = await supabase
        .from('table_group_memberships')
        .select(`
          tables!inner (
            table_number,
            seats,
            is_active
          )
        `)
        .eq('group_id', groupId);

      if (tablesError || !tables) {
        return {
          isValid: false,
          warnings: ['Could not fetch group tables'],
          recommendations: ['Verify group has tables assigned'],
          availableSeats: group.max_combined_capacity || 0,
          calculatedSeats: 0,
          efficiency: 0
        };
      }

      // Calculate individual total with seat loss
      const groupTables = tables.map(t => t.tables).filter(Boolean) as Table[];
      const calculatedCapacity = CapacityLogicService.calculatePartialGroupCapacity(groupTables);
      const availableSeats = group.max_combined_capacity || 0;
      const efficiency = CapacityLogicService.calculateGroupEfficiency(availableSeats, calculatedCapacity);

      const warnings: string[] = [];
      const recommendations: string[] = [];

      // Validation checks
      if (availableSeats === 0) {
        warnings.push('No Available Seats configured for this group');
        recommendations.push('Set max_combined_capacity in group settings');
      }

      if (calculatedCapacity === 0) {
        warnings.push('No tables found or all tables have 0 seats');
        recommendations.push('Verify tables are properly assigned to group');
      }

      const difference = Math.abs(availableSeats - calculatedCapacity);
      const percentDifference = calculatedCapacity > 0 ? (difference / calculatedCapacity) * 100 : 100;

      if (percentDifference > 20) {
        warnings.push(`Large difference between Available Seats (${availableSeats}) and calculated capacity (${calculatedCapacity})`);
        recommendations.push('Review seat loss configuration or update Available Seats');
      }

      if (availableSeats > calculatedCapacity + 5) {
        warnings.push('Available Seats significantly exceeds calculated capacity');
        recommendations.push('This could lead to overbooking - consider reducing Available Seats');
      }

      if (efficiency < 70) {
        warnings.push(`Low efficiency (${efficiency}%) - significant seat loss detected`);
        recommendations.push('Consider optimizing table arrangement or adjusting seat loss settings');
      }

      const isValid = warnings.length === 0;

      return {
        isValid,
        warnings,
        recommendations,
        availableSeats,
        calculatedSeats: calculatedCapacity,
        efficiency
      };

    } catch (error) {
      console.error('Capacity validation error:', error);
      return {
        isValid: false,
        warnings: ['Validation service error'],
        recommendations: ['Check system connectivity and permissions'],
        availableSeats: 0,
        calculatedSeats: 0,
        efficiency: 0
      };
    }
  }

  /**
   * Validate all table groups for a company
   */
  static async validateAllGroupCapacities(
    companyId: string
  ): Promise<Array<{
    groupId: string;
    groupName: string;
    validation: CapacityValidationResult;
  }>> {
    try {
      const { data: groups, error } = await supabase
        .from('table_groups')
        .select('id, group_name')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error || !groups) {
        return [];
      }

      const validations = await Promise.all(
        groups.map(async (group) => ({
          groupId: group.id,
          groupName: group.group_name,
          validation: await this.validateGroupCapacity(group.id, companyId)
        }))
      );

      return validations;
    } catch (error) {
      console.error('Bulk validation error:', error);
      return [];
    }
  }

  /**
   * Get capacity validation summary for company
   */
  static async getValidationSummary(companyId: string): Promise<{
    totalGroups: number;
    validGroups: number;
    groupsWithWarnings: number;
    commonIssues: string[];
  }> {
    const validations = await this.validateAllGroupCapacities(companyId);
    
    const totalGroups = validations.length;
    const validGroups = validations.filter(v => v.validation.isValid).length;
    const groupsWithWarnings = validations.filter(v => v.validation.warnings.length > 0).length;

    // Collect common issues
    const allWarnings = validations.flatMap(v => v.validation.warnings);
    const warningCounts = allWarnings.reduce((acc, warning) => {
      acc[warning] = (acc[warning] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonIssues = Object.entries(warningCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([warning]) => warning);

    return {
      totalGroups,
      validGroups,
      groupsWithWarnings,
      commonIssues
    };
  }
}