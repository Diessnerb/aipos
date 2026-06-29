import { supabase } from "@/integrations/supabase/client";
import { AssignmentRule, Table, TableGroupWithTables } from "@/types/table";
import { Reservation } from "@/types/reservation";
import { offlineAwareInsert } from "@/utils/offlineAwareSupabase";

export interface RuleEvaluationContext {
  reservation: Reservation;
  availableTables: Table[];
  tableGroups: TableGroupWithTables[];
  currentTime: Date;
  companyId: string;
}

export interface TableScore {
  table: Table;
  score: number;
  appliedRules: string[];
  reasons: string[];
}

export interface AssignmentResult {
  success: boolean;
  assignedTables?: number[];
  score?: number;
  appliedRules?: string[];
  reasons?: string[];
  error?: string;
}

export class AssignmentRulesEngine {
  private rules: AssignmentRule[] = [];
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  async loadRules(): Promise<void> {
    const { data: rules, error } = await supabase
      .from('assignment_rules')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Failed to load assignment rules:', error);
      return;
    }

    this.rules = (rules || []) as AssignmentRule[];
  }

  async evaluateAssignment(context: RuleEvaluationContext): Promise<AssignmentResult> {
    await this.loadRules();

    const tableScores = await this.scoreAllTables(context);
    
    if (tableScores.length === 0) {
      return {
        success: false,
        error: 'No suitable tables available'
      };
    }

    // Sort by score (highest first)
    tableScores.sort((a, b) => b.score - a.score);

    const bestOption = tableScores[0];
    
    // Check if we need multiple tables for large parties
    if (context.reservation.party_size > bestOption.table.seats) {
      return await this.findMultiTableAssignment(context, tableScores);
    }

    return {
      success: true,
      assignedTables: [bestOption.table.table_number],
      score: bestOption.score,
      appliedRules: bestOption.appliedRules,
      reasons: bestOption.reasons
    };
  }

  private async scoreAllTables(context: RuleEvaluationContext): Promise<TableScore[]> {
    const scores: TableScore[] = [];

    for (const table of context.availableTables) {
      const score = await this.scoreTable(table, context);
      if (score.score > 0) {
        scores.push(score);
      }
    }

    return scores;
  }

  private async scoreTable(table: Table, context: RuleEvaluationContext): Promise<TableScore> {
    let totalScore = 0;
    const appliedRules: string[] = [];
    const reasons: string[] = [];

    // Base score based on table suitability
    const baseScore = this.calculateBaseScore(table, context.reservation);
    totalScore += baseScore;
    reasons.push(`Base suitability score: ${baseScore}`);

    // Apply rules
    for (const rule of this.rules) {
      if (this.evaluateRuleConditions(rule, table, context)) {
        const ruleScore = this.applyRuleActions(rule, table, context);
        totalScore += ruleScore;
        appliedRules.push(rule.rule_name);
        reasons.push(`${rule.rule_name}: +${ruleScore} points`);
      }
    }

    return {
      table,
      score: Math.max(0, totalScore),
      appliedRules,
      reasons
    };
  }

  private calculateBaseScore(table: Table, reservation: Reservation): number {
    let score = 50; // Base score

    // Perfect size match gets bonus
    if (table.seats === reservation.party_size) {
      score += 30;
    } else if (table.seats >= reservation.party_size) {
      // Penalty for oversized tables (waste of capacity)
      const wasteRatio = (table.seats - reservation.party_size) / table.seats;
      score -= Math.floor(wasteRatio * 20);
    } else {
      // Table too small - no base score
      return 0;
    }

    // Accessibility bonus
    if (this.hasAccessibilityNeeds(reservation) && table.accessibility_friendly) {
      score += 20;
    }

    return score;
  }

  private evaluateRuleConditions(rule: AssignmentRule, table: Table, context: RuleEvaluationContext): boolean {
    const conditions = rule.conditions;

    switch (rule.rule_type) {
      case 'time_based':
        return this.evaluateTimeConditions(conditions, context.currentTime, table);
      
      case 'party_size':
        return this.evaluatePartySizeConditions(conditions, context.reservation.party_size, table);
      
      case 'customer_type':
        return this.evaluateCustomerTypeConditions(conditions, context.reservation, table);
      
      case 'table_preference':
        return this.evaluateTablePreferenceConditions(conditions, table, context.reservation);
      
      default:
        return false;
    }
  }

  private evaluateTimeConditions(conditions: any, currentTime: Date, table: Table): boolean {
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();

    // First check time conditions
    if (conditions.hours && Array.isArray(conditions.hours)) {
      if (!conditions.hours.includes(hour)) return false;
    }

    if (conditions.days && Array.isArray(conditions.days)) {
      if (!conditions.days.includes(dayOfWeek)) return false;
    }

    // Then check if table meets criteria for this time-based rule
    if (conditions.preferred_table_types && Array.isArray(conditions.preferred_table_types)) {
      if (!table.type || !conditions.preferred_table_types.includes(table.type)) return false;
    }

    if (conditions.preferred_locations && Array.isArray(conditions.preferred_locations)) {
      if (!table.location || !conditions.preferred_locations.includes(table.location)) return false;
    }

    if (conditions.min_table_seats && table.seats < conditions.min_table_seats) return false;
    if (conditions.max_table_seats && table.seats > conditions.max_table_seats) return false;

    return true;
  }

  private evaluatePartySizeConditions(conditions: any, partySize: number, table: Table): boolean {
    // First check party size conditions
    if (conditions.min_size && partySize < conditions.min_size) return false;
    if (conditions.max_size && partySize > conditions.max_size) return false;
    if (conditions.exact_sizes && Array.isArray(conditions.exact_sizes)) {
      if (!conditions.exact_sizes.includes(partySize)) return false;
    }

    // Then check if table is suitable for this party size rule
    // Large party rules should only apply to appropriately sized tables
    if (conditions.requires_large_table && table.seats < partySize) return false;
    if (conditions.requires_exact_match && table.seats !== partySize) return false;
    
    // Small party rules should only apply to smaller tables
    if (conditions.requires_small_table && table.seats > partySize + 2) return false;

    if (conditions.preferred_table_types && Array.isArray(conditions.preferred_table_types)) {
      if (!table.type || !conditions.preferred_table_types.includes(table.type)) return false;
    }

    return true;
  }

  private evaluateCustomerTypeConditions(conditions: any, reservation: Reservation, table: Table): boolean {
    // Check for VIP status in notes or customer data
    if (conditions.vip_only && !this.isVipReservation(reservation)) return false;
    
    // Check for accessibility needs
    if (conditions.accessibility_required && !this.hasAccessibilityNeeds(reservation)) return false;

    // Now check if table is suitable for this customer type
    if (conditions.vip_only) {
      // VIP rules should only apply to premium tables
      if (conditions.requires_premium_table) {
        if (!this.isPremiumTable(table)) return false;
      }
    }

    if (conditions.accessibility_required) {
      // Accessibility rules should only apply to accessible tables
      if (!table.accessibility_friendly) return false;
    }

    if (conditions.preferred_table_types && Array.isArray(conditions.preferred_table_types)) {
      if (!table.type || !conditions.preferred_table_types.includes(table.type)) return false;
    }

    if (conditions.preferred_locations && Array.isArray(conditions.preferred_locations)) {
      if (!table.location || !conditions.preferred_locations.includes(table.location)) return false;
    }
    
    return true;
  }

  private evaluateTablePreferenceConditions(conditions: any, table: Table, reservation: Reservation): boolean {
    // Check table properties first
    if (conditions.preferred_locations && Array.isArray(conditions.preferred_locations)) {
      if (!table.location || !conditions.preferred_locations.includes(table.location)) return false;
    }

    if (conditions.table_types && Array.isArray(conditions.table_types)) {
      if (!table.type || !conditions.table_types.includes(table.type)) return false;
    }

    if (conditions.min_seats && table.seats < conditions.min_seats) return false;
    if (conditions.max_seats && table.seats > conditions.max_seats) return false;

    // Now check if reservation context matches this table preference
    if (conditions.requires_vip && !this.isVipReservation(reservation)) return false;
    if (conditions.requires_accessibility && !this.hasAccessibilityNeeds(reservation)) return false;
    
    if (conditions.party_size_range) {
      const partySize = reservation.party_size;
      if (conditions.party_size_range.min && partySize < conditions.party_size_range.min) return false;
      if (conditions.party_size_range.max && partySize > conditions.party_size_range.max) return false;
    }

    return true;
  }

  private applyRuleActions(rule: AssignmentRule, table: Table, context: RuleEvaluationContext): number {
    const actions = rule.actions;
    let scoreModifier = 0;

    if (actions.score_modifier) {
      scoreModifier += actions.score_modifier;
    }

    if (actions.priority_boost && actions.priority_boost > 0) {
      scoreModifier += actions.priority_boost * 10;
    }

    return scoreModifier;
  }

  private async findMultiTableAssignment(
    context: RuleEvaluationContext,
    tableScores: TableScore[]
  ): Promise<AssignmentResult> {
    const { reservation } = context;
    const neededSeats = reservation.party_size;

    // Try to find combination of tables
    for (let i = 0; i < tableScores.length; i++) {
      const primaryTable = tableScores[i];
      let totalSeats = primaryTable.table.seats;
      const selectedTables = [primaryTable.table.table_number];
      const allReasons = [...primaryTable.reasons];
      const allRules = [...primaryTable.appliedRules];

      if (totalSeats >= neededSeats) continue; // Single table is enough

      // Try to add more tables
      for (let j = i + 1; j < tableScores.length && totalSeats < neededSeats; j++) {
        const additionalTable = tableScores[j];
        
        // Check if tables can be combined (proximity, combinability)
        if (this.canCombineTables(primaryTable.table, additionalTable.table)) {
          totalSeats += additionalTable.table.seats;
          selectedTables.push(additionalTable.table.table_number);
          allReasons.push(...additionalTable.reasons);
          allRules.push(...additionalTable.appliedRules);
          
          if (totalSeats >= neededSeats) {
            return {
              success: true,
              assignedTables: selectedTables,
              score: primaryTable.score + tableScores[j].score,
              appliedRules: [...new Set(allRules)],
              reasons: allReasons
            };
          }
        }
      }
    }

    return {
      success: false,
      error: `Cannot find suitable table combination for party of ${neededSeats}`
    };
  }

  private canCombineTables(table1: Table, table2: Table): boolean {
    // Check if both tables allow combining
    if (!table1.can_combine || !table2.can_combine) return false;
    
    // Check if they're in the same location
    if (table1.location !== table2.location) return false;
    
    // Additional proximity checks could be added here
    return true;
  }

  private isPremiumTable(table: Table): boolean {
    return table.vip_status || 
           table.type === 'VIP' || 
           table.ambiance === 'upscale' ||
           table.table_name?.toLowerCase().includes('premium') ||
           table.description?.toLowerCase().includes('vip');
  }

  private isWindowTable(table: Table): boolean {
    return table.window_seating ||
           table.table_name?.toLowerCase().includes('window') ||
           table.description?.toLowerCase().includes('window') ||
           table.location?.toLowerCase().includes('window');
  }

  private hasAccessibilityNeeds(reservation: Reservation): boolean {
    if (!reservation.notes) return false;
    
    const accessibilityKeywords = [
      'wheelchair', 'disabled', 'accessibility', 'accessible', 'mobility',
      'walker', 'crutches', 'disability', 'special needs', 'impaired',
      'handicap', 'assistance', 'ramp'
    ];
    
    const notes = reservation.notes.toLowerCase();
    return accessibilityKeywords.some(keyword => notes.includes(keyword));
  }

  private isVipReservation(reservation: Reservation): boolean {
    if (!reservation.notes) return false;
    const notes = reservation.notes.toLowerCase();
    return notes.includes('vip') || notes.includes('priority') || notes.includes('special');
  }

  private isBusinessReservation(reservation: any): boolean {
    return reservation.notes?.toLowerCase().includes('business') ||
           reservation.notes?.toLowerCase().includes('meeting') ||
           reservation.notes?.toLowerCase().includes('corporate');
  }

  private isRomanticReservation(reservation: any): boolean {
    return reservation.notes?.toLowerCase().includes('romantic') ||
           reservation.notes?.toLowerCase().includes('anniversary') ||
           reservation.notes?.toLowerCase().includes('date') ||
           reservation.notes?.toLowerCase().includes('proposal');
  }

  async logAssignmentHistory(
    reservationId: string,
    assignedTables: number[],
    strategy: string,
    success: boolean,
    conflictDetected: boolean,
    ruleApplied?: string
  ): Promise<void> {
    await offlineAwareInsert('assignment_history', {
      reservation_id: reservationId,
      assigned_tables: assignedTables,
      assignment_strategy: strategy,
      success,
      conflict_detected: conflictDetected,
      rule_applied: ruleApplied,
      company_id: this.companyId
    });
  }
}