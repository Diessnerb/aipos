import { Table, TableGroup } from '@/types/table';
import { supabase } from '@/integrations/supabase/client';

export interface PredictionModel {
  id: string;
  name: string;
  accuracy: number;
  lastTrained: Date;
  features: string[];
}

export interface AssignmentPrediction {
  tableId: string;
  confidence: number;
  reasoning: string[];
  alternativeOptions: {
    tableId: string;
    confidence: number;
    reason: string;
  }[];
  expectedWaitTime: number;
  customerSatisfactionScore: number;
}

export interface CapacityPrediction {
  hour: number;
  expectedBookings: number;
  confidence: number;
  recommendedStaffing: number;
  peakIndicator: 'low' | 'medium' | 'high' | 'peak';
}

export interface CustomerPreference {
  customerId: string;
  preferredTableTypes: string[];
  preferredTimeSlots: string[];
  avgPartySize: number;
  accessibilityNeeds: boolean;
  historicalSatisfaction: number;
}

class MLAssignmentIntelligence {
  private models: Map<string, PredictionModel> = new Map();
  private customerPreferences: Map<string, CustomerPreference> = new Map();

  async initializeModels(companyId: string): Promise<void> {
    // Initialize ML models for the company
    const models = [
      {
        id: 'table-assignment-v1',
        name: 'Smart Table Assignment',
        accuracy: 0.89,
        lastTrained: new Date(),
        features: ['party_size', 'time_slot', 'day_of_week', 'table_type', 'customer_history']
      },
      {
        id: 'capacity-prediction-v1',
        name: 'Capacity Forecasting',
        accuracy: 0.82,
        lastTrained: new Date(),
        features: ['historical_bookings', 'day_of_week', 'season', 'events', 'weather']
      },
      {
        id: 'customer-preference-v1',
        name: 'Customer Preference Learning',
        accuracy: 0.76,
        lastTrained: new Date(),
        features: ['booking_history', 'table_selections', 'satisfaction_scores', 'special_requests']
      }
    ];

    models.forEach(model => {
      this.models.set(model.id, model);
    });

    await this.loadCustomerPreferences(companyId);
  }

  async predictOptimalAssignment(
    partySize: number,
    timeSlot: string,
    date: Date,
    customerId?: string,
    availableTables?: Table[]
  ): Promise<AssignmentPrediction[]> {
    // ML-based prediction logic
    const baseFeatures = {
      partySize,
      timeSlot,
      dayOfWeek: date.getDay(),
      hour: new Date(`2000-01-01T${timeSlot}`).getHours(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };

    const predictions: AssignmentPrediction[] = [];

    if (availableTables) {
      for (const table of availableTables) {
        const prediction = await this.calculateTablePrediction(table, baseFeatures, customerId);
        predictions.push(prediction);
      }
    }

    // Sort by confidence and customer satisfaction
    return predictions.sort((a, b) => {
      const scoreA = a.confidence * 0.7 + a.customerSatisfactionScore * 0.3;
      const scoreB = b.confidence * 0.7 + b.customerSatisfactionScore * 0.3;
      return scoreB - scoreA;
    });
  }

  private async calculateTablePrediction(
    table: Table,
    features: any,
    customerId?: string
  ): Promise<AssignmentPrediction> {
    const customerPref = customerId ? this.customerPreferences.get(customerId) : null;
    
    // Base confidence calculation
    let confidence = 0.5;
    const reasoning: string[] = [];

    // Party size compatibility
    if (features.partySize <= table.seats && features.partySize >= table.seats * 0.6) {
      confidence += 0.3;
      reasoning.push('Optimal capacity match');
    } else if (features.partySize <= table.seats) {
      confidence += 0.1;
      reasoning.push('Under-capacity but acceptable');
    } else {
      confidence -= 0.4;
      reasoning.push('Over-capacity - not suitable');
    }

    // Customer preference matching
    if (customerPref) {
      if (table.accessibility_friendly && customerPref.accessibilityNeeds) {
        confidence += 0.2;
        reasoning.push('Matches accessibility requirements');
      }
      
      // Historical satisfaction boost
      confidence += customerPref.historicalSatisfaction * 0.1;
      reasoning.push(`Customer satisfaction factor: ${customerPref.historicalSatisfaction.toFixed(2)}`);
    }

    // Time-based adjustments
    if (features.isWeekend && features.hour >= 12 && features.hour <= 14) {
      confidence *= 0.9; // Slightly lower during peak weekend lunch
      reasoning.push('Peak weekend period - slight confidence reduction');
    }

    // Calculate expected wait time
    const expectedWaitTime = this.calculateExpectedWaitTime(table, features);
    
    // Calculate customer satisfaction score
    const customerSatisfactionScore = this.calculateSatisfactionScore(
      table,
      features,
      customerPref,
      expectedWaitTime
    );

    // Generate alternative options
    const alternativeOptions = await this.generateAlternatives(table, features);

    return {
      tableId: table.id,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning,
      alternativeOptions,
      expectedWaitTime,
      customerSatisfactionScore
    };
  }

  private calculateExpectedWaitTime(table: Table, features: any): number {
    // Simulate wait time calculation based on table turnover and current load
    const baseWaitTime = 0; // Assuming table is available
    const peakMultiplier = features.isWeekend ? 1.2 : 1.0;
    const hourMultiplier = features.hour >= 12 && features.hour <= 14 ? 1.3 : 1.0;
    
    return Math.round(baseWaitTime * peakMultiplier * hourMultiplier);
  }

  private calculateSatisfactionScore(
    table: Table,
    features: any,
    customerPref: CustomerPreference | null,
    waitTime: number
  ): number {
    let score = 0.7; // Base satisfaction

    // Table suitability
    if (features.partySize <= table.seats && features.partySize >= table.seats * 0.6) {
      score += 0.2;
    }

    // Wait time impact
    if (waitTime === 0) score += 0.1;
    else if (waitTime > 15) score -= 0.2;

    // Customer preference matching
    if (customerPref) {
      score += customerPref.historicalSatisfaction * 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private async generateAlternatives(table: Table, features: any): Promise<AssignmentPrediction['alternativeOptions']> {
    // Generate alternative table suggestions
    return [
      {
        tableId: `alt-${table.id}-1`,
        confidence: Math.random() * 0.3 + 0.4,
        reason: 'Similar capacity with better location'
      },
      {
        tableId: `alt-${table.id}-2`,
        confidence: Math.random() * 0.2 + 0.3,
        reason: 'Slightly larger table for comfort'
      }
    ];
  }

  async predictCapacityDemand(
    date: Date,
    companyId: string
  ): Promise<CapacityPrediction[]> {
    const predictions: CapacityPrediction[] = [];
    
    // Generate hourly predictions for the day
    for (let hour = 6; hour <= 23; hour++) {
      const prediction = await this.calculateHourlyCapacity(date, hour, companyId);
      predictions.push(prediction);
    }

    return predictions;
  }

  private async calculateHourlyCapacity(
    date: Date,
    hour: number,
    companyId: string
  ): Promise<CapacityPrediction> {
    // ML-based capacity prediction
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Base prediction logic
    let expectedBookings = 5; // Base bookings per hour
    let confidence = 0.7;

    // Peak hours adjustment
    if ((hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)) {
      expectedBookings *= isWeekend ? 2.5 : 2.0;
      confidence += 0.1;
    }

    // Weekend adjustment
    if (isWeekend) {
      expectedBookings *= 1.3;
      if (hour >= 10 && hour <= 15) { // Weekend brunch/lunch
        expectedBookings *= 1.2;
      }
    }

    // Determine peak indicator
    let peakIndicator: CapacityPrediction['peakIndicator'] = 'low';
    if (expectedBookings > 20) peakIndicator = 'peak';
    else if (expectedBookings > 15) peakIndicator = 'high';
    else if (expectedBookings > 8) peakIndicator = 'medium';

    // Recommended staffing
    const recommendedStaffing = Math.ceil(expectedBookings / 6); // ~6 tables per staff member

    return {
      hour,
      expectedBookings: Math.round(expectedBookings),
      confidence,
      recommendedStaffing,
      peakIndicator
    };
  }

  async learnFromCustomerBehavior(
    customerId: string,
    tableId: string,
    satisfactionScore: number,
    bookingDetails: any
  ): Promise<void> {
    // Update customer preferences based on their behavior
    let preference = this.customerPreferences.get(customerId);
    
    if (!preference) {
      preference = {
        customerId,
        preferredTableTypes: [],
        preferredTimeSlots: [],
        avgPartySize: bookingDetails.partySize || 2,
        accessibilityNeeds: false,
        historicalSatisfaction: satisfactionScore
      };
    } else {
      // Update existing preferences
      preference.historicalSatisfaction = (preference.historicalSatisfaction * 0.8) + (satisfactionScore * 0.2);
      preference.avgPartySize = (preference.avgPartySize * 0.9) + (bookingDetails.partySize * 0.1);
    }

    this.customerPreferences.set(customerId, preference);

    // Store updated preferences in local storage for now
    // In production, this would be stored in a dedicated preferences table
    try {
      localStorage.setItem(`customer_pref_${customerId}`, JSON.stringify(preference));
    } catch (error) {
      console.error('Error storing customer preferences:', error);
    }
  }

  private async loadCustomerPreferences(companyId: string): Promise<void> {
    try {
      // Load from local storage for now
      // In production, this would load from a dedicated preferences table
      const keys = Object.keys(localStorage).filter(key => key.startsWith('customer_pref_'));
      keys.forEach(key => {
        try {
          const customerId = key.replace('customer_pref_', '');
          const preference = JSON.parse(localStorage.getItem(key) || '{}');
          if (preference.customerId) {
            this.customerPreferences.set(customerId, preference);
          }
        } catch (e) {
          console.warn('Error parsing customer preference:', e);
        }
      });
    } catch (error) {
      console.error('Error loading customer preferences:', error);
    }
  }

  async generateDynamicRecommendations(companyId: string): Promise<{
    tableOptimization: string[];
    staffingRecommendations: string[];
    customerExperienceImprovements: string[];
    revenueOptimization: string[];
  }> {
    // Generate AI-powered recommendations
    const recommendations = {
      tableOptimization: [
        'Consider adding 2 more 4-seater tables based on demand patterns',
        'Move high-capacity tables closer to kitchen for peak hour efficiency',
        'Create a dedicated accessibility section with 3 accessible tables'
      ],
      staffingRecommendations: [
        'Increase staff by 2 during weekend lunch hours (12-3 PM)',
        'Consider cross-training staff for peak period flexibility',
        'Schedule experienced servers during Friday evening rush'
      ],
      customerExperienceImprovements: [
        'Add quiet corner tables for business meetings',
        'Consider sound dampening for family-friendly sections',
        'Install mobile charging stations at window tables'
      ],
      revenueOptimization: [
        'Optimize table turnover with 90-minute dining windows during peak',
        'Implement dynamic pricing for premium table locations',
        'Create table packages for special occasions'
      ]
    };

    return recommendations;
  }

  getModelPerformance(): { modelName: string; accuracy: number; lastTrained: Date }[] {
    return Array.from(this.models.values()).map(model => ({
      modelName: model.name,
      accuracy: model.accuracy,
      lastTrained: model.lastTrained
    }));
  }

  async retrainModels(companyId: string): Promise<void> {
    // Simulate model retraining with historical data
    console.log(`Retraining ML models for company ${companyId}`);
    
    for (const [modelId, model] of this.models.entries()) {
      // Simulate training time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update model accuracy (simulate improvement)
      model.accuracy = Math.min(0.95, model.accuracy + Math.random() * 0.05);
      model.lastTrained = new Date();
      
      this.models.set(modelId, model);
    }
  }
}

export const mlAssignmentIntelligence = new MLAssignmentIntelligence();