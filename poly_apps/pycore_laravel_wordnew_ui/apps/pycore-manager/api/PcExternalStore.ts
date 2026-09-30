/**
 * PcExternalStore — the tiny shared state container behind the payload-driven
 * pycore-manager stores: one value, synchronous subscribers, a React hook.
 */
import { useSyncExternalStore } from 'react';

export interface PcExternalStore<T> {
  get: () => T;
  set: (next: T | ((previous: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  use: () => T;
}

export function createPcExternalStore<T>(initial: T): PcExternalStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const get = () => value;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  const set = (next: T | ((previous: T) => T)) => {
    value = typeof next === 'function' ? (next as (previous: T) => T)(value) : next;
    listeners.forEach((listener) => listener());
  };
  const use = () => useSyncExternalStore(subscribe, get, get);
  return { get, set, subscribe, use };
}
