// Global orientation manager for instant device rotation handling

export type OrientationChangeCallback = (orientation: 'portrait' | 'landscape') => void;

class OrientationManager {
  private listeners: Set<OrientationChangeCallback> = new Set();
  private currentOrientation: 'portrait' | 'landscape' = 'landscape';
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }
  }

  initialize() {
    if (this.isInitialized || typeof window === 'undefined') return;

    this.isInitialized = true;

    // Listen for orientation changes
    window.addEventListener('orientationchange', this.handleOrientationChange);
    window.addEventListener('resize', this.handleResize);

    console.log('📱 Orientation Manager initialized');
  }

  private handleOrientationChange = () => {
    // Use setTimeout to ensure screen dimensions are updated
    setTimeout(() => {
      this.checkAndUpdateOrientation();
    }, 100);
  };

  private handleResize = () => {
    this.checkAndUpdateOrientation();
  };

  private checkAndUpdateOrientation() {
    const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    
    if (newOrientation !== this.currentOrientation) {
      this.currentOrientation = newOrientation;
      this.notifyListeners(newOrientation);
      
      // Emit custom event for components
      window.dispatchEvent(new CustomEvent('device-orientation-changed', {
        detail: { orientation: newOrientation }
      }));

      console.log('📱 Orientation changed to:', newOrientation);
    }
  }

  subscribe(callback: OrientationChangeCallback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(orientation: 'portrait' | 'landscape') {
    this.listeners.forEach(callback => callback(orientation));
  }

  getCurrentOrientation(): 'portrait' | 'landscape' {
    return this.currentOrientation;
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('orientationchange', this.handleOrientationChange);
      window.removeEventListener('resize', this.handleResize);
    }
    this.listeners.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
export const orientationManager = new OrientationManager();
