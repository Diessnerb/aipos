import { supabase } from '@/integrations/supabase/client';

export interface VisualCapacityAnalysis {
  totalSeats: number;
  seatLoss: number;
  efficiencyScore: number;
  connectionPoints: Array<{ x: number; y: number; connected_to: string }>;
  isOptimal: boolean;
  recommendations: string[];
}

export interface GroupCapacityScenario {
  scenario_id: string;
  table_combination: number[];
  total_seats: number;
  seat_loss: number;
  efficiency_score: number;
  is_optimal: boolean;
  connection_strategy: string;
}

/**
 * Service for calculating real-world capacity using visual seat mapping data
 */
export class VisualCapacityService {
  /**
   * Calculate actual capacity for a table group using visual seat positions
   */
  static async calculateVisualCapacity(
    groupId: string,
    tableCombination: number[],
    companyId: string
  ): Promise<VisualCapacityAnalysis> {
    try {
      // Get visual seat positions for all tables in the combination
      const seatPositions = await Promise.all(
        tableCombination.map(tableNumber => this.getTableSeatPositions(companyId, tableNumber))
      );

      // Get connection points for the group
      const connectionPoints = await this.getGroupConnectionPoints(groupId);

      // Calculate seat loss based on actual visual connections
      const seatLoss = this.calculateRealSeatLoss(seatPositions, connectionPoints);
      
      // Calculate total seats
      const totalSeats = seatPositions.reduce((sum, positions) => sum + positions.length, 0) - seatLoss;
      
      // Calculate efficiency score (higher is better)
      const maxPossibleSeats = seatPositions.reduce((sum, positions) => sum + positions.length, 0);
      const efficiencyScore = (totalSeats / maxPossibleSeats) * 100;

      // Generate recommendations
      const recommendations = this.generateCapacityRecommendations(
        tableCombination,
        seatLoss,
        efficiencyScore,
        connectionPoints
      );

      return {
        totalSeats,
        seatLoss,
        efficiencyScore,
        connectionPoints,
        isOptimal: efficiencyScore >= 85, // Consider 85%+ as optimal
        recommendations
      };
    } catch (error) {
      console.error('Error calculating visual capacity:', error);
      throw error;
    }
  }

  /**
   * Get all capacity scenarios for a group using visual data
   */
  static async getVisualCapacityScenarios(
    groupId: string,
    companyId: string
  ): Promise<GroupCapacityScenario[]> {
    try {
      // Get existing scenarios from the database
      const { data: scenarios, error } = await supabase
        .from('group_seat_mappings')
        .select('*')
        .eq('group_id', groupId)
        .eq('company_id', companyId)
        .order('efficiency_score', { ascending: false });

      if (error) throw error;

      return (scenarios || []).map(scenario => {
        // Safely parse the table_combination JSON
        const tableCombination = scenario.table_combination as any;
        const tableNumbers = Array.isArray(tableCombination?.table_numbers) 
          ? tableCombination.table_numbers 
          : [];

        return {
          scenario_id: scenario.id,
          table_combination: tableNumbers,
          total_seats: scenario.total_seats,
          seat_loss: scenario.lost_seats || 0,
          efficiency_score: Number(scenario.efficiency_score) || 0,
          is_optimal: scenario.is_optimal || false,
          connection_strategy: scenario.scenario_name || 'default'
        };
      });
    } catch (error) {
      console.error('Error getting visual capacity scenarios:', error);
      return [];
    }
  }

  /**
   * Find optimal table combination for a party size using visual efficiency
   */
  static async findOptimalCombination(
    groupId: string,
    partySize: number,
    companyId: string
  ): Promise<GroupCapacityScenario | null> {
    try {
      const scenarios = await this.getVisualCapacityScenarios(groupId, companyId);
      
      // Filter scenarios that can accommodate the party size
      const suitableScenarios = scenarios.filter(scenario => 
        scenario.total_seats >= partySize
      );

      if (!suitableScenarios.length) return null;

      // Sort by efficiency score (highest first), then by seat count (smallest suitable)
      suitableScenarios.sort((a, b) => {
        const efficiencyDiff = b.efficiency_score - a.efficiency_score;
        if (Math.abs(efficiencyDiff) > 5) return efficiencyDiff; // Significant efficiency difference
        
        return a.total_seats - b.total_seats; // Prefer smaller tables if efficiency is similar
      });

      return suitableScenarios[0];
    } catch (error) {
      console.error('Error finding optimal combination:', error);
      return null;
    }
  }

  /**
   * Cache efficiency calculations for performance
   */
  private static efficiencyCache = new Map<string, { 
    data: VisualCapacityAnalysis; 
    timestamp: number 
  }>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static async getCachedVisualCapacity(
    groupId: string,
    tableCombination: number[],
    companyId: string
  ): Promise<VisualCapacityAnalysis> {
    const cacheKey = `${groupId}-${tableCombination.join(',')}-${companyId}`;
    const cached = this.efficiencyCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await this.calculateVisualCapacity(groupId, tableCombination, companyId);
    this.efficiencyCache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  }

  /**
   * Get visual seat positions for a table
   */
  private static async getTableSeatPositions(
    companyId: string,
    tableNumber: number
  ): Promise<Array<{ x: number; y: number; is_accessible: boolean }>> {
    try {
      // Since table_seat_positions doesn't exist, use tables data to generate positions
      const { data: tableData, error } = await supabase
        .from('tables')
        .select('seats, accessibility_friendly')
        .eq('company_id', companyId)
        .eq('table_number', tableNumber)
        .single();

      if (error || !tableData) {
        console.warn(`No table data found for table ${tableNumber}`);
        return [];
      }

      const seatCount = tableData.seats || 4;
      const isAccessible = tableData.accessibility_friendly || false;
      
      // Generate default seat positions based on table shape
      return Array.from({ length: seatCount }, (_, i) => ({
        x: 50 + (i % 4) * 50, // Arrange in rows of 4
        y: 50 + Math.floor(i / 4) * 50,
        is_accessible: isAccessible && i === 0 // First seat is accessible if table is accessible-friendly
      }));
    } catch (error) {
      console.error('Error getting seat positions:', error);
      return [];
    }
  }

  /**
   * Get connection points for a group
   */
  private static async getGroupConnectionPoints(
    groupId: string
  ): Promise<Array<{ x: number; y: number; connected_to: string }>> {
    try {
      const { data, error } = await supabase
        .from('group_seat_mappings')
        .select('connection_points')
        .eq('group_id', groupId)
        .eq('is_optimal', true)
        .single();

      if (error || !data?.connection_points) {
        return [];
      }

      // Safely parse connection points JSON
      const connectionPoints = data.connection_points;
      if (Array.isArray(connectionPoints)) {
        return connectionPoints
          .filter((point: any) => point && typeof point === 'object')
          .filter((point: any) => typeof point.x === 'number' && typeof point.y === 'number')
          .map((point: any) => ({
            x: point.x,
            y: point.y,
            connected_to: point.connected_to || ''
          }));
      }

      return [];
    } catch (error) {
      console.error('Error getting connection points:', error);
      return [];
    }
  }

  /**
   * Calculate actual seat loss based on visual connections
   */
  private static calculateRealSeatLoss(
    seatPositions: Array<Array<{ x: number; y: number; is_accessible: boolean }>>,
    connectionPoints: Array<{ x: number; y: number; connected_to: string }>
  ): number {
    if (seatPositions.length <= 1) return 0;

    // Each connection typically loses 1-2 seats depending on the visual layout
    const connectionCount = connectionPoints.length;
    const baseSeatsPerConnection = 1;

    // Additional seat loss for complex arrangements
    const complexityBonus = seatPositions.length > 3 ? Math.floor(seatPositions.length / 3) : 0;

    return Math.min(connectionCount * baseSeatsPerConnection + complexityBonus, 
                   seatPositions.reduce((sum, pos) => sum + pos.length, 0) * 0.3); // Max 30% loss
  }

  /**
   * Generate capacity improvement recommendations
   */
  private static generateCapacityRecommendations(
    tableCombination: number[],
    seatLoss: number,
    efficiencyScore: number,
    connectionPoints: Array<{ x: number; y: number; connected_to: string }>
  ): string[] {
    const recommendations: string[] = [];

    if (efficiencyScore < 70) {
      recommendations.push('Consider adjusting table arrangement to reduce seat loss');
    }

    if (seatLoss > tableCombination.length * 2) {
      recommendations.push('High seat loss detected - review connection points');
    }

    if (connectionPoints.length > tableCombination.length) {
      recommendations.push('Optimize connection strategy for better efficiency');
    }

    if (tableCombination.length > 4) {
      recommendations.push('Large combinations may impact service quality');
    }

    if (recommendations.length === 0) {
      recommendations.push('Optimal configuration - no changes needed');
    }

    return recommendations;
  }
}