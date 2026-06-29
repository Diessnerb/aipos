// Secure storage utilities to protect sensitive data in localStorage
import CryptoJS from 'crypto-js';

const STORAGE_KEY_PREFIX = 'secure_';

// Generate STABLE encryption key from browser fingerprint
const generateEncryptionKey = (): string => {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    // REMOVED screen dimensions - they change on tablet orientation!
    // Use more stable properties for mobile devices
    navigator.hardwareConcurrency || 'unknown',
    navigator.maxTouchPoints || 'unknown'
  ].join('|');
  
  // Use a more secure base key with stable browser fingerprint
  return CryptoJS.SHA256(fingerprint + 'restaurant_secure_2025_v2').toString();
};

// Fallback encryption key for items encrypted with old key format
const generateLegacyEncryptionKey = (): string => {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    navigator.platform
  ].join('|');
  
  return CryptoJS.SHA256(fingerprint + 'restaurant_secure_2025_stable').toString();
};

// Add visibility into SecureStorage failures
let lastDecryptionError: string | null = null;
export const getLastSecureStorageError = () => lastDecryptionError;

interface SecureStorageItem {
  data: string;
  timestamp: number;
  expires?: number;
}

export class SecureStorage {
  private static encrypt(data: string): string {
    try {
      const key = generateEncryptionKey();
      return CryptoJS.AES.encrypt(data, key).toString();
    } catch (error) {
      console.error('Encryption failed:', error);
      // Don't fallback to unencrypted for security
      throw new Error('Encryption failed - cannot store sensitive data');
    }
  }

  private static decrypt(encryptedData: string): string {
    try {
      // Try with current key first
      const key = generateEncryptionKey();
      const bytes = CryptoJS.AES.decrypt(encryptedData, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      // Verify decryption was successful
      if (decrypted) {
        return decrypted;
      }
      
      // If current key failed, try legacy key (for items encrypted before screen dimension removal)
      console.log('🔐 Trying legacy key for decryption...');
      const legacyKey = generateLegacyEncryptionKey();
      const legacyBytes = CryptoJS.AES.decrypt(encryptedData, legacyKey);
      const legacyDecrypted = legacyBytes.toString(CryptoJS.enc.Utf8);
      
      if (legacyDecrypted) {
        console.log('🔐 Successfully decrypted with legacy key');
        return legacyDecrypted;
      }
      
      throw new Error('Both current and legacy decryption failed');
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Decryption failed - data may be corrupted');
    }
  }

  static setItem(key: string, value: any, expiresInMinutes?: number): void {
    try {
      const storageItem: SecureStorageItem = {
        data: JSON.stringify(value),
        timestamp: Date.now(),
        expires: expiresInMinutes ? Date.now() + (expiresInMinutes * 60 * 1000) : undefined
      };

      const encryptedData = this.encrypt(JSON.stringify(storageItem));
      localStorage.setItem(STORAGE_KEY_PREFIX + key, encryptedData);
    } catch (error) {
      console.error('Failed to store secure item:', error);
    }
  }

  static getItem(key: string): any {
    try {
      const encryptedData = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      if (!encryptedData) {
        lastDecryptionError = null;
        return null;
      }

      const decryptedData = this.decrypt(encryptedData);
      const storageItem: SecureStorageItem = JSON.parse(decryptedData);

      // Check if item has expired
      if (storageItem.expires && Date.now() > storageItem.expires) {
        console.warn(`🔐 SecureStorage item '${key}' expired, removing`);
        this.removeItem(key);
        lastDecryptionError = `Item '${key}' expired`;
        return null;
      }

      lastDecryptionError = null;
      return JSON.parse(storageItem.data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      lastDecryptionError = `SecureStorage decrypt failed for '${key}': ${errorMsg}`;
      console.error('🔐 Failed to retrieve secure item:', error);
      console.error('🔐 This often happens after timezone changes or browser updates');
      
      // Clean up corrupted data but preserve the error info
      this.removeItem(key);
      
      // Dispatch custom event for UI to show re-auth prompt
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('secureStorageDecryptFailed', { 
          detail: { key, error: errorMsg } 
        }));
      }
      
      return null;
    }
  }

  static removeItem(key: string): void {
    localStorage.removeItem(STORAGE_KEY_PREFIX + key);
  }

  static clear(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  // Clean up expired items
  static cleanup(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        const encryptedData = localStorage.getItem(key);
        if (encryptedData) {
          try {
            const decryptedData = this.decrypt(encryptedData);
            const storageItem: SecureStorageItem = JSON.parse(decryptedData);
            
            if (storageItem.expires && Date.now() > storageItem.expires) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // Remove corrupted items
            localStorage.removeItem(key);
          }
        }
      }
    });
  }
}

// Auto-cleanup expired items on page load
if (typeof window !== 'undefined') {
  SecureStorage.cleanup();
}

// UI Lock mechanism for idle timeout and manual logout
export const setUILock = (locked: boolean) => {
  if (locked) {
    SecureStorage.setItem('uiLocked', true);
  } else {
    SecureStorage.removeItem('uiLocked');
  }
  // Dispatch event to notify components
  window.dispatchEvent(new CustomEvent('uiLockChanged', { detail: { locked } }));
};

export const isUILocked = (): boolean => {
  return SecureStorage.getItem('uiLocked') === true;
};

export const clearUILock = () => {
  SecureStorage.removeItem('uiLocked');
  window.dispatchEvent(new CustomEvent('uiLockChanged', { detail: { locked: false } }));
};
