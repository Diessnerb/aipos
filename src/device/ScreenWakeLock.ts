import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

class ScreenWakeLockService {
  private isNative = Capacitor.isNativePlatform();
  private isEnabled = false;
  private webWakeLock: any = null;

  async enableWakeLock(): Promise<void> {
    if (this.isEnabled) return;

    if (this.isNative) {
      try {
        await KeepAwake.keepAwake();
        this.isEnabled = true;
        console.log('[ScreenWakeLock] Native wake lock enabled');
      } catch (error) {
        console.error('[ScreenWakeLock] Error enabling native wake lock:', error);
      }
    } else {
      // Web fallback using Wake Lock API
      if ('wakeLock' in navigator) {
        try {
          this.webWakeLock = await (navigator as any).wakeLock.request('screen');
          this.isEnabled = true;
          console.log('[ScreenWakeLock] Web wake lock enabled');

          this.webWakeLock.addEventListener('release', () => {
            console.log('[ScreenWakeLock] Web wake lock released');
            this.isEnabled = false;
          });
        } catch (error) {
          console.error('[ScreenWakeLock] Error enabling web wake lock:', error);
        }
      }
    }
  }

  async disableWakeLock(): Promise<void> {
    if (!this.isEnabled) return;

    if (this.isNative) {
      try {
        await KeepAwake.allowSleep();
        this.isEnabled = false;
        console.log('[ScreenWakeLock] Native wake lock disabled');
      } catch (error) {
        console.error('[ScreenWakeLock] Error disabling native wake lock:', error);
      }
    } else {
      if (this.webWakeLock) {
        try {
          await this.webWakeLock.release();
          this.webWakeLock = null;
          this.isEnabled = false;
          console.log('[ScreenWakeLock] Web wake lock disabled');
        } catch (error) {
          console.error('[ScreenWakeLock] Error disabling web wake lock:', error);
        }
      }
    }
  }

  isActive(): boolean {
    return this.isEnabled;
  }
}

export const ScreenWakeLock = new ScreenWakeLockService();
