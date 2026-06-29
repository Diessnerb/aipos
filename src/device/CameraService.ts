import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface PhotoResult {
  dataUrl: string;
  format: string;
}

class CameraServiceClass {
  private isNative = Capacitor.isNativePlatform();

  async takePhoto(): Promise<PhotoResult | null> {
    if (!this.isNative) {
      return this.webFallbackCapture();
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      return {
        dataUrl: image.dataUrl || '',
        format: image.format
      };
    } catch (error) {
      console.error('[CameraService] Error taking photo:', error);
      return null;
    }
  }

  async selectFromGallery(): Promise<PhotoResult | null> {
    if (!this.isNative) {
      return this.webFallbackCapture();
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      return {
        dataUrl: image.dataUrl || '',
        format: image.format
      };
    } catch (error) {
      console.error('[CameraService] Error selecting from gallery:', error);
      return null;
    }
  }

  private webFallbackCapture(): Promise<PhotoResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            dataUrl: reader.result as string,
            format: file.type.split('/')[1] || 'jpeg'
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };

      input.click();
    });
  }
}

export const CameraService = new CameraServiceClass();
