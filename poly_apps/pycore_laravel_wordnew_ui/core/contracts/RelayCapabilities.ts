/**
 * RelayCapabilities - declared relay capability providers
 * (DESIGN_20260817_2115 PART_3 §3.1, norm 1.8).
 *
 * Providers are DECLARED IN CODE (contract-declared, single source) and
 * rendered by the UI; they are NOT wired this pass - a provider entry tells
 * the roster which route families / roles an end MAY provide, not that the
 * capability executes. The roster consumes the same declarations when it
 * annotates `roster.update` payloads (machine class + provided families).
 */
import { QUEUE_CENTER_RELAY } from './QueueCenterContract';
import type { RelayCapabilityProvider } from '../integrations/laravel/LaravelTypes';

export type RelayProviderClass = 'machine' | 'ui-end';

export interface RelayCapabilityView {
  id: string;
  providerClass: RelayProviderClass;
  implemented: boolean;
  provides: string[];
}

/** Contract-declared providers rendered as view models (id-stable order). */
export function relayCapabilityProviders(): RelayCapabilityView[] {
  const declared = QUEUE_CENTER_RELAY.capability_providers as Record<string, RelayCapabilityProvider>;
  return Object.entries(declared).map(([id, provider]) => ({
    id,
    providerClass: (provider.class === 'machine' ? 'machine' : 'ui-end') as RelayProviderClass,
    implemented: !!provider.implemented,
    provides: Array.isArray(provider.provides) ? [...provider.provides] : [],
  }));
}

/** True when some declared provider actually implements $family. */
export function relayCapabilityProvided(family: string): boolean {
  return relayCapabilityProviders().some((provider) => provider.provides.includes(family));
}
