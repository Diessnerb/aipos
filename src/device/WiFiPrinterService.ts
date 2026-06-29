import { Capacitor } from '@capacitor/core';

export interface WiFiPrinter {
  id: string;
  name: string;
  ip: string;
  port: number;
}

class WiFiPrinterServiceClass {
  private isNative = Capacitor.isNativePlatform();
  private connectedPrinter: WiFiPrinter | null = null;

  async connectByIP(ip: string, port: number = 9100): Promise<boolean> {
    try {
      // Test connection
      const isReachable = await this.testConnection(ip, port);
      if (!isReachable) {
        console.error('[WiFiPrinter] Printer not reachable at', ip);
        return false;
      }

      this.connectedPrinter = {
        id: `wifi-${ip}`,
        name: `Printer at ${ip}`,
        ip,
        port
      };

      console.log('[WiFiPrinter] Connected to printer at', ip);
      return true;
    } catch (error) {
      console.error('[WiFiPrinter] Error connecting to printer:', error);
      return false;
    }
  }

  async testConnection(ip: string, port: number = 9100): Promise<boolean> {
    // In a real implementation, this would attempt to open a TCP connection
    console.log('[WiFiPrinter] Would test connection to', ip, 'port', port);
    return true;
  }

  async print(data: string): Promise<boolean> {
    if (!this.connectedPrinter) {
      console.error('[WiFiPrinter] No printer connected');
      return false;
    }

    try {
      console.log('[WiFiPrinter] Would send data to printer at', this.connectedPrinter.ip);
      // In a real implementation, send ESC/POS commands over TCP to port 9100
      return true;
    } catch (error) {
      console.error('[WiFiPrinter] Error printing:', error);
      return false;
    }
  }

  disconnect(): void {
    if (this.connectedPrinter) {
      console.log('[WiFiPrinter] Disconnecting from printer at', this.connectedPrinter.ip);
      this.connectedPrinter = null;
    }
  }

  isConnected(): boolean {
    return this.connectedPrinter !== null;
  }

  getConnectedPrinter(): WiFiPrinter | null {
    return this.connectedPrinter;
  }
}

export const WiFiPrinterService = new WiFiPrinterServiceClass();
