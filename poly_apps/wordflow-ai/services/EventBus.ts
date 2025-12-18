/**
 * EventBus - Unified Event Management System
 *
 * Provides a type-safe event system for cross-component communication
 * without relying on window.dispatchEvent directly.
 *
 * Usage:
 * ```typescript
 * // Emit event
 * EventBus.emit('settings-changed', { theme: 'dark' });
 *
 * // Listen to event
 * const unsubscribe = EventBus.on('settings-changed', (data) => {
 *   console.log('Settings changed:', data);
 * });
 *
 * // Clean up
 * unsubscribe();
 * ```
 */

export type EventMap = {
  'settings-changed': any;
  'api-endpoint-changed': { endpointId: string };
  'language-changed': { language: string };
  'theme-changed': { theme: 'light' | 'dark' };
  'user-logged-in': { userId: string };
  'user-logged-out': void;
};

type EventCallback<T> = (data: T) => void;

class EventBusClass {
  private listeners: Map<keyof EventMap, Set<EventCallback<any>>> = new Map();

  /**
   * Emit an event
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] Error in listener for "${String(event)}":`, error);
        }
      });
    }

    // Also dispatch as CustomEvent for compatibility with existing code
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(event as string, {
        detail: data
      }));
    }
  }

  /**
   * Listen to an event
   * Returns unsubscribe function
   */
  on<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const callbacks = this.listeners.get(event)!;
    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Listen to an event once (auto-unsubscribe after first call)
   */
  once<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): () => void {
    const wrappedCallback = (data: EventMap[K]) => {
      callback(data);
      unsubscribe();
    };

    const unsubscribe = this.on(event, wrappedCallback);
    return unsubscribe;
  }

  /**
   * Remove all listeners for an event
   */
  off<K extends keyof EventMap>(event: K): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get number of listeners for an event
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): Array<keyof EventMap> {
    return Array.from(this.listeners.keys());
  }
}

// Export singleton instance
export const EventBus = new EventBusClass();

/**
 * React hook for listening to EventBus events
 * Automatically unsubscribes on unmount
 */
import { useEffect } from 'react';

export function useEventBus<K extends keyof EventMap>(
  event: K,
  callback: EventCallback<EventMap[K]>,
  deps: any[] = []
): void {
  useEffect(() => {
    const unsubscribe = EventBus.on(event, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
