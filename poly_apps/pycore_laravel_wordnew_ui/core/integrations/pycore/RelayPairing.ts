import { RELAY_CONTRACT, relayEventType, type RelayPairing } from '../../contracts/RelayContract';
import { laravelRelayApi as laravelApi } from '../laravel/LaravelRelayAPI';
import { laravelRelayRoster } from '../laravel/LaravelRelayRoster';
import { laravelRelayStream } from '../laravel/LaravelRelayStream';
import { StorageManager } from '../../persistence';
import { isPycoreRelayMode } from './pycoreTarget';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { PycoreRelayError } from './PycoreRelayError';
import { newUuid } from './PycoreRelayWire';
import { subscribeAuthSession } from '../../auth/AuthSession';

interface PersistedRelayState {
  client_instance_id: string;
  selected_device_id: string | null;
  pairings: Record<string, RelayPairing>;
}

const PAIR_RENEW_MARGIN_MS = Math.floor(RELAY_CONTRACT.durations.pairing_lease_seconds * 200);
const RECOVERABLE_PAIRING_CODES = ['pairing_not_found', 'pairing_not_active', 'pairing_expired', 'pairing_credential_stale'];
const PAIRING_CHANGED_EVENT = relayEventType('pairing_changed');
const pairFlights = new Map<string, Promise<RelayPairing>>();
const selectionHandlers = new Set<(deviceId: string | null) => void>();
let relayState: PersistedRelayState | null = null;
let authGeneration = 0;

function notifySelection(deviceId: string | null): void {
  selectionHandlers.forEach((handler) => handler(deviceId));
}

function persistRelayState(): void {
  if (relayState) StorageManager.set(StorageKeys.RELAY_STATE, relayState);
}

function loadRelayState(): PersistedRelayState {
  if (relayState) return relayState;
  const stored = StorageManager.get<Partial<PersistedRelayState> | null>(StorageKeys.RELAY_STATE, null);
  relayState = {
    client_instance_id: typeof stored?.client_instance_id === 'string' && stored.client_instance_id.length >= 16
      ? stored.client_instance_id
      : newUuid(),
    selected_device_id: typeof stored?.selected_device_id === 'string' ? stored.selected_device_id : null,
    pairings: {},
  };
  persistRelayState();
  return relayState;
}

function assignSelectedDevice(state: PersistedRelayState, deviceId: string | null): void {
  if (state.selected_device_id === deviceId) return;
  state.selected_device_id = deviceId;
  persistRelayState();
  notifySelection(deviceId);
}

function pairingFresh(pairing: RelayPairing | undefined): boolean {
  if (!pairing || pairing.state !== 'active') return false;
  const expiresAt = Date.parse(pairing.expires_at);
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > PAIR_RENEW_MARGIN_MS;
}

export function recoverablePairingError(error: unknown): boolean {
  const failure = error as { status?: number; payload?: { error_code?: string } };
  return (failure?.status === 404 || failure?.status === 409)
    && RECOVERABLE_PAIRING_CODES.includes(failure.payload?.error_code || '');
}

function invalidatePairing(pairing: RelayPairing): void {
  const state = loadRelayState();
  if (state.pairings[pairing.device_id]?.pairing_id !== pairing.pairing_id
    || state.pairings[pairing.device_id].revision > pairing.revision) return;
  delete state.pairings[pairing.device_id];
  persistRelayState();
}

// Pairings belong to the authenticated owner: an auth change drops them and
// fences in-flight pairing work; the selection is revalidated against the
// next owner's roster before use.
subscribeAuthSession(() => {
  authGeneration += 1;
  pairFlights.clear();
  if (!relayState) return;
  relayState.pairings = {};
  persistRelayState();
});

export function relayAuthGeneration(): number {
  return authGeneration;
}

export function assertRelayAuthGeneration(generation: number): void {
  if (generation !== authGeneration) throw new DOMException('Aborted', 'AbortError');
}

laravelRelayStream.onEvent((event, data) => {
  const frame = data as { pairing_id?: string; revision?: number } | null;
  if (event !== PAIRING_CHANGED_EVENT || !frame?.pairing_id) return;
  for (const pairing of Object.values(loadRelayState().pairings)) {
    if (pairing.pairing_id === frame.pairing_id && Number(frame.revision) > pairing.revision) {
      invalidatePairing(pairing);
    }
  }
});

export function laravelRelayDeviceId(): string | null {
  return loadRelayState().selected_device_id;
}

export function subscribeLaravelRelayDevice(
  handler: (deviceId: string | null) => void,
): () => void {
  selectionHandlers.add(handler);
  handler(laravelRelayDeviceId());
  return () => selectionHandlers.delete(handler);
}

export function isLaravelRelayReady(): boolean {
  return isPycoreRelayMode() && laravelRelayDeviceId() !== null;
}

export async function designateLaravelRelayDevice(deviceId: string): Promise<RelayPairing> {
  const state = loadRelayState();
  const generation = authGeneration;
  assignSelectedDevice(state, deviceId);
  const current = state.pairings[deviceId];
  if (pairingFresh(current)) return current!;
  const inFlight = pairFlights.get(deviceId);
  if (inFlight) return inFlight;
  const request = (current
    ? laravelApi.renewRelayPairing(current.pairing_id).catch((error: any) => {
        assertRelayAuthGeneration(generation);
        if (recoverablePairingError(error)) {
          return laravelApi.createRelayPairing(deviceId, state.client_instance_id);
        }
        throw error;
      })
    : laravelApi.createRelayPairing(deviceId, state.client_instance_id))
    .then((pairing) => {
      assertRelayAuthGeneration(generation);
      state.pairings[deviceId] = pairing;
      persistRelayState();
      return pairing;
    })
    .finally(() => {
      if (pairFlights.get(deviceId) === request) pairFlights.delete(deviceId);
    });
  pairFlights.set(deviceId, request);
  return request;
}

export async function clearLaravelRelayDevice(): Promise<void> {
  const state = loadRelayState();
  const deviceId = state.selected_device_id;
  const pairing = deviceId ? state.pairings[deviceId] : undefined;
  if (pairing) {
    await laravelApi.revokeRelayPairing(pairing.pairing_id);
    delete state.pairings[pairing.device_id];
  }
  assignSelectedDevice(state, null);
}

async function resolvePairing(): Promise<RelayPairing> {
  const state = loadRelayState();
  let deviceId = state.selected_device_id;
  const generation = authGeneration;
  const devices = await laravelRelayRoster.requireDevices();
  assertRelayAuthGeneration(generation);
  const selected = devices.find((device) => device.device_id === deviceId);
  if (deviceId && !selected) {
    delete state.pairings[deviceId];
    assignSelectedDevice(state, null);
    deviceId = null;
  }
  if (!deviceId) {
    deviceId = laravelRelayRoster.preferredDeviceId();
    if (!deviceId) {
      const unavailable = laravelRelayRoster.unavailableError();
      throw Object.assign(new PycoreRelayError('not-paired', unavailable.message, 503), unavailable);
    }
  }
  return designateLaravelRelayDevice(deviceId).catch((error: any) => {
    if (error?.status === 404 || error?.status === 409) {
      throw new PycoreRelayError('peer-offline', 'RELAY_DEVICE_UNAVAILABLE', error.status);
    }
    throw error;
  });
}

/** A fresh stored pairing is reused as is; the roster is only consulted when none is usable. */
export async function ensureRelayPairing(): Promise<RelayPairing> {
  const state = loadRelayState();
  const current = state.selected_device_id ? state.pairings[state.selected_device_id] : undefined;
  return pairingFresh(current) ? current! : resolvePairing();
}

export async function recoverRelayPairing(pairing: RelayPairing): Promise<RelayPairing> {
  invalidatePairing(pairing);
  return resolvePairing();
}
