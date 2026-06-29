import { useState, useEffect, useCallback } from 'react';
import { useCompanyId } from './useCompanyId';
import { SmartAutoAssignmentServiceExtensions } from '@/services/smartAutoAssignmentServiceExtensions';
import { VisualCapacityService } from '@/services/visualCapacityService';

export interface EfficiencyAnalytics {
  averageEfficiencyScore: number;
  visualAssignmentsCount: number;
  totalAssignments: number;
  efficiencyTrend: 'improving' | 'declining' | 'stable';
  recommendations: Array<{
    groupName: string;
    tableCombination: number[];
    efficiencyScore: number;
    recommendations: string[];
  }>;
}

/**
 * Hook for tracking and analyzing visual efficiency metrics
 */
export const useVisualEfficiencyAnalytics = () => {
  const [analytics, setAnalytics] = useState<EfficiencyAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { companyId: effectiveCompanyId } = useCompanyId();

  const loadAnalytics = useCallback(async () => {
    if (!effectiveCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      // Get efficiency recommendations for different party sizes
      const recommendations = await SmartAutoAssignmentServiceExtensions.getEfficiencyRecommendations(
        effectiveCompanyId,
        6 // Average party size for analysis
      );

      // Calculate analytics from recommendations
      const totalRecommendations = recommendations.length;
      const averageEfficiency = totalRecommendations > 0 
        ? recommendations.reduce((sum, rec) => sum + rec.efficiencyScore, 0) / totalRecommendations
        : 0;

      // Mock some additional analytics data (would come from actual assignment logs in production)
      const mockAnalytics: EfficiencyAnalytics = {
        averageEfficiencyScore: averageEfficiency,
        visualAssignmentsCount: Math.floor(totalRecommendations * 0.7), // Assume 70% use visual assignments
        totalAssignments: totalRecommendations,
        efficiencyTrend: averageEfficiency > 80 ? 'improving' : averageEfficiency > 60 ? 'stable' : 'declining',
        recommendations
      };

      setAnalytics(mockAnalytics);
    } catch (err) {
      console.error('Error loading efficiency analytics:', err);
      setError('Failed to load efficiency analytics');
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  const refreshAnalytics = useCallback(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    loading,
    error,
    refreshAnalytics
  };
};