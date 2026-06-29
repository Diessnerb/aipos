import { supabase } from '@/integrations/supabase/client';
import { SmartReservationAssignmentService } from './smartReservationAssignmentService';

interface AlternativeTimeResult {
  success: boolean;
  suggestedTime?: string;
  originalTime: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  timeDifference: number; // minutes from original time
  availabilityFactor: number; // 0-1 score of how good this time is
}

interface TimeSlotAnalysis {
  time: string;
  canAccommodate: boolean;
  optimizationRequired: boolean;
  backToBackPotential: boolean;
  availabilityScore: number;
  timeDifferenceMinutes: number;
}

export class AlternativeTimeService {
  /**
   * Find the best alternative time closest to the requested time
   * Analyzes ±2 hour window and considers optimization opportunities
   */
  static async findBestAlternativeTime(
    companyId: string,
    requestedDate: string,
    requestedTime: string,
    partySize: number,
    notes?: string
  ): Promise<AlternativeTimeResult> {
    console.log(`🕐 ALTERNATIVE TIME SEARCH: Looking for alternatives to ${requestedTime} for ${partySize} guests`);

    try {
      // Generate time slots in ±2 hour window (15-minute intervals)
      const timeSlots = this.generateTimeSlots(requestedTime, 120, 15);
      
      console.log(`📋 Generated ${timeSlots.length} time slots to analyze`);

      // Analyze each time slot
      const analyses: TimeSlotAnalysis[] = [];
      
      for (const timeSlot of timeSlots) {
        const analysis = await this.analyzeTimeSlot(
          companyId,
          requestedDate,
          timeSlot,
          partySize,
          notes
        );
        
        if (analysis.canAccommodate) {
          analyses.push(analysis);
        }
      }

      if (analyses.length === 0) {
        return {
          success: false,
          originalTime: requestedTime,
          reason: 'No alternative times found within 2-hour window',
          confidence: 'high',
          timeDifference: 0,
          availabilityFactor: 0
        };
      }

      // Sort by preference: back-to-back potential first, then by time difference, then by availability score
      analyses.sort((a, b) => {
        // Prioritize back-to-back booking opportunities
        if (a.backToBackPotential && !b.backToBackPotential) return -1;
        if (!a.backToBackPotential && b.backToBackPotential) return 1;
        
        // Then by time difference (closer to original time is better)
        if (Math.abs(a.timeDifferenceMinutes) !== Math.abs(b.timeDifferenceMinutes)) {
          return Math.abs(a.timeDifferenceMinutes) - Math.abs(b.timeDifferenceMinutes);
        }
        
        // Finally by availability score (higher is better)
        return b.availabilityScore - a.availabilityScore;
      });

      const bestAlternative = analyses[0];
      
      // Determine confidence based on time difference and optimization needs
      let confidence: 'high' | 'medium' | 'low';
      if (Math.abs(bestAlternative.timeDifferenceMinutes) <= 15) {
        confidence = 'high';
      } else if (Math.abs(bestAlternative.timeDifferenceMinutes) <= 45) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      // Build reason explanation
      let reason = `Available at ${bestAlternative.time}`;
      if (bestAlternative.backToBackPotential) {
        reason += ' (creates efficient back-to-back booking)';
      }
      if (bestAlternative.optimizationRequired) {
        reason += ' (with table optimization)';
      }

      console.log(`✅ BEST ALTERNATIVE: ${bestAlternative.time} (${bestAlternative.timeDifferenceMinutes}min difference, confidence: ${confidence})`);

      return {
        success: true,
        suggestedTime: bestAlternative.time,
        originalTime: requestedTime,
        reason,
        confidence,
        timeDifference: bestAlternative.timeDifferenceMinutes,
        availabilityFactor: bestAlternative.availabilityScore
      };

    } catch (error) {
      console.error('🚨 Alternative time search failed:', error);
      
      return {
        success: false,
        originalTime: requestedTime,
        reason: 'Alternative time search failed',
        confidence: 'low',
        timeDifference: 0,
        availabilityFactor: 0
      };
    }
  }

  /**
   * Analyze a specific time slot for accommodation potential
   */
  private static async analyzeTimeSlot(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string
  ): Promise<TimeSlotAnalysis> {
    // Check direct assignment
    const directResult = await SmartReservationAssignmentService.assignOptimalTables(
      companyId,
      date,
      time,
      partySize,
      notes
    );

    let canAccommodate = directResult.success;
    let optimizationRequired = false;
    let availabilityScore = directResult.success ? 1.0 : 0.0;

    // If direct fails, check with optimization
    if (!directResult.success) {
      const canOptimize = await SmartReservationAssignmentService.canOptimizeForAssignment(
        companyId,
        date,
        time,
        partySize
      );

      if (canOptimize) {
        canAccommodate = true;
        optimizationRequired = true;
        availabilityScore = 0.7; // Lower score for optimization-required slots
      }
    }

    // Check back-to-back potential
    const backToBackPotential = await this.checkBackToBackPotential(companyId, date, time);

    // Time difference calculation
    const timeDifferenceMinutes = this.calculateTimeDifference(time, time);

    return {
      time,
      canAccommodate,
      optimizationRequired,
      backToBackPotential,
      availabilityScore,
      timeDifferenceMinutes
    };
  }

  /**
   * Generate time slots around a target time
   */
  private static generateTimeSlots(
    targetTime: string,
    windowMinutes: number,
    intervalMinutes: number
  ): string[] {
    const slots: string[] = [];
    const [hours, minutes] = targetTime.split(':').map(Number);
    const targetMinutes = hours * 60 + minutes;
    
    const startMinutes = targetMinutes - windowMinutes;
    const endMinutes = targetMinutes + windowMinutes;
    
    for (let currentMinutes = startMinutes; currentMinutes <= endMinutes; currentMinutes += intervalMinutes) {
      // Skip the original time
      if (currentMinutes === targetMinutes) continue;
      
      // Ensure within valid day hours (9 AM to 11 PM)
      if (currentMinutes < 9 * 60 || currentMinutes > 23 * 60) continue;
      
      const slotHours = Math.floor(currentMinutes / 60);
      const slotMins = currentMinutes % 60;
      
      if (slotHours >= 0 && slotHours < 24) {
        const timeStr = `${slotHours.toString().padStart(2, '0')}:${slotMins.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    
    return slots;
  }

  /**
   * Check if a time slot creates back-to-back booking opportunities
   */
  private static async checkBackToBackPotential(
    companyId: string,
    date: string,
    time: string
  ): Promise<boolean> {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const timeMinutes = hours * 60 + minutes;
      
      // Check for reservations ending 30 minutes before this time
      const beforeTime = `${Math.floor((timeMinutes - 30) / 60).toString().padStart(2, '0')}:${((timeMinutes - 30) % 60).toString().padStart(2, '0')}`;
      
      // Check for reservations starting 2.5 hours after this time (standard 2h + 30min buffer)
      const afterTime = `${Math.floor((timeMinutes + 150) / 60).toString().padStart(2, '0')}:${((timeMinutes + 150) % 60).toString().padStart(2, '0')}`;
      
      const { data: surroundingReservations } = await supabase
        .from('reservations')
        .select('time, table_number, table_numbers')
        .eq('company_id', companyId)
        .eq('date', date)
        .in('status', ['confirmed', 'pending'])
        .or(`time.eq.${beforeTime},time.eq.${afterTime}`);

      // Back-to-back potential if there are reservations that would connect
      return (surroundingReservations?.length || 0) > 0;
      
    } catch (error) {
      console.error('Error checking back-to-back potential:', error);
      return false;
    }
  }

  /**
   * Calculate time difference in minutes
   */
  private static calculateTimeDifference(time1: string, time2: string): number {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    
    return minutes2 - minutes1;
  }

  /**
   * Format alternative time suggestion message
   */
  static formatAlternativeTimeMessage(result: AlternativeTimeResult): string {
    if (!result.success) {
      return `Sorry, no tables available at ${result.originalTime}. No alternative times found within 2 hours.`;
    }

    const timeDiff = Math.abs(result.timeDifference);
    const earlier = result.timeDifference < 0;
    
    let message = `Sorry, no tables available at ${result.originalTime}. `;
    
    if (timeDiff <= 15) {
      message += `We can accommodate you at ${result.suggestedTime} (${timeDiff} minute${timeDiff > 1 ? 's' : ''} ${earlier ? 'earlier' : 'later'}).`;
    } else if (timeDiff <= 45) {
      message += `We have availability at ${result.suggestedTime} (${timeDiff} minutes ${earlier ? 'earlier' : 'later'}).`;
    } else {
      message += `The closest available time is ${result.suggestedTime}.`;
    }

    return message;
  }
}