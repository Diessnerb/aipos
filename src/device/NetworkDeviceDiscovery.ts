import { Capacitor } from '@capacitor/core';
import CryptoJS from 'crypto-js';

export interface DiscoveredDevice {
  id: string;
  name: string;
  type: 'pos' | 'printer' | 'cash_drawer';
  connection: 'mdns' | 'bluetooth' | 'wifi';
  host?: string;
  port?: number;
  challengeHash?: string;
}

class NetworkDeviceDiscoveryService {
  private isNative = Capacitor.isNativePlatform();
  private discoveredDevices = new Map<string, DiscoveredDevice>();
  private isScanning = false;

  // Generate challenge hash from network secret and device ID
  generateChallengeHash(networkSecret: string, deviceId: string): string {
    return CryptoJS.HmacSHA256(deviceId, networkSecret).toString().slice(0, 16);
  }

  async startDiscovery(networkSecret: string, deviceId: string): Promise<void> {
    if (this.isScanning) {
      console.log('[NetworkDiscovery] Already scanning');
      return;
    }

    this.isScanning = true;
    console.log('[NetworkDiscovery] Starting device discovery');

    if (this.isNative) {
      await this.startNativeDiscovery(networkSecret, deviceId);
    } else {
      console.log('[NetworkDiscovery] Web platform - mDNS not available');
    }
  }

  private async startNativeDiscovery(networkSecret: string, deviceId: string): Promise<void> {
    try {
      // Register our own service
      const challengeHash = this.generateChallengeHash(networkSecret, deviceId);
      await this.registerService(deviceId, challengeHash);

      // Scan for POS devices
      await this.scanForService('_pos-sync._tcp', 'pos', networkSecret);

      // Scan for printers
      await this.scanForService('_ipp._tcp', 'printer', networkSecret);
      await this.scanForService('_pdl-datastream._tcp', 'printer', networkSecret);
    } catch (error) {
      console.error('[NetworkDiscovery] Error during native discovery:', error);
    }
  }

  private async registerService(deviceId: string, challengeHash: string): Promise<void> {
    // This would use capacitor-zeroconf plugin
    // For now, just log the registration
    console.log('[NetworkDiscovery] Would register service:', {
      type: '_pos-sync._tcp',
      name: `POS-${deviceId.slice(0, 8)}`,
      port: 5353,
      txtRecord: {
        v: '1',
        ch: challengeHash
      }
    });
  }

  private async scanForService(
    serviceType: string,
    deviceType: 'pos' | 'printer' | 'cash_drawer',
    networkSecret: string
  ): Promise<void> {
    // This would use capacitor-zeroconf plugin to discover services
    // For now, just log the scan
    console.log('[NetworkDiscovery] Would scan for service:', serviceType, deviceType);
  }

  async stopDiscovery(): Promise<void> {
    if (!this.isScanning) return;

    console.log('[NetworkDiscovery] Stopping device discovery');
    this.isScanning = false;

    if (this.isNative) {
      // Stop zeroconf scanning
      console.log('[NetworkDiscovery] Would stop native discovery');
    }
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  getDevicesByType(type: 'pos' | 'printer' | 'cash_drawer'): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values()).filter(d => d.type === type);
  }

  clearDiscoveredDevices(): void {
    this.discoveredDevices.clear();
  }

  isDiscoveryActive(): boolean {
    return this.isScanning;
  }
}

export const NetworkDeviceDiscovery = new NetworkDeviceDiscoveryService();
