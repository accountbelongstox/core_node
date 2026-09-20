import { RELAY_CONTRACT, relayEndpoint, type RelayDevice, type RelayHub, type RelayOperation, type RelayOperationAdmission, type RelayPairing } from '../../contracts/RelayContract';
import { BaseAPI } from './transport/BaseAPI';
import { createFixedLaravelModuleConfig } from './transport/ApiContract';
import { readLaravelResponse } from './LaravelRequest';
import { unwrapLaravelData as unwrapData } from './transport/LaravelEnvelope';

type RelayMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RelayDeviceRoster {
  server_time_unix: number | null;
  devices: RelayDevice[];
  recommended_device_id: string | null;
  selection_reason: string;
  group_id: string | null;
  unavailable_code: string | null;
  unavailable_message: string | null;
}

const relayHttp = new BaseAPI(createFixedLaravelModuleConfig(
  '',
  RELAY_CONTRACT.public_urls.laravel_api_origin,
));

const ROUTES = {
  relayEnrollmentClaim: relayEndpoint('owner_enrollment_claim'),
  relayDevices: relayEndpoint('owner_device_roster'),
  relayPairings: relayEndpoint('owner_pairing_create'),
  relayPairingRenew: (pairingId: string): string =>
    relayEndpoint('owner_pairing_renew', { pairingId }),
  relayPairingRevoke: (pairingId: string): string =>
    relayEndpoint('owner_pairing_revoke', { pairingId }),
  relayOperations: relayEndpoint('owner_operation_admit'),
  relayOwnerHubAuth: relayEndpoint('owner_hub_authorization'),
  relayOperation: (operationId: string): string =>
    relayEndpoint('owner_operation_status', { operationId }),
  relayOperationCancel: (operationId: string): string =>
    relayEndpoint('owner_operation_cancel', { operationId }),
  relayRequestBlobs: relayEndpoint('owner_request_blob_allocate'),
  relayRequestBlobChunk: (blobId: string, chunkIndex: number): string =>
    relayEndpoint('owner_request_blob_chunk', { blobId, chunkIndex }),
  relayRequestBlobFinalize: (blobId: string): string =>
    relayEndpoint('owner_request_blob_finalize', { blobId }),
  relayResponseBlob: (blobId: string): string =>
    relayEndpoint('owner_response_blob_download', { blobId }),
} as const;

function readRelayDeviceRoster(payload: unknown): RelayDeviceRoster {
  const data = unwrapData<unknown>(payload);
  const devices = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as { devices?: unknown }).devices
    : undefined;
  if (!Array.isArray(devices)) {
    throw Object.assign(new Error('RELAY_ROSTER_PAYLOAD_INVALID'), {
      status: 502,
      code: 'RELAY_ROSTER_PAYLOAD_INVALID',
      payload,
    });
  }
  const recommendedDeviceId = (data as { recommended_device_id?: unknown }).recommended_device_id;
  const selectionReason = (data as { selection_reason?: unknown }).selection_reason;
  const group = data as { server_time_unix?: unknown; group_id?: unknown; unavailable_code?: unknown; unavailable_message?: unknown };
  return {
    server_time_unix: typeof group.server_time_unix === 'number' ? group.server_time_unix : null,
    devices: devices as RelayDevice[],
    recommended_device_id: typeof recommendedDeviceId === 'string' && recommendedDeviceId
      ? recommendedDeviceId
      : null,
    selection_reason: typeof selectionReason === 'string' ? selectionReason : '',
    group_id: typeof group.group_id === 'string' ? group.group_id : null,
    unavailable_code: typeof group.unavailable_code === 'string' ? group.unavailable_code : null,
    unavailable_message: typeof group.unavailable_message === 'string' ? group.unavailable_message : null,
  };
}

async function requestRelay<T>(method: RelayMethod, path: string, payload?: unknown): Promise<T> {
  const hasBody = method !== 'GET' && payload !== undefined;
  const response = await relayHttp.rawRequest(path, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(payload) : undefined,
    credentials: 'omit',
  }, false);
  return readLaravelResponse<T>(response, path);
}

export const laravelRelayApi = {
  relayClaimEnrollment: async (claimCode: string): Promise<RelayDevice> => {
    const payload = await requestRelay<any>('POST', ROUTES.relayEnrollmentClaim, { claim_code: claimCode });
    return unwrapData<{ device: RelayDevice }>(payload).device;
  },
  getRelayDevices: async (): Promise<RelayDeviceRoster> => {
    const payload = await requestRelay<any>('GET', ROUTES.relayDevices);
    return readRelayDeviceRoster(payload);
  },
  createRelayPairing: async (deviceId: string, clientInstanceId: string): Promise<RelayPairing> => {
    const payload = await requestRelay<any>('POST', ROUTES.relayPairings, {
      device_id: deviceId,
      client_instance_id: clientInstanceId,
    });
    return unwrapData<{ pairing: RelayPairing }>(payload).pairing;
  },
  renewRelayPairing: async (pairingId: string): Promise<RelayPairing> => {
    const payload = await requestRelay<any>('POST', ROUTES.relayPairingRenew(pairingId));
    return unwrapData<{ pairing: RelayPairing }>(payload).pairing;
  },
  revokeRelayPairing: async (pairingId: string): Promise<RelayPairing> => {
    const payload = await requestRelay<any>('DELETE', ROUTES.relayPairingRevoke(pairingId));
    return unwrapData<{ pairing: RelayPairing }>(payload).pairing;
  },
  admitRelayOperation: async (frame: RelayOperationAdmission): Promise<RelayOperation> => {
    const payload = await requestRelay<any>('POST', ROUTES.relayOperations, frame);
    return unwrapData<{ operation: RelayOperation }>(payload).operation;
  },
  getRelayOwnerHubAuth: async (): Promise<RelayHub> => {
    const payload = await requestRelay<any>('POST', ROUTES.relayOwnerHubAuth, {});
    return unwrapData<{ hub: RelayHub }>(payload).hub;
  },
  getRelayOperation: async (operationId: string): Promise<RelayOperation> => {
    const payload = await requestRelay<any>('GET', ROUTES.relayOperation(operationId));
    return unwrapData<{ operation: RelayOperation }>(payload).operation;
  },
  cancelRelayOperation: async (operationId: string): Promise<RelayOperation> => {
    const payload = await requestRelay<any>('POST', ROUTES.relayOperationCancel(operationId));
    return unwrapData<{ operation: RelayOperation }>(payload).operation;
  },
  allocateRelayRequestBlob: async (
    blobId: string,
    pairingId: string,
    sha256: string,
    length: number,
  ): Promise<void> => {
    await requestRelay<any>('POST', ROUTES.relayRequestBlobs, {
      blob_id: blobId,
      pairing_id: pairingId,
      direction: 'request',
      expected_sha256: sha256,
      expected_length: length,
    });
  },
  putRelayRequestBlobChunk: async (
    blobId: string,
    chunkIndex: number,
    bytes: Uint8Array,
  ): Promise<void> => {
    const response = await relayHttp.rawRequest(ROUTES.relayRequestBlobChunk(blobId, chunkIndex), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      credentials: 'omit',
    }, false);
    if (!response.ok) await readLaravelResponse(response, response.url);
  },
  finalizeRelayRequestBlob: async (blobId: string, sha256: string, length: number): Promise<void> => {
    await requestRelay<any>('POST', ROUTES.relayRequestBlobFinalize(blobId), {
      blob_id: blobId,
      expected_sha256: sha256,
      expected_length: length,
    });
  },
  getRelayResponseBlob: async (blobId: string): Promise<Uint8Array> => {
    const response = await relayHttp.rawRequest(ROUTES.relayResponseBlob(blobId), {
      method: 'GET',
      credentials: 'omit',
    }, false);
    if (!response.ok) await readLaravelResponse(response, response.url);
    return new Uint8Array(await response.arrayBuffer());
  },
};
