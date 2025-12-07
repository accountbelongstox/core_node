// Tencent Map Geolocation Service
let locationModule: any = null;
let isModuleAvailable = false;

// Try to load location module
try {
  locationModule = require('@charer/react-native-tencentmap-geolocation');
  isModuleAvailable = true;
} catch (e) {
  console.warn('Tencent map geolocation module not available, using fallback:', e);
  isModuleAvailable = false;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  province?: string;
  district?: string;
  street?: string;
  streetNumber?: string;
}

class LocationService {
  private listeners: Array<(location: LocationData) => void> = [];
  private isInitialized = false;
  private isAvailable = false;

  constructor() {
    this.isAvailable = isModuleAvailable && locationModule !== null;
    if (!this.isAvailable) {
      console.warn('Location service unavailable, native module not properly linked');
    }
  }

  /**
   * Check if location service is available
   */
  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Initialize location service
   * @param level Location level: 0-High accuracy, 1-Device only, 2-Network only
   */
  init(level: number = 1) {
    if (!this.isAvailable) {
      console.warn('Location service unavailable, skipping initialization');
      return;
    }

    if (!this.isInitialized) {
      try {
        if (locationModule && locationModule.setRequestLevel) {
          locationModule.setRequestLevel(level);
          this.isInitialized = true;
        } else {
          console.warn('setRequestLevel method not available');
          this.isAvailable = false;
        }
      } catch (error) {
        console.error('Failed to initialize location service:', error);
        this.isAvailable = false;
      }
    }
  }

  /**
   * Add location listener
   * @param callback Location callback function
   * @returns Function to remove the listener
   */
  addListener(callback: (location: LocationData) => void): () => void {
    if (!this.isAvailable) {
      console.warn('Location service unavailable, cannot add listener');
      return () => {}; // Return empty function
    }

    this.init();
    
    const listener = (data: any) => {
      const location: LocationData = {
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        accuracy: data.accuracy,
        address: data.address,
        city: data.city,
        province: data.province,
        district: data.district,
        street: data.street,
        streetNumber: data.streetNumber,
      };
      callback(location);
    };

    try {
      this.listeners.push(callback);
      if (locationModule && locationModule.addLocationListener) {
        locationModule.addLocationListener(listener);
      } else {
        console.warn('addLocationListener method not available');
        return () => {};
      }
    } catch (error) {
      console.error('Failed to add location listener:', error);
      return () => {};
    }

    // Return function to remove listener
    return () => {
      this.removeListener(callback);
      try {
        if (locationModule && locationModule.removeLocationListener) {
          locationModule.removeLocationListener(listener);
        }
      } catch (error) {
        console.error('Failed to remove location listener:', error);
      }
    };
  }

  /**
   * Remove location listener
   */
  removeListener(callback: (location: LocationData) => void) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Request single location
   * @param needAddress Whether address information is needed
   */
  requestSingleLocation(needAddress: boolean = true): Promise<LocationData> {
    if (!this.isAvailable) {
      return Promise.reject(new Error('Location service unavailable, native module not properly linked'));
    }

    this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const removeListener = this.addListener((location) => {
          removeListener();
          resolve(location);
        });

        if (locationModule && locationModule.requestSingleLocation) {
          locationModule.requestSingleLocation(needAddress);
        } else {
          removeListener();
          reject(new Error('requestSingleLocation method not available'));
          return;
        }

        // Timeout handling
        setTimeout(() => {
          removeListener();
          reject(new Error('Location request timeout'));
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop location service
   */
  stop() {
    if (!this.isAvailable) {
      return;
    }
    try {
      if (locationModule && locationModule.stop) {
        locationModule.stop();
      }
    } catch (error) {
      console.error('Failed to stop location service:', error);
    }
  }

  /**
   * Cleanup all listeners
   */
  cleanup() {
    this.listeners.forEach(() => {
      this.stop();
    });
    this.listeners = [];
  }
}

export const locationService = new LocationService();

