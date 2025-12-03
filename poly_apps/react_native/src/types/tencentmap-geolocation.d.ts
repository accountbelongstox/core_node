declare module '@charer/react-native-tencentmap-geolocation' {
  export interface LocationResult {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
    city?: string;
    province?: string;
    district?: string;
    street?: string;
    streetNumber?: string;
    [key: string]: any;
  }

  export type LocationListener = (location: LocationResult) => void;

  /**
   * Set location request level
   * @param level 0-High accuracy, 1-Device only, 2-Network only
   */
  export function setRequestLevel(level: number): void;

  /**
   * Add location listener
   * @param listener Listener function
   * @returns Function to remove the listener
   */
  export function addLocationListener(listener: LocationListener): () => void;

  /**
   * Remove location listener
   * @param listener Listener function
   */
  export function removeLocationListener(listener: LocationListener): void;

  /**
   * Stop location service
   */
  export function stop(): void;

  /**
   * Request single location
   * @param needAddress Whether address information is needed
   */
  export function requestSingleLocation(needAddress: boolean): void;
}

