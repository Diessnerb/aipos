import { supabase } from '@/integrations/supabase/client';
import { analyzeAccessibilityNotes } from './accessibilityDetection';

export interface AccessibilityBudget {
  budget: number;           // How many accessible tables can be assigned now
  recommendedSpare: number; // How many to keep in reserve
  capacity: number;         // Total accessible table capacity
  expectedDemand: number;   // Expected accessibility demand for this time
  confidence: 'high' | 'medium' | 'low';
  spareTarget?: number;     // Company's configured spare target
}

// In-memory cache to avoid repeated queries during a session
const forecastCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get total accessible table capacity for a company
 */
export async function getAccessibleCapacity(companyId: string): Promise<number> {
  try {
    const { data: tables, error } = await supabase
      .from('tables')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('accessibility_friendly', true)
      .neq('is_high_top', true); // Exclude high-tops from accessible capacity
    
    if (error) {
      console.error('Error fetching accessible capacity:', error);
      return 0;
    }
    
    return tables?.length || 0;
  } catch (error) {
    console.error('Error getting accessible capacity:', error);
    return 0;
  }
}

/**
 * Estimate accessibility demand for a specific date and time window
 */
export async function estimateAccessibleDemand(
  companyId: string, 
  date: string, 
  time: string
): Promise<{ expectedDemand: number; currentlyAssigned: number; confidence: 'high' | 'medium' | 'low' }> {
  try {
    const cacheKey = `${companyId}:${date}:${time.substring(0, 2)}`; // Cache by hour
    const cached = forecastCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    
    // Calculate time window (90 minutes before to 120 minutes after)
    const [hours, minutes] = time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes - 90; // 1.5 hours before
    const endMinutes = hours * 60 + minutes + 120; // 2 hours after
    
    const formatTime = (mins: number) => {
      const h = Math.floor(Math.max(0, mins) / 60) % 24;
      const m = Math.max(0, mins) % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    const startTime = formatTime(startMinutes);
    const endTime = formatTime(endMinutes);
    
    // Get reservations in the time window for the specific date
    const { data: todaysReservations, error: todaysError } = await supabase
      .from('reservations')
      .select('notes, status, table_number, table_numbers')
      .eq('company_id', companyId)
      .eq('date', date)
      .gte('time', startTime)
      .lte('time', endTime)
      .not('status', 'in', '(cancelled,no-show,completed,table-complete)');
    
    if (todaysError) {
      console.error('Error fetching today\'s reservations:', todaysError);
      return { expectedDemand: 0, currentlyAssigned: 0, confidence: 'low' };
    }
    
    // Analyze today's reservations for accessibility needs
    let todaysAccessibleNeeds = 0;
    let currentlyAssigned = 0;
    
    (todaysReservations || []).forEach(reservation => {
      const analysis = analyzeAccessibilityNotes(reservation.notes || '');
      if (analysis.needsAccessible && (analysis.confidence === 'high' || analysis.confidence === 'medium')) {
        todaysAccessibleNeeds++;
        
        // Check if already assigned to accessible table
        if (reservation.table_number || reservation.table_numbers?.length > 0) {
          currentlyAssigned++;
        }
      }
    });
    
    // Get historical data for the same weekday and time (last 4 weeks)
    const dayOfWeek = new Date(date).getDay();
    const fourWeeksAgo = new Date(date);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const { data: historicalReservations, error: historicalError } = await supabase
      .from('reservations')
      .select('notes, date')
      .eq('company_id', companyId)
      .gte('date', fourWeeksAgo.toISOString().split('T')[0])
      .lt('date', date)
      .gte('time', startTime)
      .lte('time', endTime)
      .in('status', ['confirmed', 'seated', 'completed']);
    
    let historicalAccessibleNeeds = 0;
    let historicalDays = 0;
    
    if (!historicalError && historicalReservations) {
      const dayGroups = new Map<string, number>();
      
      historicalReservations.forEach(reservation => {
        const resDate = new Date(reservation.date);
        if (resDate.getDay() === dayOfWeek) {
          const dateKey = reservation.date;
          if (!dayGroups.has(dateKey)) {
            dayGroups.set(dateKey, 0);
          }
          
          const analysis = analyzeAccessibilityNotes(reservation.notes || '');
          if (analysis.needsAccessible && (analysis.confidence === 'high' || analysis.confidence === 'medium')) {
            dayGroups.set(dateKey, dayGroups.get(dateKey)! + 1);
          }
        }
      });
      
      historicalDays = dayGroups.size;
      historicalAccessibleNeeds = Array.from(dayGroups.values()).reduce((sum, count) => sum + count, 0);
    }
    
    // Calculate expected demand with weighted average
    let expectedDemand: number;
    let confidence: 'high' | 'medium' | 'low';
    
    if (historicalDays >= 2) {
      // We have good historical data
      const historicalAverage = historicalAccessibleNeeds / historicalDays;
      expectedDemand = Math.round((todaysAccessibleNeeds * 0.7) + (historicalAverage * 0.3));
      confidence = 'high';
    } else if (todaysAccessibleNeeds > 0) {
      // Use today's data only
      expectedDemand = todaysAccessibleNeeds;
      confidence = 'medium';
    } else {
      // No data available, use conservative estimate
      expectedDemand = 1; // Assume at least 1 potential need
      confidence = 'low';
    }
    
    const result = { expectedDemand, currentlyAssigned, confidence };
    
    // Cache the result
    forecastCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error('Error estimating accessible demand:', error);
    return { expectedDemand: 1, currentlyAssigned: 0, confidence: 'low' };
  }
}

/**
 * Calculates the recommended number of accessible tables to keep available
 */
export async function getAccessibleBudget(
  companyId: string, 
  date: string, 
  time: string
): Promise<AccessibilityBudget> {
  const capacity = await getAccessibleCapacity(companyId);
  const { expectedDemand, confidence } = await estimateAccessibleDemand(companyId, date, time);
  
  // Get company's accessible spare target setting (defaults to 1)
  let spareTarget = 1;
  try {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('accessible_spare_target')
      .eq('company_id', companyId)
      .single();
    
    if (settings?.accessible_spare_target !== null && settings?.accessible_spare_target !== undefined) {
      spareTarget = Math.max(0, Math.min(10, settings.accessible_spare_target)); // Ensure 0-10 range
    }
  } catch (error) {
    console.warn('Could not fetch accessible spare target, using default:', error);
  }
  
  // Calculate recommended spare based on unassigned demand, capped at company's target
  const recommendedSpare = Math.min(spareTarget, Math.max(1, Math.ceil(expectedDemand * 0.3)));
  
  // Calculate final budget: capacity minus expected demand minus spare buffer
  const budget = Math.max(0, capacity - expectedDemand - recommendedSpare);
  
  return {
    budget,
    recommendedSpare,
    capacity,
    expectedDemand,
    confidence,
    spareTarget
  };
}

/**
 * Clear the forecast cache (useful for testing or when data changes significantly)
 */
export function clearForecastCache(): void {
  forecastCache.clear();
}
