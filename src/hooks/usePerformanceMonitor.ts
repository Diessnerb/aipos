import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  component: string;
  operation: string;
  duration: number;
  timestamp: number;
  details?: any;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 100;

  logMetric(component: string, operation: string, duration: number, details?: any) {
    const metric: PerformanceMetrics = {
      component,
      operation,
      duration,
      timestamp: Date.now(),
      details
    };

    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log performance warnings
    if (duration > 100) {
      console.warn(`⚠️ Slow ${component}.${operation}: ${Math.round(duration)}ms`, details);
    } else if (duration > 50) {
      console.log(`⚡ ${component}.${operation}: ${Math.round(duration)}ms`, details);
    }
  }

  getRecentMetrics(component?: string): PerformanceMetrics[] {
    const recent = this.metrics.filter(m => Date.now() - m.timestamp < 10000); // Last 10 seconds
    return component ? recent.filter(m => m.component === component) : recent;
  }

  getAverageTime(component: string, operation: string): number {
    const relevantMetrics = this.metrics.filter(m => 
      m.component === component && m.operation === operation
    );
    
    if (relevantMetrics.length === 0) return 0;
    
    const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / relevantMetrics.length;
  }

  clear(): void {
    this.metrics = [];
  }
}

// Global performance monitor instance
const globalMonitor = new PerformanceMonitor();

/**
 * Hook for monitoring component performance with automatic timing
 */
export const usePerformanceMonitor = (componentName: string) => {
  const timers = useRef<Map<string, number>>(new Map());

  const startTimer = (operation: string): void => {
    timers.current.set(operation, performance.now());
  };

  const endTimer = (operation: string, details?: any): number => {
    const startTime = timers.current.get(operation);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    globalMonitor.logMetric(componentName, operation, duration, details);
    timers.current.delete(operation);
    
    return duration;
  };

  const logInstantMetric = (operation: string, duration: number, details?: any): void => {
    globalMonitor.logMetric(componentName, operation, duration, details);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timers.current.clear();
    };
  }, []);

  return {
    startTimer,
    endTimer,
    logInstantMetric,
    getRecentMetrics: () => globalMonitor.getRecentMetrics(componentName),
    getAverageTime: (operation: string) => globalMonitor.getAverageTime(componentName, operation)
  };
};

/**
 * Hook for automatic render time monitoring
 */
export const useRenderTimeMonitor = (componentName: string) => {
  const renderStart = useRef(performance.now());
  const renderCount = useRef(0);

  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;
    renderCount.current++;
    
    globalMonitor.logMetric(componentName, 'render', renderTime, {
      renderCount: renderCount.current
    });

    // Reset for next render
    renderStart.current = performance.now();
  });

  return {
    renderCount: renderCount.current
  };
};

export { globalMonitor };
