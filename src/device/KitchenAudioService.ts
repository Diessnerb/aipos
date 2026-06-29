import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

class KitchenAudioServiceClass {
  private audioContext: AudioContext | null = null;
  private isNative = Capacitor.isNativePlatform();
  private volume = 0.8;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext(): void {
    try {
      // Create AudioContext lazily on first interaction
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    } catch (error) {
      console.error('[KitchenAudioService] Error initializing AudioContext:', error);
    }
  }

  private createBellSound(): void {
    if (!this.audioContext) {
      console.warn('[KitchenAudioService] AudioContext not available');
      return;
    }

    // Resume context if suspended (required by browser autoplay policies)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const currentTime = this.audioContext.currentTime;
    
    // Create two oscillators for rich bell harmonics (800Hz + 1200Hz)
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    
    // Create gain nodes for volume control and envelope shaping
    const gainNode = this.audioContext.createGain();
    const masterGain = this.audioContext.createGain();
    
    // Set frequencies (bell-like harmonics)
    osc1.frequency.value = 800;  // Fundamental
    osc2.frequency.value = 1200; // Harmonic overtone
    
    // Set oscillator type
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    // Connect oscillators to gain node
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    
    // Set master volume
    masterGain.gain.value = this.volume;
    gainNode.connect(masterGain);
    masterGain.connect(this.audioContext.destination);
    
    // Create bell envelope: sharp attack, smooth decay
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(0.8, currentTime + 0.01); // Sharp attack (10ms)
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.5); // Smooth decay (500ms)
    
    // Start oscillators
    osc1.start(currentTime);
    osc2.start(currentTime);
    
    // Stop oscillators after sound completes
    osc1.stop(currentTime + 0.5);
    osc2.stop(currentTime + 0.5);
  }

  async playOrderDing(): Promise<void> {
    try {
      // Play synthesized bell sound
      this.createBellSound();
      console.log('[KitchenAudioService] Concierge bell played');

      // Add haptic feedback on native platforms
      if (this.isNative) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
    } catch (error) {
      console.error('[KitchenAudioService] Error playing order ding:', error);
    }
  }

  setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));
  }

  getVolume(): number {
    return this.volume;
  }
}

export const KitchenAudioService = new KitchenAudioServiceClass();
