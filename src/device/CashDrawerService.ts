import { Capacitor } from '@capacitor/core';

export interface CashDrawer {
  id: string;
  name: string;
  type: 'bluetooth' | 'network' | 'usb';
  address?: string;
}

class CashDrawerServiceClass {
  private isNative = Capacitor.isNativePlatform();
  private connectedDrawer: CashDrawer | null = null;

  async discoverDrawers(): Promise<CashDrawer[]> {
    if (!this.isNative) {
      console.log('[CashDrawer] Web platform - limited drawer support');
      return [];
    }

    try {
      console.log('[CashDrawer] Would scan for Bluetooth/Network cash drawers');
      return [];
    } catch (error) {
      console.error('[CashDrawer] Error discovering drawers:', error);
      return [];
    }
  }

  async connect(drawerId: string, type: 'bluetooth' | 'network' | 'usb'): Promise<boolean> {
    try {
      console.log('[CashDrawer] Would connect to drawer:', drawerId, type);
      this.connectedDrawer = {
        id: drawerId,
        name: `Cash Drawer ${drawerId}`,
        type
      };
      return true;
    } catch (error) {
      console.error('[CashDrawer] Error connecting to drawer:', error);
      return false;
    }
  }

  async openDrawer(): Promise<boolean> {
    if (!this.connectedDrawer) {
      console.error('[CashDrawer] No drawer connected');
      return false;
    }

    try {
      console.log('[CashDrawer] Opening drawer:', this.connectedDrawer.id);
      // ESC/POS kick command: ESC p m t1 t2
      // Would send: 0x1B 0x70 0x00 0x32 0x96
      return true;
    } catch (error) {
      console.error('[CashDrawer] Error opening drawer:', error);
      return false;
    }
  }

  disconnect(): void {
    if (this.connectedDrawer) {
      console.log('[CashDrawer] Disconnecting from drawer:', this.connectedDrawer.id);
      this.connectedDrawer = null;
    }
  }

  isConnected(): boolean {
    return this.connectedDrawer !== null;
  }

  getConnectedDrawer(): CashDrawer | null {
    return this.connectedDrawer;
  }
}

export const CashDrawerService = new CashDrawerServiceClass();
