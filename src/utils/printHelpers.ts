import { BluetoothPrinterService } from '@/device/BluetoothPrinterService';
import { WiFiPrinterService } from '@/device/WiFiPrinterService';

/**
 * Print bill/receipt for an order
 * Tries Bluetooth first, then WiFi, then falls back to browser print
 * 
 * @param orderId - UUID of the order to print
 */
export const printBillForOrder = async (orderId: string): Promise<void> => {
  console.log('[PrintHelpers] printBillForOrder called:', orderId);
  
  // Try Bluetooth printer first
  if (BluetoothPrinterService.isConnected()) {
    const success = await BluetoothPrinterService.printReceipt(orderId);
    if (success) {
      console.log('[PrintHelpers] Printed via Bluetooth');
      return;
    }
  }

  // Try WiFi printer
  if (WiFiPrinterService.isConnected()) {
    const success = await WiFiPrinterService.print(orderId);
    if (success) {
      console.log('[PrintHelpers] Printed via WiFi');
      return;
    }
  }

  // Fallback to browser print dialog
  console.log('[PrintHelpers] Falling back to browser print');
  window.print();
};
