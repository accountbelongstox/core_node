import relayContract from '../../../../config/pycore_relay_contract.json';

export type RelayEndpointName = keyof typeof relayContract.endpoints;
export type RelayEventName = keyof typeof relayContract.events;
export type RelayRoutePolicyProfileName = keyof typeof relayContract.route_policy_profiles;
export type RelayOperationState = typeof relayContract.operation_states[number];

export interface RelayDevice {
  online: boolean;
  group_id?: string;
  device_id: string;
  label: string;
  platform: string;
  status: string;
  capabilities: string[];
  last_seen_at: string | null;
  credential_expires_at: string | null;
}

export interface RelayPairing {
  pairing_id: string;
  device_id: string;
  state: string;
  revision: number;
  expires_at: string;
}

export interface RelayHub {
  url: string;
  topic: string;
  topics: string[];
  subscriber_token: string;
  expires_in_seconds: number;
  contract_digest: string;
}

export interface RelayOperation {
  operation_id: string;
  device_id: string;
  pairing_id: string;
  state: RelayOperationState;
  revision: number;
  retry_policy: string;
  response_status: number | null;
  response_headers: Record<string, string> | null;
  response_body_present: boolean | null;
  response_body_base64: string | null;
  response_body_ref: string | null;
  response_body_sha256: string | null;
  response_body_length: number | null;
  error_code: string | null;
  accepted_at: string | null;
  execution_started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

export interface RelayOperationAdmission {
  operation_id: string;
  idempotency_key: string;
  pairing_id: string;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body_present: boolean;
  body_sha256: string;
  body_length: number;
  body_base64?: string;
  body_ref?: string;
}

export const RELAY_CONTRACT = relayContract;

/** Wire type of one contract relay event (for example `agent_history.config.changed`). */
export function relayEventType(name: RelayEventName): string {
  return String(relayContract.events[name]);
}

/** Client-side timeout of one relay route policy profile. */
export function relayRoutePolicyTimeoutMs(profile: RelayRoutePolicyProfileName): number {
  return relayContract.route_policy_profiles[profile].timeout_seconds * 1000;
}

export function relayEndpoint(
  name: RelayEndpointName,
  values: Record<string, string | number> = {},
): string {
  return Object.entries(values).reduce(
    (path, [key, value]) => path.replace(`{${key}}`, encodeURIComponent(String(value))),
    relayContract.endpoints[name] as string,
  );
}
