import type fabricContractJson from '../../../../config/pycore_relay_fabric_contract.json';
import fabricContractRaw from '../../../../config/pycore_relay_fabric_contract.json?raw';
import { sha256Hex } from '../utils/contentHash';

export type RelayFabricEndpointName = keyof typeof fabricContractJson.endpoints;
export type RelayFabricErrorName = keyof typeof fabricContractJson.errors;

export interface RelayFabricGrantDevice {
  device_id: string;
  pairing_id: string;
  response_topic: string;
  fast_available: boolean;
  last_seen_ms: number;
}

export interface RelayFabricGrant {
  hub_url: string;
  subscriber_token: string;
  topics: string[];
  devices: RelayFabricGrantDevice[];
  grant_version: number | string;
  expires_in_seconds: number;
  server_time_ms: number;
}

export interface RelayFabricFrameBody {
  present: boolean;
  length: number;
  sha256: string;
  base64: string | null;
}

export interface RelayFabricFrameRequest {
  operation_id: string;
  pairing_id: string;
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: RelayFabricFrameBody;
}

export interface RelayFabricFrameAnswer {
  operation_id: string;
  deadline_ms: number;
  device_id: string;
  lane: string;
  server_time_ms: number;
}

export interface RelayFabricResponseFrame {
  v: number;
  op: string;
  s: number;
  h?: Record<string, string> | null;
  b?: { len?: number; sha256?: string; b64?: string | null; ref?: string | null } | null;
  part?: { i: number; n: number } | null;
  t?: { dev_recv?: number; exec_ms?: number; dev_send?: number } | null;
}

export interface RelayFabricTelemetryItem {
  operation_id: string;
  route_policy: string;
  lane: string;
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

export interface RelayFabricRouteStats {
  route: string;
  count: number;
  p50: number;
  p90: number;
  p99: number;
  error_rate: number;
}

export const RELAY_FABRIC_CONTRACT = JSON.parse(fabricContractRaw) as typeof fabricContractJson;

/** Same canonical bytes as pycore/Laravel: CRLF folded to LF, then SHA-256 of the file bytes. */
export const RELAY_FABRIC_DIGEST = sha256Hex(fabricContractRaw.replace(/\r\n/g, '\n'));

export function relayFabricEndpoint(name: RelayFabricEndpointName): string {
  return RELAY_FABRIC_CONTRACT.endpoints[name];
}

export function relayFabricErrorStatus(name: RelayFabricErrorName): number {
  return RELAY_FABRIC_CONTRACT.errors[name];
}
