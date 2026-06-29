import { useState, useEffect, useCallback, useRef } from 'react';
import { useCompanyId } from './useCompanyId';
import { SmartReservationAssignmentService } from '@/services/smartReservationAssignmentService';
import { SpaceMakingAnalysisService } from '@/services/spaceMakingAnalysisService';
import { supabase } from '@/integrations/supabase/client';

interface SpaceAnalysisResult {
  canAssignDirectly: boolean;
  canOptimizeToAssign: boolean;
  alternativeTimes: string[];
  suggestedStrategy: string;
  optimizationPotential?: number;
  optimalTables?: number[];
  preCalculatedAssignment?: {
    assignedTables: number[];
    assignmentStrategy: string;
    message: string;
  };
  spaceMakingApplied?: boolean;
  movedReservations?: number;
  spaceMakingOptions?: Array<{
    targetTables: number[];
    totalSeats: number;
    currentOccupants: Array<{
      reservationId: string;
      customerName: string;
      partySize: number;
      currentTables: number[];
      suggestedAlternatives: number[];
    }>;
    movesRequired: number;
    efficiency: number;
    confidence: number;
    freesUpSeats: number;
    description: string;
  }>;
}

interface UseReservationSpaceAnalysisOptions {
  enabled?: boolean;
  debounceMs?: number;
}

export function useReservationSpaceAnalysis(options: UseReservationSpaceAnalysisOptions = {}) {
  const { enabled = true, debounceMs = 500 } = options;
  const { companyId: effectiveCompanyId } = useCompanyId();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<SpaceAnalysisResult | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Map<string, SpaceAnalysisResult>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * TIER 2: Proactive Space Analysis - Triggers when party size changes
   * This is the core of real-time reservation creation logic
   */
  const analyzeSpace = useCallback(async (
    partySize: number,
    date: string,
    time: string,
    notes?: string
  ): Promise<SpaceAnalysisResult> => {
    if (!effectiveCompanyId || !enabled || partySize < 1) {
      return {
        canAssignDirectly: false,
        canOptimizeToAssign: false,
        alternativeTimes: [],
        suggestedStrategy: 'insufficient_data'
      };
    }

     // Cache key for analysis results
     const cacheKey = `${effectiveCompanyId}-${date}-${time}-${partySize}-${notes || ''}`;
     
     // Return cached result if available and recent (within 30 seconds)
     const cached = analysisCache.get(cacheKey);
     if (cached) {
       console.log(`🎯 Using cached space analysis for ${partySize} guests`);
       return cached;
     }

    setIsAnalyzing(true);

    try {
      console.log(`🔍 TIER 2: Analyzing space for ${partySize} guests at ${date} ${time}`);

      // Step 1: Check direct assignment possibilities
      const directAssignmentResult = await SmartReservationAssignmentService.assignOptimalTables(
        effectiveCompanyId,
        date,
        time,
        partySize,
        notes
      );

      // Step 2: If direct assignment failed, check optimization opportunities
      let optimizationResult;
      if (!directAssignmentResult.success) {
        console.log(`🎯 Direct assignment failed, checking optimization potential...`);
        
        // Use the can-optimize checker to see if space-making is possible
        const canOptimize = await SmartReservationAssignmentService.canOptimizeForAssignment(
          effectiveCompanyId,
          date,
          time,
          partySize
        );

        if (canOptimize) {
          // Try assignment with optimization (space-making)
          optimizationResult = await SmartReservationAssignmentService.tryAssignmentWithOptimization(
            effectiveCompanyId,
            date,
            time,
            partySize,
            notes
          );
        }
      }

      // Step 3: Get alternative time recommendations if needed
      const recommendations = await SmartReservationAssignmentService.getAssignmentRecommendations(
        effectiveCompanyId,
        date,
        time,
        partySize,
        notes
      );

      // Step 4: If standard and optimization failed, check for space-making opportunities
      let spaceMakingOptions;
      if (!directAssignmentResult.success && !optimizationResult?.success) {
        console.log(`🔍 TIER 2: Checking space-making opportunities for ${partySize} guests...`);
        const rawOptions = await SpaceMakingAnalysisService.analyzeSpaceMakingOptions(
          effectiveCompanyId,
          date,
          time,
          partySize
        );

        if (rawOptions.length > 0) {
          spaceMakingOptions = rawOptions.map(opt => ({
            targetTables: opt.targetTables,
            totalSeats: opt.totalSeats,
            currentOccupants: opt.currentOccupants,
            movesRequired: opt.movesRequired,
            efficiency: opt.efficiency,
            confidence: opt.confidence,
            freesUpSeats: opt.freesUpSeats,
            description: `Move ${opt.movesRequired} reservation${opt.movesRequired > 1 ? 's' : ''} to free up T${opt.targetTables.join(', ')} (${opt.totalSeats} seats)`
          }));
          console.log(`✅ TIER 2: Found ${spaceMakingOptions.length} space-making options`);
        }
      }

      // Build comprehensive analysis result
      const analysis: SpaceAnalysisResult = {
        canAssignDirectly: directAssignmentResult.success,
        canOptimizeToAssign: !!optimizationResult?.success,
        alternativeTimes: recommendations.alternativeTimes || [],
        suggestedStrategy: recommendations.suggestedStrategy,
        optimizationPotential: recommendations.optimizationPotential,
        optimalTables: directAssignmentResult.assignedTables,
        preCalculatedAssignment: directAssignmentResult.success ? {
          assignedTables: directAssignmentResult.assignedTables!,
          assignmentStrategy: directAssignmentResult.assignmentStrategy || 'smart',
          message: directAssignmentResult.message || 'Optimal assignment found'
        } : undefined,
        spaceMakingApplied: optimizationResult?.optimizationApplied,
        movedReservations: optimizationResult?.movedReservations,
        spaceMakingOptions
      };

       // Cache the result for 30 seconds
       setAnalysisCache(prev => {
         const cached = prev.get(cacheKey);
         if (cached) {
           // Already cached, don't update to prevent infinite loops
           return prev;
         }
         
         const newCache = new Map(prev);
         newCache.set(cacheKey, analysis);
         // Clear cache after 30 seconds
         setTimeout(() => {
           setAnalysisCache(current => {
             const updated = new Map(current);
             updated.delete(cacheKey);
             return updated;
           });
         }, 30000);
         return newCache;
       });

      setLastAnalysis(analysis);
      
      console.log(`✅ TIER 2: Space analysis complete`, {
        canAssignDirectly: analysis.canAssignDirectly,
        canOptimizeToAssign: analysis.canOptimizeToAssign,
        alternativeCount: analysis.alternativeTimes.length,
        strategy: analysis.suggestedStrategy
      });

      return analysis;

    } catch (error) {
      console.error('🚨 Space analysis failed:', error);
      
      const errorResult: SpaceAnalysisResult = {
        canAssignDirectly: false,
        canOptimizeToAssign: false,
        alternativeTimes: [],
        suggestedStrategy: 'analysis_failed'
      };

      return errorResult;
    } finally {
      setIsAnalyzing(false);
    }
  }, [effectiveCompanyId, enabled]);

  /**
   * Debounced analysis trigger - prevents excessive API calls during party size input
   */
  const analyzeSpaceDebounced = useCallback((
    partySize: number,
    date: string,
    time: string,
    notes?: string
  ) => {
    if (!enabled) return;

    // Clear any existing timeout
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    console.log(`⏱️ Debouncing space analysis for ${partySize} guests (${debounceMs}ms delay)`);

    // Set new timeout
    debounceTimerRef.current = setTimeout(async () => {
      console.log(`🔍 DEBOUNCE COMPLETE: Triggering space analysis for ${partySize} guests`);
      await analyzeSpace(partySize, date, time, notes);
      debounceTimerRef.current = null;
    }, debounceMs);
  }, [analyzeSpace, enabled, debounceMs]);

  /**
   * Clear analysis cache and results
   */
  const clearAnalysis = useCallback(() => {
    // Clear any pending debounced analysis
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setLastAnalysis(null);
    setAnalysisCache(new Map());
  }, []);

  /**
   * Get instant assignment based on pre-calculated results
   * This makes auto-assign "instant" because work was done during party size entry
   */
  const getInstantAssignment = useCallback(() => {
    if (lastAnalysis?.preCalculatedAssignment) {
      console.log(`⚡ INSTANT ASSIGNMENT: Using pre-calculated result`);
      return lastAnalysis.preCalculatedAssignment;
    }
    return null;
  }, [lastAnalysis]);

  return {
    analyzeSpace,
    analyzeSpaceDebounced,
    clearAnalysis,
    getInstantAssignment,
    isAnalyzing,
    lastAnalysis,
    // Convenience getters
    canAssignDirectly: lastAnalysis?.canAssignDirectly || false,
    canOptimizeToAssign: lastAnalysis?.canOptimizeToAssign || false,
    hasAlternativeTimes: (lastAnalysis?.alternativeTimes?.length || 0) > 0,
    alternativeTimes: lastAnalysis?.alternativeTimes || [],
    suggestedStrategy: lastAnalysis?.suggestedStrategy || 'none'
  };
}