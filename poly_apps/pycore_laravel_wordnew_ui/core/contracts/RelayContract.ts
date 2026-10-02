import relayContract from '../../../../config/pycore_relay_contract.json';
import relayContractRaw from '../../../../config/pycore_relay_contract.json?raw';
import { sha256Hex } from '../utils/contentHash';

export type RelayEndpointName = keyof typeof relayContract.endpoints;
export type RelayEventName = keyof typeof relayContract.events;
export type RelayErrorName = keyof typeof relayContract.errors;
export type RelayRoutePolicyProfileName = keyof typeof relayContract.route_policy_profiles;


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

export interface RelayGrantDevice {
  device_id: string;
  pairing_id: string;
  response_topic: string;
  online: boolean;
  last_seen_ms: number;
}

export interface RelayGrant {
  hub_url: string;
  subscriber_token: string;
  owner_topic: string;
  topics: string[];
  devices: RelayGrantDevice[];
  grant_version: number | string;
  expires_in_seconds: number;
  contract_digest: string;
  server_time_ms: number;
}

export interface RelayFrameBody {
  present: boolean;
  length: number;
  sha256: string;
  base64: string | null;
  ref: string | null;
}

export interface RelayFrameRequest {
  operation_id: string;
  pairing_id: string;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: RelayFrameBody;
}

export interface RelayFrameAnswer {
  operation_id: string;
  deadline_ms: number;
  device_id: string;
  server_time_ms: number;
  ack_required: boolean;
}

export type RelayResponseKind = typeof relayContract.frame_profile.response_kinds[number];

export interface RelayResponseFrame {
  v: number;
  op: string;
  k: RelayResponseKind;
  s: number;
  h?: Record<string, string> | null;
  b?: { len?: number; sha256?: string; b64?: string | null; ref?: string | null } | null;
  part?: { i: number; n: number } | null;
  t?: { dev_recv?: number; exec_ms?: number; dev_send?: number } | null;
  p?: { phase: string; done: number | null; total: number | null; bytes: number | null } | null;
}

export interface RelayTelemetryItem {
  operation_id: string;
  route_policy: string;
  http_status: number;
  outcome: string;
  t_ui_send: number;
  t_ui_recv: number;
  dev_recv: number;
  dev_send: number;
  exec_ms: number;
  bytes_in: number;
  bytes_out: number;
}

export interface RelayRouteStats {
  route_policy: string;
  calls: number;
  error_rate: number;
  p50_ms: number;
  p90_ms: number;
  p99_ms: number;
}

export const RELAY_CONTRACT = relayContract as typeof relayContract;

/** Same canonical bytes as pycore/Laravel: CRLF folded to LF, then SHA-256 of the file bytes. */
export const RELAY_CONTRACT_DIGEST = sha256Hex(relayContractRaw.replace(/\r\n/g, '\n'));

/** Wire type of one contract relay event (for example `agent_history.config.changed`). */
export function relayEventType(name: RelayEventName): string {
  return String(RELAY_CONTRACT.events[name]);
}

/** Client-side timeout of one relay route policy profile. */
export function relayRoutePolicyTimeoutMs(profile: RelayRoutePolicyProfileName): number {
  return RELAY_CONTRACT.route_policy_profiles[profile].timeout_seconds * 1000;
}

interface RelayRoutePolicy {
  match: 'exact' | 'prefix' | 'suffix';
  value: string;
  profile: string;
  methods: string[];
}

const RELAY_ROUTE_POLICIES = RELAY_CONTRACT.route_policies as RelayRoutePolicy[];
const RELAY_POLICY_MATCHERS: Record<RelayRoutePolicy['match'], (route: string, value: string) => boolean> = {
  exact: (route, value) => route === value,
  prefix: (route, value) => route.startsWith(value),
  suffix: (route, value) => route.endsWith(value),
};

/** Profile a route resolves to (exact, then prefix, then suffix; longest value wins; contract default otherwise). */
export function relayRoutePolicyProfile(route: string): string {
  const order = RELAY_CONTRACT.route_policy_matching.precedence as RelayRoutePolicy['match'][];
  for (const kind of order) {
    const hits = RELAY_ROUTE_POLICIES.filter((policy) => policy.match === kind && RELAY_POLICY_MATCHERS[kind](route, policy.value));
    if (hits.length) return hits.reduce((best, hit) => (hit.value.length > best.value.length ? hit : best)).profile;
  }
  return RELAY_CONTRACT.route_policy_matching.default_profile;
}

/** Delivery guarantee of a route (`read`, `idempotent_write`, `at_most_once_action`), from its policy profile. */
export function relayRouteDelivery(route: string): string {
  const profile = RELAY_CONTRACT.route_policy_profiles[relayRoutePolicyProfile(route) as RelayRoutePolicyProfileName];
  return profile?.delivery ?? '';
}

/** True when the relay never carries the route: the UI must treat it as direct-only. */
export function isRelayRouteDenied(route: string): boolean {
  const profile = RELAY_CONTRACT.route_policy_profiles[relayRoutePolicyProfile(route) as RelayRoutePolicyProfileName];
  return profile?.exposure === 'denied';
}

export function relayErrorStatus(name: RelayErrorName): number {
  return RELAY_CONTRACT.errors[name];
}

export function relayEndpoint(
  name: RelayEndpointName,
  values: Record<string, string | number> = {},
): string {
  return Object.entries(values).reduce(
    (path, [key, value]) => path.replace(`{${key}}`, encodeURIComponent(String(value))),
    RELAY_CONTRACT.endpoints[name] as string,
  );
}
