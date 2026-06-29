import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';

export type PermissionType = 'camera' | 'photos' | 'notifications';
export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

interface PermissionResult {
  status: PermissionStatus;
  type: PermissionType;
}

class CapacitorPermissionManagerService {
  private isNative = Capacitor.isNativePlatform();

  async checkAllPermissions(): Promise<PermissionResult[]> {
    if (!this.isNative) {
      return [
        { type: 'camera', status: 'granted' },
        { type: 'photos', status: 'granted' },
        { type: 'notifications', status: 'granted' }
      ];
    }

    const results: PermissionResult[] = [];

    try {
      const cameraStatus = await Camera.checkPermissions();
      results.push({
        type: 'camera',
        status: this.mapPermissionStatus(cameraStatus.camera)
      });
      results.push({
        type: 'photos',
        status: this.mapPermissionStatus(cameraStatus.photos)
      });
    } catch (error) {
      console.warn('[PermissionManager] Error checking camera permissions:', error);
      results.push({ type: 'camera', status: 'unknown' });
      results.push({ type: 'photos', status: 'unknown' });
    }

    try {
      const notifStatus = await LocalNotifications.checkPermissions();
      results.push({
        type: 'notifications',
        status: this.mapPermissionStatus(notifStatus.display)
      });
    } catch (error) {
      console.warn('[PermissionManager] Error checking notification permissions:', error);
      results.push({ type: 'notifications', status: 'unknown' });
    }

    return results;
  }

  async requestPermission(type: PermissionType): Promise<PermissionStatus> {
    if (!this.isNative) {
      return 'granted';
    }

    try {
      switch (type) {
        case 'camera':
        case 'photos': {
          const result = await Camera.requestPermissions();
          return this.mapPermissionStatus(result[type]);
        }
        case 'notifications': {
          const result = await LocalNotifications.requestPermissions();
          return this.mapPermissionStatus(result.display);
        }
        default:
          return 'unknown';
      }
    } catch (error) {
      console.error(`[PermissionManager] Error requesting ${type} permission:`, error);
      return 'denied';
    }
  }

  private mapPermissionStatus(status: string): PermissionStatus {
    switch (status) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'prompt':
      case 'prompt-with-rationale':
        return 'prompt';
      default:
        return 'unknown';
    }
  }

  isNativePlatform(): boolean {
    return this.isNative;
  }
}

export const CapacitorPermissionManager = new CapacitorPermissionManagerService();
