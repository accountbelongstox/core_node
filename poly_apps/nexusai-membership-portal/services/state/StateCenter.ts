/**
 * StateCenter - Unified State Management
 * Centralized state management with caching and reactivity
 */

import { cacheManager } from '../cache/CacheManager';
import { SystemStatus } from '../../types';
import { AVAILABILITY_DATA } from '../../constants';

export interface AppState {
  // Availability/Status
  availabilityData: SystemStatus[];
  lastAvailabilityUpdate: number;
  
  // User data
  userProfile: any | null;
  userApiKeys: any[];
  userUsage: any | null;
  userSubscription: any | null;
  
  // Dashboard data
  dashboardStats: any | null;
  
  // System data
  systemMetrics: any | null;
  
  // Loading states
  loading: {
    availability: boolean;
    userProfile: boolean;
    dashboard: boolean;
    [key: string]: boolean;
  };
}

type StateListener = (state: AppState) => void;
type StateKey = keyof AppState;

class StateCenterClass {
  private state: AppState = {
    availabilityData: [],
    lastAvailabilityUpdate: 0,
    userProfile: null,
    userApiKeys: [],
    userUsage: null,
    userSubscription: null,
    dashboardStats: null,
    systemMetrics: null,
    loading: {
      availability: false,
      userProfile: false,
      dashboard: false,
    },
  };

  private listeners: Set<StateListener> = new Set();
  private cacheKeys = {
    availability: 'state:availability',
    userProfile: 'state:userProfile',
    userApiKeys: 'state:userApiKeys',
    userUsage: 'state:userUsage',
    userSubscription: 'state:userSubscription',
    dashboardStats: 'state:dashboardStats',
    systemMetrics: 'state:systemMetrics',
  };

  constructor() {
    // Load initial state from cache
    this.loadFromCache();
    
    // Initialize with default availability data
    if (this.state.availabilityData.length === 0) {
      this.state.availabilityData = AVAILABILITY_DATA;
      this.state.lastAvailabilityUpdate = Date.now();
    }
  }

  /**
   * Get current state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get specific state value
   */
  get<K extends StateKey>(key: K): AppState[K] {
    return this.state[key];
  }

  /**
   * Set state value
   */
  set<K extends StateKey>(key: K, value: AppState[K], cache: boolean = true): void {
    this.state[key] = value;
    
    // Cache if enabled
    if (cache && this.cacheKeys[key as string]) {
      const cacheKey = this.cacheKeys[key as string];
      cacheManager.set(cacheKey, value, 5 * 60 * 1000); // 5 minutes
    }
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Update state partially
   */
  update(updates: Partial<AppState>, cache: boolean = true): void {
    Object.keys(updates).forEach((key) => {
      const stateKey = key as StateKey;
      this.set(stateKey, updates[stateKey] as any, cache);
    });
  }

  /**
   * Set loading state
   */
  setLoading(key: string, loading: boolean): void {
    this.state.loading[key] = loading;
    this.notifyListeners();
  }

  /**
   * Get loading state
   */
  isLoading(key: string): boolean {
    return this.state.loading[key] || false;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('[StateCenter] Listener error:', error);
      }
    });
  }

  /**
   * Load state from cache
   */
  private loadFromCache(): void {
    Object.keys(this.cacheKeys).forEach((key) => {
      const cacheKey = this.cacheKeys[key as keyof typeof this.cacheKeys];
      const cached = cacheManager.get(cacheKey);
      if (cached !== null) {
        (this.state as any)[key] = cached;
      }
    });
  }

  /**
   * Clear all state and cache
   */
  clear(): void {
    this.state = {
      availabilityData: [],
      lastAvailabilityUpdate: 0,
      userProfile: null,
      userApiKeys: [],
      userUsage: null,
      userSubscription: null,
      dashboardStats: null,
      systemMetrics: null,
      loading: {
        availability: false,
        userProfile: false,
        dashboard: false,
      },
    };
    
    // Clear related cache
    Object.values(this.cacheKeys).forEach((key) => {
      cacheManager.remove(key);
    });
    
    this.notifyListeners();
  }

  /**
   * Refresh availability data
   */
  async refreshAvailability(): Promise<void> {
    this.setLoading('availability', true);
    
    try {
      // TODO: Fetch from unified API
      // For now, use mock data with slight randomization
      const data = AVAILABILITY_DATA.map((item) => ({
        ...item,
        latency: item.latency,
        uptime: item.uptime,
      }));
      
      this.set('availabilityData', data);
      this.set('lastAvailabilityUpdate', Date.now());
    } catch (error) {
      console.error('[StateCenter] Refresh availability error:', error);
    } finally {
      this.setLoading('availability', false);
    }
  }

  /**
   * Get availability data (with auto-refresh if stale)
   */
  getAvailability(autoRefresh: boolean = true): SystemStatus[] {
    const data = this.get('availabilityData');
    const lastUpdate = this.get('lastAvailabilityUpdate');
    const stale = Date.now() - lastUpdate > 5 * 60 * 1000; // 5 minutes
    
    if (autoRefresh && stale && !this.isLoading('availability')) {
      this.refreshAvailability();
    }
    
    return data.length > 0 ? data : AVAILABILITY_DATA;
  }
}

// Singleton instance
export const stateCenter = new StateCenterClass();

