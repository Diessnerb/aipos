
import { useState, useRef, useCallback } from 'react';

interface DragTracker {
  isDragging: boolean;
  dragStarted: boolean;
  preventNextClick: boolean;
  dragDistance: number;
  dragStartTime: number;
}

export const useDragTracker = () => {
  const [tracker, setTracker] = useState<DragTracker>({
    isDragging: false,
    dragStarted: false,
    preventNextClick: false,
    dragDistance: 0,
    dragStartTime: 0
  });
  
  const startPosition = useRef<{ x: number; y: number } | null>(null);
  const clickPreventionTimeout = useRef<NodeJS.Timeout>();

  const startDragTracking = useCallback((clientX: number, clientY: number) => {
    startPosition.current = { x: clientX, y: clientY };
    setTracker(prev => ({
      ...prev,
      isDragging: false,
      dragStarted: true,
      dragDistance: 0,
      dragStartTime: Date.now()
    }));
  }, []);

  const updateDragTracking = useCallback((clientX: number, clientY: number) => {
    if (!startPosition.current) return;

    const deltaX = clientX - startPosition.current.x;
    const deltaY = clientY - startPosition.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const timeElapsed = Date.now() - tracker.dragStartTime;

    setTracker(prev => ({
      ...prev,
      isDragging: distance > 8 && timeElapsed > 100, // Lower threshold for better drag detection
      dragDistance: distance
    }));
  }, [tracker.dragStartTime]);

  const endDragTracking = useCallback(() => {
    const wasDragging = tracker.isDragging;
    const dragDistance = tracker.dragDistance;
    const dragTime = tracker.dragStartTime ? Date.now() - tracker.dragStartTime : 0;
    
    // Only prevent clicks if it was actually a drag (movement > 5px AND time > 30ms)
    const wasActualDrag = wasDragging && dragDistance > 5 && dragTime > 30;
    
    console.log('=== DRAG END ===', {
      wasDragging,
      dragDistance,
      dragTime,
      wasActualDrag,
      preventNextClick: wasActualDrag
    });

    // Reset drag state
    setTracker(prev => ({
      ...prev,
      isDragging: false,
      dragStarted: false,
      dragDistance: 0,
      dragStartTime: 0,
      preventNextClick: wasActualDrag
    }));

    startPosition.current = null;

    // Clear click prevention after a very short delay only for actual drags
    if (wasActualDrag) {
      if (clickPreventionTimeout.current) {
        clearTimeout(clickPreventionTimeout.current);
      }
      clickPreventionTimeout.current = setTimeout(() => {
        setTracker(prev => ({
          ...prev,
          preventNextClick: false
        }));
      }, 300); // Increased to 300ms to reliably prevent post-drag clicks
    } else {
      // If wasn't an actual drag, clear click prevention immediately
      setTracker(prev => ({
        ...prev,
        preventNextClick: false
      }));
    }
  }, [tracker.isDragging, tracker.dragDistance, tracker.dragStartTime]);

  const shouldPreventClick = useCallback(() => {
    return tracker.preventNextClick;
  }, [tracker.preventNextClick]);

  const resetClickPrevention = useCallback(() => {
    setTracker(prev => ({
      ...prev,
      preventNextClick: false
    }));
  }, []);

  return {
    tracker,
    startDragTracking,
    updateDragTracking,
    endDragTracking,
    shouldPreventClick,
    resetClickPrevention
  };
};
