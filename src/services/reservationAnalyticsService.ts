import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, isSameWeek, format, getWeek, getYear } from 'date-fns';

export interface ReservationPattern {
  id: string;
  company_id: string;
  day_of_week: number;
  hour_of_day: number;
  party_size: number;
  week_of_year: number;
  year: number;
  frequency_count: number;
}

export interface SeasonalAdjustment {
  id: string;
  company_id: string;
  season_type: string;
  week_range: number[];
  party_size_multiplier: number;
  volume_multiplier: number;
  large_party_probability: number;
  is_active: boolean;
}

export interface CompanyGrowthMetrics {
  id: string;
  company_id: string;
  metric_date: string;
  total_reservations: number;
  total_covers: number;
  peak_hour_reservations: number;
  average_party_size: number;
}

export interface PredictiveInsights {
  expectedBookings: number;
  expectedPartySize: number;
  largePartyProbability: number;
  growthAdjustedVolume: number;
  seasonalMultiplier: number;
  confidence: number; // 0-100%
}

export class ReservationAnalyticsService {
  /**
   * Get predictive insights for a specific date and time
   */
  static async getPredictiveInsights(
    companyId: string, 
    targetDate: Date, 
    targetHour: number
  ): Promise<PredictiveInsights> {
    const dayOfWeek = targetDate.getDay();
    const weekOfYear = getWeek(targetDate);
    const year = getYear(targetDate);
    
    // Get historical patterns for this day/hour combination
    const { data: patterns } = await supabase
      .from('reservation_patterns')
      .select('*')
      .eq('company_id', companyId)
      .eq('day_of_week', dayOfWeek)
      .eq('hour_of_day', targetHour);

    // Get seasonal adjustments that apply to this week
    const { data: seasonalAdjustments } = await supabase
      .from('seasonal_adjustments')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .filter('week_range', 'cs', `{${weekOfYear}}`);

    // Get growth metrics for trend analysis
    const { data: growthMetrics } = await supabase
      .from('company_growth_metrics')
      .select('*')
      .eq('company_id', companyId)
      .order('metric_date', { ascending: false })
      .limit(90); // Last 90 days

    return this.calculatePredictiveInsights(
      patterns || [],
      seasonalAdjustments || [],
      growthMetrics || [],
      { targetDate, targetHour, dayOfWeek, weekOfYear, year }
    );
  }

  /**
   * Calculate opportunity cost for a table assignment
   */
  static async calculateOpportunityCost(
    companyId: string,
    tableNumbers: number[],
    targetDate: Date,
    targetHour: number,
    partySize: number
  ): Promise<{ cost: number; reasoning: string }> {
    // Get table capacities
    const { data: tables } = await supabase
      .from('tables')
      .select('table_number, seats')
      .eq('company_id', companyId)
      .in('table_number', tableNumbers);

    if (!tables || tables.length === 0) {
      return { cost: 0, reasoning: 'No table data available' };
    }

    const totalSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    const seatWaste = totalSeats - partySize;

    // Get predictive insights for the next few hours
    const insights = await this.getPredictiveInsights(companyId, targetDate, targetHour);
    
    // Calculate cost based on wasted seats and probability of needing larger tables
    const wasteScore = (seatWaste / totalSeats) * 100;
    const demandRisk = insights.largePartyProbability * 100;
    const volumeRisk = insights.growthAdjustedVolume > 1 ? (insights.growthAdjustedVolume - 1) * 50 : 0;

    const totalCost = wasteScore + demandRisk + volumeRisk;

    let reasoning = `Seat waste: ${seatWaste} seats (${wasteScore.toFixed(1)}% waste). `;
    reasoning += `Large party risk: ${demandRisk.toFixed(1)}%. `;
    reasoning += `Volume pressure: +${volumeRisk.toFixed(1)}%.`;

    return { cost: totalCost, reasoning };
  }

  /**
   * Log table assignment analytics for learning
   */
  static async logTableAssignment(
    companyId: string,
    reservationId: string,
    assignedTableNumbers: number[],
    partySize: number,
    assignmentStrategy: string,
    opportunityCost: number,
    date: Date,
    time: string
  ): Promise<void> {
    const utilizationEfficiency = this.calculateUtilizationEfficiency(
      assignedTableNumbers,
      partySize,
      companyId
    );

    await supabase
      .from('table_utilization_analytics')
      .insert({
        company_id: companyId,
        reservation_id: reservationId,
        assigned_table_numbers: assignedTableNumbers,
        party_size: partySize,
        assignment_strategy: assignmentStrategy,
        opportunity_cost_score: opportunityCost,
        utilization_efficiency: await utilizationEfficiency,
        assignment_date: format(date, 'yyyy-MM-dd'),
        assignment_time: time
      });
  }

  /**
   * Log manual table move for feedback learning
   */
  static async logManualTableMove(
    companyId: string,
    reservationId: string,
    oldTableNumbers: number[] | null,
    newTableNumbers: number[],
    staffUserId: string | null,
    feedbackReasons: string[],
    additionalNotes?: string
  ): Promise<void> {
    await supabase
      .from('manual_override_feedback')
      .insert({
        company_id: companyId,
        reservation_id: reservationId,
        old_table_numbers: oldTableNumbers,
        new_table_numbers: newTableNumbers,
        staff_user_id: staffUserId,
        feedback_reasons: feedbackReasons,
        additional_notes: additionalNotes
      });
  }

  /**
   * Get assignment effectiveness metrics for a company
   */
  static async getAssignmentEffectiveness(companyId: string, days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: analytics } = await supabase
      .from('table_utilization_analytics')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', cutoffDate.toISOString());

    const { data: overrides } = await supabase
      .from('manual_override_feedback')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', cutoffDate.toISOString());

    if (!analytics || !overrides) return null;

    const totalAssignments = analytics.length;
    const manualMoves = overrides.length;
    const manualMoveRate = totalAssignments > 0 ? (manualMoves / totalAssignments) * 100 : 0;

    const avgUtilization = analytics.reduce((sum, a) => sum + (a.utilization_efficiency || 0), 0) / totalAssignments;
    const avgOpportunityCost = analytics.reduce((sum, a) => sum + (a.opportunity_cost_score || 0), 0) / totalAssignments;

    // Analyze feedback reasons
    const reasonCounts = overrides.reduce((acc, override) => {
      (override.feedback_reasons || []).forEach(reason => {
        acc[reason] = (acc[reason] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAssignments,
      manualMoves,
      manualMoveRate,
      avgUtilization,
      avgOpportunityCost,
      topMoveReasons: Object.entries(reasonCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }))
    };
  }

  private static calculatePredictiveInsights(
    patterns: ReservationPattern[],
    seasonalAdjustments: SeasonalAdjustment[],
    growthMetrics: CompanyGrowthMetrics[],
    context: { targetDate: Date; targetHour: number; dayOfWeek: number; weekOfYear: number; year: number }
  ): PredictiveInsights {
    // Calculate base expectations from historical patterns
    let expectedBookings = 0;
    let totalPartySize = 0;
    let largePartyCount = 0;
    let totalCount = 0;

    // Weight patterns based on recency and seasonal similarity  
    patterns.forEach(pattern => {
      const ageWeight = this.calculateAgeWeight(pattern.year, context.year);
      const seasonWeight = this.calculateSeasonalWeight(pattern.week_of_year, context.weekOfYear);
      const weight = ageWeight * seasonWeight * pattern.frequency_count;

      expectedBookings += weight;
      totalPartySize += pattern.party_size * weight;
      if (pattern.party_size >= 6) largePartyCount += weight;
      totalCount += weight;
    });

    const expectedPartySize = totalCount > 0 ? totalPartySize / totalCount : 2.5;
    const baseLargePartyProbability = totalCount > 0 ? largePartyCount / totalCount : 0.15;

    // Apply seasonal adjustments
    let seasonalMultiplier = 1.0;
    let adjustedLargePartyProbability = baseLargePartyProbability;

    seasonalAdjustments.forEach(adjustment => {
      seasonalMultiplier *= adjustment.volume_multiplier;
      adjustedLargePartyProbability = Math.min(1.0, 
        adjustedLargePartyProbability + adjustment.large_party_probability
      );
    });

    // Calculate growth adjustment
    const growthMultiplier = this.calculateGrowthMultiplier(growthMetrics, context.targetDate);

    const confidence = this.calculateConfidence(patterns.length, totalCount, growthMetrics.length);

    return {
      expectedBookings: expectedBookings * seasonalMultiplier,
      expectedPartySize,
      largePartyProbability: adjustedLargePartyProbability,
      growthAdjustedVolume: seasonalMultiplier * growthMultiplier,
      seasonalMultiplier,
      confidence
    };
  }

  private static calculateAgeWeight(patternYear: number, currentYear: number): number {
    const yearDiff = currentYear - patternYear;
    // Recent years get higher weight
    return Math.max(0.1, 1 - (yearDiff * 0.3));
  }

  private static calculateSeasonalWeight(patternWeek: number, currentWeek: number): number {
    const weekDiff = Math.abs(currentWeek - patternWeek);
    const adjustedDiff = Math.min(weekDiff, 52 - weekDiff); // Handle year wrap
    // Same week gets weight 1, weight decreases as weeks differ
    return Math.max(0.1, 1 - (adjustedDiff * 0.02));
  }

  private static calculateGrowthMultiplier(metrics: CompanyGrowthMetrics[], targetDate: Date): number {
    if (metrics.length < 30) return 1.0; // Need at least 30 days of data

    // Calculate growth trend over last 30 vs previous 30 days
    const recent = metrics.slice(0, 30);
    const previous = metrics.slice(30, 60);

    if (previous.length < 30) return 1.0;

    const recentAvg = recent.reduce((sum, m) => sum + m.total_reservations, 0) / recent.length;
    const previousAvg = previous.reduce((sum, m) => sum + m.total_reservations, 0) / previous.length;

    const growthRate = previousAvg > 0 ? recentAvg / previousAvg : 1.0;
    
    // Cap growth multiplier between 0.5 and 2.0
    return Math.max(0.5, Math.min(2.0, growthRate));
  }

  private static calculateConfidence(patternCount: number, totalWeight: number, metricDays: number): number {
    // Confidence based on data availability
    let confidence = 0;
    
    // Pattern confidence (40% weight)
    confidence += Math.min(40, patternCount * 2);
    
    // Weight confidence (30% weight) 
    confidence += Math.min(30, totalWeight);
    
    // Metrics confidence (30% weight)
    confidence += Math.min(30, metricDays);
    
    return Math.min(100, confidence);
  }

  private static async calculateUtilizationEfficiency(
    assignedTableNumbers: number[],
    partySize: number,
    companyId: string
  ): Promise<number> {
    const { data: tables } = await supabase
      .from('tables')
      .select('seats')
      .eq('company_id', companyId)
      .in('table_number', assignedTableNumbers);

    if (!tables || tables.length === 0) return 0;

    const totalSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    return totalSeats > 0 ? (partySize / totalSeats) * 100 : 0;
  }
}