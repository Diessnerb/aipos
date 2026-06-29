export interface TouchGesture {
  type: 'tap' | 'drag' | 'pinch' | 'swipe';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  scale?: number;
  velocity?: number;
}

export interface MobileOptimizationSettings {
  touchThreshold: number;
  dragThreshold: number;
  pinchThreshold: number;
  swipeThreshold: number;
  tapTimeout: number;
  enableHapticFeedback: boolean;
  optimizeForLowEnd: boolean;
}

const DEFAULT_SETTINGS: MobileOptimizationSettings = {
  touchThreshold: 10,
  dragThreshold: 15,
  pinchThreshold: 0.1,
  swipeThreshold: 50,
  tapTimeout: 300,
  enableHapticFeedback: true,
  optimizeForLowEnd: false
};

export class MobileGestureHandler {
  private element: HTMLElement;
  private settings: MobileOptimizationSettings;
  private activeGesture: TouchGesture | null = null;
  private startTime: number = 0;
  private lastTap: number = 0;
  private tapCount: number = 0;

  constructor(element: HTMLElement, settings: Partial<MobileOptimizationSettings> = {}) {
    this.element = element;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this));

    // Prevent default behaviors that interfere with custom gestures
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
    this.element.addEventListener('selectstart', (e) => e.preventDefault());
  }

  private handleTouchStart(event: TouchEvent) {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.startSingleTouch(touch);
    } else if (event.touches.length === 2) {
      this.startPinchGesture(event.touches);
    }
  }

  private handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    
    if (!this.activeGesture) return;

    if (event.touches.length === 1 && this.activeGesture.type !== 'pinch') {
      const touch = event.touches[0];
      this.updateSingleTouch(touch);
    } else if (event.touches.length === 2 && this.activeGesture.type === 'pinch') {
      this.updatePinchGesture(event.touches);
    }
  }

  private handleTouchEnd(event: TouchEvent) {
    if (!this.activeGesture) return;

    const currentTime = Date.now();
    const duration = currentTime - this.startTime;

    if (this.activeGesture.type === 'tap' && duration < this.settings.tapTimeout) {
      this.handleTapGesture(currentTime);
    } else if (this.activeGesture.type === 'drag') {
      this.handleDragEnd();
    } else if (this.activeGesture.type === 'swipe') {
      this.handleSwipeEnd();
    }

    this.activeGesture = null;
  }

  private handleTouchCancel() {
    this.activeGesture = null;
  }

  private startSingleTouch(touch: Touch) {
    this.startTime = Date.now();
    this.activeGesture = {
      type: 'tap',
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX: 0,
      deltaY: 0
    };
  }

  private updateSingleTouch(touch: Touch) {
    if (!this.activeGesture) return;

    const deltaX = touch.clientX - this.activeGesture.startX;
    const deltaY = touch.clientY - this.activeGesture.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    this.activeGesture.currentX = touch.clientX;
    this.activeGesture.currentY = touch.clientY;
    this.activeGesture.deltaX = deltaX;
    this.activeGesture.deltaY = deltaY;

    // Determine gesture type based on movement
    if (distance > this.settings.dragThreshold && this.activeGesture.type === 'tap') {
      const velocity = distance / (Date.now() - this.startTime);
      
      if (velocity > 0.5) {
        this.activeGesture.type = 'swipe';
        this.activeGesture.velocity = velocity;
      } else {
        this.activeGesture.type = 'drag';
      }
      
      this.dispatchGestureEvent('gesturestart', this.activeGesture);
    }

    if (this.activeGesture.type === 'drag' || this.activeGesture.type === 'swipe') {
      this.dispatchGestureEvent('gesturechange', this.activeGesture);
    }
  }

  private startPinchGesture(touches: TouchList) {
    const touch1 = touches[0];
    const touch2 = touches[1];
    
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;
    
    this.startTime = Date.now();
    this.activeGesture = {
      type: 'pinch',
      startX: centerX,
      startY: centerY,
      currentX: centerX,
      currentY: centerY,
      deltaX: 0,
      deltaY: 0,
      scale: 1
    };

    this.dispatchGestureEvent('gesturestart', this.activeGesture);
  }

  private updatePinchGesture(touches: TouchList) {
    if (!this.activeGesture || this.activeGesture.type !== 'pinch') return;

    const touch1 = touches[0];
    const touch2 = touches[1];
    
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;
    
    const currentDistance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    
    const initialDistance = Math.sqrt(
      Math.pow(this.activeGesture.startX * 2, 2) + 
      Math.pow(this.activeGesture.startY * 2, 2)
    );
    
    this.activeGesture.currentX = centerX;
    this.activeGesture.currentY = centerY;
    this.activeGesture.deltaX = centerX - this.activeGesture.startX;
    this.activeGesture.deltaY = centerY - this.activeGesture.startY;
    this.activeGesture.scale = currentDistance / initialDistance;

    this.dispatchGestureEvent('gesturechange', this.activeGesture);
  }

  private handleTapGesture(currentTime: number) {
    if (!this.activeGesture) return;

    // Handle double tap
    if (currentTime - this.lastTap < 300) {
      this.tapCount++;
      if (this.tapCount === 2) {
        this.dispatchGestureEvent('doubletap', this.activeGesture);
        this.tapCount = 0;
        return;
      }
    } else {
      this.tapCount = 1;
    }

    this.lastTap = currentTime;
    
    // Dispatch single tap after delay to check for double tap
    setTimeout(() => {
      if (this.tapCount === 1) {
        this.dispatchGestureEvent('tap', this.activeGesture!);
        this.tapCount = 0;
      }
    }, 300);

    // Haptic feedback
    if (this.settings.enableHapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }

  private handleDragEnd() {
    if (!this.activeGesture) return;
    this.dispatchGestureEvent('dragend', this.activeGesture);
  }

  private handleSwipeEnd() {
    if (!this.activeGesture) return;
    this.dispatchGestureEvent('swipeend', this.activeGesture);
  }

  private dispatchGestureEvent(type: string, gesture: TouchGesture) {
    const event = new CustomEvent(type, {
      detail: gesture,
      bubbles: true,
      cancelable: true
    });
    this.element.dispatchEvent(event);
  }

  destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
  }
}

// Performance optimization utilities
export const MobilePerformanceUtils = {
  // Detect if device is low-end
  isLowEndDevice(): boolean {
    if (!('hardwareConcurrency' in navigator)) return true;
    
    const cores = navigator.hardwareConcurrency;
    const memory = (navigator as any).deviceMemory || 2;
    const connection = (navigator as any).connection;
    
    // Consider low-end if:
    // - Less than 4 CPU cores
    // - Less than 3GB RAM
    // - Slow connection
    return cores < 4 || memory < 3 || (connection && connection.effectiveType === 'slow-2g');
  },

  // Optimize canvas for mobile
  optimizeCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set pixel ratio for crisp rendering
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    // Optimize rendering
    ctx.imageSmoothingEnabled = !this.isLowEndDevice();
    ctx.imageSmoothingQuality = this.isLowEndDevice() ? 'low' : 'high';
  },

  // Debounce function for performance
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate?: boolean
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  },

  // Throttle function for performance
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return function executedFunction(...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};