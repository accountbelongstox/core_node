/** Shared loopback/private host detection fed by the service contract. */
import { LOCAL_RPC_LOOPBACK_HOSTS } from '../contracts/ServiceContract';

const CONTRACT_LOOPBACK_HOSTS = new Set(LOCAL_RPC_LOOPBACK_HOSTS.map((host) => host.toLowerCase()));
const PRIVATE_HOST_PATTERNS = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\./,
];

export function normalizeHostname(host: string): string {
  return String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function isLoopbackHost(host: string): boolean {
  const h = normalizeHostname(host);
  if (!h) return false;
  if (CONTRACT_LOOPBACK_HOSTS.has(h)) return true;
  if (h.endsWith('.localhost')) return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

export function isPrivateHost(host: string): boolean {
  const h = normalizeHostname(host);
  if (!h) return false;
  if (isLoopbackHost(h)) return true;
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(h));
}
