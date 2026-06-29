import React, { useEffect } from 'react';
import { getDeviceInfo } from '@/utils/deviceDetection';

interface TabletLayoutOptimizerProps {
  totalGridHeight?: number;
  containerHeight: number;
  children: React.ReactNode;
}

export const TabletLayoutOptimizer: React.FC<TabletLayoutOptimizerProps> = ({
  totalGridHeight,
  containerHeight,
  children
}) => {
  const device = getDeviceInfo();
  
  useEffect(() => {
    if (!device.isTablet) return;
    
    // Add tablet-specific CSS classes to optimize layout
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    htmlElement.classList.add('tablet-timeline');
    bodyElement.classList.add('tablet-timeline-body');
    
    // Apply tablet-specific CSS variables
    htmlElement.style.setProperty('--tablet-timeline-container-height', `${containerHeight}px`);
    htmlElement.style.setProperty('--tablet-orientation', device.orientation);
    bodyElement.dataset.orientation = device.orientation;
    
    // Prevent zoom and enable smooth scrolling if needed
    const viewport = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewport?.getAttribute('content') || 'width=device-width, initial-scale=1.0';
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      );
    }
    
    // Handle orientation changes instantly
    const handleOrientationChange = () => {
      const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      htmlElement.style.setProperty('--tablet-orientation', newOrientation);
      bodyElement.dataset.orientation = newOrientation;
    };
    
    window.addEventListener('device-orientation-changed', handleOrientationChange);
    
    return () => {
      window.removeEventListener('device-orientation-changed', handleOrientationChange);
      htmlElement.classList.remove('tablet-timeline');
      bodyElement.classList.remove('tablet-timeline-body');
      htmlElement.style.removeProperty('--tablet-timeline-container-height');
      htmlElement.style.removeProperty('--tablet-orientation');
      delete bodyElement.dataset.orientation;
      
      // Restore normal viewport settings
      if (viewport) {
        viewport.setAttribute('content', originalViewport);
      }
    };
  }, [device.isTablet, containerHeight]);
  
  // Listen for layout overflow events
  useEffect(() => {
    if (!device.isTablet) return;
    
    const handleLayoutOverflow = (event: CustomEvent) => {
      console.warn('🚨 Timeline Layout Overflow Detected:', event.detail);
      
      // Could trigger additional optimizations here
      // For example: reducing font sizes, adjusting spacing, etc.
    };
    
    window.addEventListener('timeline-layout-overflow', handleLayoutOverflow as EventListener);
    
    return () => {
      window.removeEventListener('timeline-layout-overflow', handleLayoutOverflow as EventListener);
    };
  }, [device.isTablet]);
  
  if (!device.isTablet) {
    return <>{children}</>;
  }
  
  return (
    <div 
      className="tablet-timeline-wrapper"
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        // Ensure no scrollbars appear
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Grid can now scroll vertically if needed */}
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .tablet-timeline-wrapper::-webkit-scrollbar {
            display: none;
          }
          
          .tablet-timeline {
            overflow-x: hidden !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
            max-width: 100vw;
          }
          
          .tablet-timeline-body {
            overflow: hidden !important;
            height: 100vh !important;
            touch-action: manipulation;
          }
          
          .tablet-optimized {
            --timeline-row-min-height: 20px;
            --timeline-column-min-width: 15px;
            --timeline-header-height: 42px;
            font-size: clamp(11px, 1.2vw, 14px);
          }
          
          @media (orientation: landscape) {
            .tablet-optimized {
              --timeline-row-min-height: 22px;
              --timeline-column-min-width: 20px;
              font-size: clamp(12px, 1.1vw, 15px);
            }
          }
          
          @media (orientation: portrait) {
            .tablet-optimized {
              --timeline-row-min-height: 20px;
              --timeline-column-min-width: 15px;
              font-size: clamp(11px, 1.3vw, 14px);
            }
          }
        `
      }} />
      
      {children}
    </div>
  );
};