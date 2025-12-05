import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface TacticalCoordinates {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface TacticalCacheItem<T> {
  timestamp: number;
  data: T;
}

/**
 * TacticalDevice
 * Abstract layer for device hardware interactions.
 * Handles Camera, Geolocation, and Secure File Caching.
 */
export class TacticalDevice {
  
  /**
   * Capture Intel (Photo)
   * Launches camera or gallery to capture an image.
   * @param source CameraSource.Camera or CameraSource.Photos
   */
  static async captureIntel(source: CameraSource = CameraSource.Camera): Promise<Photo | null> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source
      });
      return image;
    } catch (error) {
      console.warn('[TACTICAL DEVICE] Camera engagement failed or cancelled', error);
      return null;
    }
  }

  /**
   * Acquire Coordinates (Geolocation)
   * Gets the current device position with high accuracy.
   */
  static async acquirePosition(): Promise<TacticalCoordinates | null> {
    try {
      const hasPermission = await Geolocation.checkPermissions();
      
      if (hasPermission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') return null;
      }

      const coordinates: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      return {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
        timestamp: coordinates.timestamp
      };
    } catch (error) {
      console.error('[TACTICAL DEVICE] GPS signal lost', error);
      return null;
    }
  }

  /**
   * Secure Log (File Write)
   * Writes data to the Documents directory.
   * @param filename The identifier for the intel
   * @param data The payload to store (string)
   */
  static async secureLog(filename: string, data: string): Promise<boolean> {
    try {
      await Filesystem.writeFile({
        path: filename,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return true;
    } catch (error) {
      console.error('[TACTICAL DEVICE] Write protocol failed', error);
      return false;
    }
  }

  /**
   * Read Log (File Read)
   * Reads data from the Documents directory.
   * @param filename The identifier for the intel
   */
  static async readLog(filename: string): Promise<string | null> {
    try {
      const contents = await Filesystem.readFile({
        path: filename,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return contents.data as string;
    } catch (error) {
      // File might not exist, silent fail
      return null;
    }
  }

  /**
   * Cache Intel (JSON Caching)
   * Stores a JSON object with a timestamp.
   */
  static async cacheIntel<T>(key: string, data: T): Promise<void> {
    const payload: TacticalCacheItem<T> = {
      timestamp: Date.now(),
      data: data
    };
    await this.secureLog(`cache_${key}.json`, JSON.stringify(payload));
  }

  /**
   * Retrieve Cached Intel
   * Retrieves JSON object if it exists.
   */
  static async getCachedIntel<T>(key: string): Promise<T | null> {
    const raw = await this.readLog(`cache_${key}.json`);
    if (!raw) return null;
    
    try {
      const payload = JSON.parse(raw) as TacticalCacheItem<T>;
      return payload.data;
    } catch (e) {
      return null;
    }
  }
}