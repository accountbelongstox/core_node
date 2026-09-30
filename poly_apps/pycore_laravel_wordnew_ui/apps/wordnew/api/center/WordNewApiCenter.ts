/** The API center registry: every backend service wordnew configures, in display order. */
import { useSyncExternalStore } from 'react';
import { wordNewLaravelApiService } from './WordNewLaravelApiService';
import { wordNewPycoreApiService } from './WordNewPycoreApiService';
import type {
  WordNewApiService,
  WordNewApiServiceId,
  WordNewApiServiceSnapshot,
} from './WordNewApiServiceTypes';

export const WORDNEW_API_SERVICES: readonly WordNewApiService[] = Object.freeze([
  wordNewLaravelApiService,
  wordNewPycoreApiService,
]);

export function wordNewApiService(id: WordNewApiServiceId): WordNewApiService {
  return WORDNEW_API_SERVICES.find((service) => service.id === id) ?? wordNewLaravelApiService;
}

export function useWordNewApiService(service: WordNewApiService): WordNewApiServiceSnapshot {
  return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
}

export type * from './WordNewApiServiceTypes';
