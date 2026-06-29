import { supabase } from '@/integrations/supabase/client';
import { ReservationAnalyticsService, PredictiveInsights } from './reservationAnalyticsService';
import { SmartAutoAssignmentService, AutoAssignmentResult } from './smartAutoAssignmentService';
import { format, addMinutes, addHours, isBefore, isAfter } from 'date-fns';

export interface AssignmentOption {
  tableNumbers: number[];
  totalSeats: number;
  opportunityCost: number;
  reasoning: string;
  confidence: number;
  strategy: string;
}

export interface PredictiveAssignmentResult extends AutoAssignmentResult {
  alternativeOptions?: AssignmentOption[];
  insights?: PredictiveInsights;
  riskAssessment?: string;
}

export class PredictiveAssignmentService {
  /**
   * Enhanced table assignment with predictive analytics
   */
  static async assignBestTableWithPrediction(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string
  ): Promise<PredictiveAssignmentResult> {
    const targetDate = new Date(date);
    const targetHour = parseInt(time.split(':')[0]);

    try {
      // Analyze accessibility needs using new detection utility
      const { analyzeAccessibilityNotes } = await import('../utils/accessibilityDetection');
      const accessibilityAnalysis = analyzeAccessibilityNotes(notes || '');
      
      // Get accessibility budget for smart assignment decisions
      let accessibilityBudget;
      try {
        const { getAccessibleBudget } = await import('../utils/accessibilityForecast');
        accessibilityBudget = await getAccessibleBudget(companyId, date, time);
      } catch (error) {
        console.error('Error getting accessibility budget:', error);
      }

      // Get predictive insights first
      const insights = await ReservationAnalyticsService.getPredictiveInsights(
        companyId,
        targetDate,
        targetHour
      );

      // Get operational tables - exclude out_of_service and temporarily_removed
      const { data: tables } = await supabase
        .from('tables')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('service_status', 'in', '(out_of_service,temporarily_removed)');

      if (!tables?.length) {
        return {
          success: false,
          message: 'No tables available',
          conflictsDetected: false
        };
      }

      // Generate assignment options 
      const assignmentOptions = await this.generateAssignmentOptions(
        companyId,
        tables,
        targetDate,
        time,
        partySize,
        insights
      );

      if (!tables || tables.length === 0) {
        return {
          success: false,
          message: 'No tables available',
          insights,
          riskAssessment: 'No table data available for analysis'
        };
      }

      // Get available table options with predictive scoring
      const options = await this.generateAssignmentOptions(
        companyId,
        tables,
        targetDate,
        time,
        partySize,
        insights
      );

      if (options.length === 0) {
        return {
          success: false,
          message: 'No suitable tables available for the requested time',
          insights,
          riskAssessment: 'All tables are occupied or unavailable'
        };
      }

      // Sort options by best score (lowest opportunity cost + highest confidence)
      const sortedOptions = options.sort((a, b) => {
        const scoreA = a.opportunityCost - (a.confidence * 0.5);
        const scoreB = b.opportunityCost - (b.confidence * 0.5);
        return scoreA - scoreB;
      });

      const bestOption = sortedOptions[0];

      // Generate risk assessment
      const riskAssessment = this.generateRiskAssessment(insights, bestOption, partySize);

      return {
        success: true,
        assignedTables: bestOption.tableNumbers,
        message: `Assigned tables ${bestOption.tableNumbers.join(', ')} with ${bestOption.strategy}`,
        alternativeOptions: sortedOptions.slice(1, 4), // Top 3 alternatives
        insights,
        riskAssessment
      };

    } catch (error) {
      console.error('Predictive assignment error:', error);
      
      // Fallback to basic assignment
      const fallback = await SmartAutoAssignmentService.assignBestTable(
        companyId,
        date,
        time,
        partySize,
        notes
      );

      return {
        ...fallback,
        riskAssessment: 'Fallback to basic assignment due to prediction error'
      };
    }
  }

  /**
   * Generate multiple assignment options with predictive scoring
   */
  private static async generateAssignmentOptions(
    companyId: string,
    tables: any[],
    targetDate: Date,
    time: string,
    partySize: number,
    insights: PredictiveInsights
  ): Promise<AssignmentOption[]> {
    const options: AssignmentOption[] = [];

    // Strategy 1: Exact fit tables
    const exactFitTables = tables.filter(t => t.seats === partySize);
    for (const table of exactFitTables) {
      if (await this.isTableAvailable(companyId, [table.table_number], targetDate, time)) {
        const cost = await ReservationAnalyticsService.calculateOpportunityCost(
          companyId,
          [table.table_number],
          targetDate,
          parseInt(time.split(':')[0]),
          partySize
        );

        options.push({
          tableNumbers: [table.table_number],
          totalSeats: table.seats,
          opportunityCost: cost.cost,
          reasoning: `Exact fit: ${cost.reasoning}`,
          confidence: insights.confidence,
          strategy: 'exact_fit'
        });
      }
    }

    // Strategy 2: Single larger table (with caution based on predictions)
    const largerTables = tables.filter(t => t.seats > partySize && t.seats <= partySize + 2);
    for (const table of largerTables) {
      if (await this.isTableAvailable(companyId, [table.table_number], targetDate, time)) {
        const cost = await ReservationAnalyticsService.calculateOpportunityCost(
          companyId,
          [table.table_number],
          targetDate,
          parseInt(time.split(':')[0]),
          partySize
        );

        // Penalize waste if large parties are likely
        const wastePenalty = insights.largePartyProbability > 0.3 ? 20 : 0;

        options.push({
          tableNumbers: [table.table_number],
          totalSeats: table.seats,
          opportunityCost: cost.cost + wastePenalty,
          reasoning: `Single larger table with ${table.seats - partySize} extra seats. ${cost.reasoning}`,
          confidence: insights.confidence * 0.8, // Reduced confidence for waste
          strategy: 'single_larger'
        });
      }
    }

    // Strategy 3: Table combinations (only if no good single options)
    if (options.length < 2 && partySize >= 4) {
      const combinations = this.generateTableCombinations(tables, partySize);
      
      for (const combination of combinations.slice(0, 3)) { // Limit to 3 combinations
        if (await this.isTableAvailable(companyId, combination, targetDate, time)) {
          const totalSeats = combination.reduce((sum, tableNum) => {
            const table = tables.find(t => t.table_number === tableNum);
            return sum + (table?.seats || 0);
          }, 0);

          const cost = await ReservationAnalyticsService.calculateOpportunityCost(
            companyId,
            combination,
            targetDate,
            parseInt(time.split(':')[0]),
            partySize
          );

          options.push({
            tableNumbers: combination,
            totalSeats,
            opportunityCost: cost.cost + 10, // Slight penalty for complexity
            reasoning: `Table combination: ${cost.reasoning}`,
            confidence: insights.confidence * 0.7, // Reduced confidence for combinations
            strategy: 'combination'
          });
        }
      }
    }

    return options;
  }

  /**
   * Check if tables are available at the specified time
   */
  private static async isTableAvailable(
    companyId: string,
    tableNumbers: number[],
    targetDate: Date,
    time: string
  ): Promise<boolean> {
    const startTime = new Date(`${format(targetDate, 'yyyy-MM-dd')}T${time}`);
    const endTime = addMinutes(startTime, 120); // 2 hour window

    const { data: conflicts } = await supabase
      .from('reservations')
      .select('id, table_number, table_numbers, time, date')
      .eq('company_id', companyId)
      .eq('date', format(targetDate, 'yyyy-MM-dd'))
      .not('status', 'in', '(cancelled,no-show)')
      .or(
        tableNumbers.map(num => `table_number.eq.${num},table_numbers.cs.{${num}}`).join(',')
      );

    if (!conflicts || conflicts.length === 0) return true;

    // Check for time overlaps
    return !conflicts.some(reservation => {
      const reservationStart = new Date(`${reservation.date}T${reservation.time}`);
      const reservationEnd = addMinutes(reservationStart, 120);

      return !(isAfter(startTime, reservationEnd) || isBefore(endTime, reservationStart));
    });
  }

  /**
   * Generate smart table combinations
   */
  private static generateTableCombinations(tables: any[], partySize: number): number[][] {
    const combinations: number[][] = [];
    const sortedTables = tables.sort((a, b) => a.seats - b.seats);

    // Try pairs first
    for (let i = 0; i < sortedTables.length - 1; i++) {
      for (let j = i + 1; j < sortedTables.length; j++) {
        const totalSeats = sortedTables[i].seats + sortedTables[j].seats;
        if (totalSeats >= partySize && totalSeats <= partySize + 4) {
          combinations.push([sortedTables[i].table_number, sortedTables[j].table_number]);
        }
      }
    }

    return combinations.slice(0, 5); // Limit combinations
  }

  /**
   * Generate risk assessment for assignment
   */
  private static generateRiskAssessment(
    insights: PredictiveInsights,
    option: AssignmentOption,
    partySize: number
  ): string {
    const risks: string[] = [];

    // Volume risk
    if (insights.growthAdjustedVolume > 1.3) {
      risks.push('High booking volume expected');
    }

    // Large party risk
    if (insights.largePartyProbability > 0.3 && option.totalSeats <= partySize + 1) {
      risks.push('May need larger tables for predicted group bookings');
    }

    // Seasonal risk
    if (insights.seasonalMultiplier > 1.4) {
      risks.push('Peak season - higher demand likely');
    }

    // Opportunity cost risk
    if (option.opportunityCost > 50) {
      risks.push('High opportunity cost - may limit future options');
    }

    // Confidence risk
    if (insights.confidence < 60) {
      risks.push('Limited historical data - predictions less reliable');
    }

    if (risks.length === 0) {
      return 'Low risk assignment with good predictive confidence';
    }

    return `Moderate risk: ${risks.join('; ')}`;
  }

  /**
   * Optimize existing reservations based on new predictions
   */
  static async optimizeExistingReservations(companyId: string, date: string): Promise<{
    movesSuggested: number;
    movesExecuted: number;
    details: string[];
  }> {
    const targetDate = new Date(date);
    const now = new Date();
    const cutoffTime = addMinutes(now, 30); // Don't move reservations starting within 30 minutes

    // Get all reservations for the date that aren't locked/imminent
    const { data: reservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('company_id', companyId)
      .eq('date', date)
      .eq('status', 'confirmed')
      .is('locked', false); // Assume we add a locked field later

    if (!reservations || reservations.length === 0) {
      return { movesSuggested: 0, movesExecuted: 0, details: [] };
    }

    const movesSuggested: any[] = [];
    const movesExecuted: any[] = [];
    const details: string[] = [];

    for (const reservation of reservations) {
      const reservationTime = new Date(`${date}T${reservation.time}`);
      
      // Skip if too close to start time
      if (isBefore(reservationTime, cutoffTime)) {
        continue;
      }

      try {
        // Get better assignment options
        const result = await this.assignBestTableWithPrediction(
          companyId,
          date,
          reservation.time,
          reservation.party_size
        );

        if (result.success && result.assignedTables) {
          const currentTables = reservation.table_numbers || [reservation.table_number];
          const suggestedTables = result.assignedTables;

          // Only suggest move if there's a significant improvement
          if (this.shouldSuggestMove(currentTables, suggestedTables, result)) {
            movesSuggested.push({
              reservationId: reservation.id,
              from: currentTables,
              to: suggestedTables,
              reason: result.riskAssessment
            });

            // For now, just log the suggestion - actual moves would need user approval
            details.push(
              `Suggest moving reservation ${reservation.customer_name} from table(s) ${currentTables.join(',')} to ${suggestedTables.join(',')} - ${result.riskAssessment}`
            );
          }
        }
      } catch (error) {
        console.error(`Error optimizing reservation ${reservation.id}:`, error);
      }
    }

    return {
      movesSuggested: movesSuggested.length,
      movesExecuted: 0, // Manual approval needed
      details
    };
  }

  private static shouldSuggestMove(
    currentTables: number[],
    suggestedTables: number[],
    result: PredictiveAssignmentResult
  ): boolean {
    // Don't suggest if tables are the same
    if (JSON.stringify(currentTables.sort()) === JSON.stringify(suggestedTables.sort())) {
      return false;
    }

    // Only suggest if there's a clear benefit
    const hasAlternatives = result.alternativeOptions && result.alternativeOptions.length > 0;
    const lowRisk = result.riskAssessment?.includes('Low risk') || false;
    const highConfidence = result.insights && result.insights.confidence > 70;

    return hasAlternatives && (lowRisk || highConfidence);
  }
}