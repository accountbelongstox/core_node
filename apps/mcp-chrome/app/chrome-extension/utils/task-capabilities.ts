/**
 * Task Center capability facade shared by the popup checkboxes and the
 * background scheduler / run-intent gate.
 *
 * A "capability" is one user-facing switch. It maps to the TaskCenter
 * processorTypes it activates. Keeping this catalog in one neutral module guarantees the popup UI
 * and the background can never disagree on which lanes a checkbox turns on.
 *
 * Definitions come from config/queue_center_contract.json. This module only
 * adapts the central snake_case fields to the existing popup API.
 */

import {
  CHROME_CAPABILITY_SWITCHES,
  type ChromeCapabilityKey,
} from './queue-center-contract';

export type CapabilityKey = ChromeCapabilityKey;

export interface CapabilityDef {
  key: CapabilityKey;
  /** chrome.storage key persisting this switch across popup blur/close. */
  storageKey: string;
  labelKey: string;
  hintKey: string;
  /** TaskCenter processorTypes this capability enables. */
  processors: string[];
}

export const CAPABILITIES: CapabilityDef[] = Object.entries(
  CHROME_CAPABILITY_SWITCHES,
).map(([key, definition]) => ({
  key: key as CapabilityKey,
  storageKey: definition.storage_key,
  labelKey: `taskCenterCapability_${key}_label`,
  hintKey: `taskCenterCapability_${key}_hint`,
  processors: [...definition.processors],
}));

// Audio generation remains implemented by the Qwen TTS processor but is not a
// Chrome Task-tab switch because Pycore owns production audio assistance.
// Article generation remains in the Pycore agent-history pipeline for the same
// reason; neither implementation is removed by this active catalog facade.

export const CAPABILITY_KEYS: CapabilityKey[] = CAPABILITIES.map((c) => c.key);

export const CAPABILITY_BY_KEY: Record<CapabilityKey, CapabilityDef> =
  CAPABILITIES.reduce(
    (acc, c) => {
      acc[c.key] = c;
      return acc;
    },
    {} as Record<CapabilityKey, CapabilityDef>,
  );

/** Deduped processorTypes for a set of capability keys. */
export function processorsForCapabilities(keys: CapabilityKey[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    const def = CAPABILITY_BY_KEY[key];
    if (def) {
      for (const processorType of def.processors) out.add(processorType);
    }
  }
  return Array.from(out);
}

export function sanitizeCapabilities(raw: unknown): CapabilityKey[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<CapabilityKey>();
  for (const key of raw) {
    if (typeof key === 'string' && (key as CapabilityKey) in CAPABILITY_BY_KEY) {
      out.add(key as CapabilityKey);
    }
  }
  return Array.from(out);
}

export function capabilitiesForProcessors(processors: string[]): CapabilityKey[] {
  const out = new Set<CapabilityKey>();
  for (const processorType of processors) {
    const capability = capabilityForProcessor(processorType);
    if (capability) out.add(capability);
  }
  return Array.from(out);
}

/** The capability that owns a given processorType, or null (for run-intent gating). */
export function capabilityForProcessor(processorType: string): CapabilityKey | null {
  for (const def of CAPABILITIES) {
    if (def.processors.includes(processorType)) return def.key;
  }
  return null;
}
