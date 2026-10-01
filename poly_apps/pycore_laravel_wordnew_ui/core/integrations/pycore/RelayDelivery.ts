import { Backoff } from '../../tasks/Backoff';
import { PycoreRelayError } from './PycoreRelayError';
import { raceAbort } from './PycoreRelayWire';
import { relayTransport } from './RelayTransport';
import { RELAY_CONTRACT } from '../../contracts/RelayContract';
import { PycorePaths } from './pycoreEndpoints';

const RATE_LIMIT_BACKOFF_MIN_MS = 5_000;
const RATE_LIMIT_BACKOFF_MAX_MS = 60_000;
// Identical in-flight reads share ONE relay call (single-flight): N panels
// polling the same route cost one admission instead of N. A successful read
// stays shareable for READ_COALESCE_MS after it settles, and any write
// drops every shared read so nothing joins a pre-write flight.
const READ_COALESCE_MS = 250;
const inFlightReads = new Map<string, Promise<Response>>();
const rateLimitBackoff = new Backoff(RATE_LIMIT_BACKOFF_MIN_MS, RATE_LIMIT_BACKOFF_MAX_MS);
let admissionBlockedUntil = 0;

async function deliverTracked(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    const response = await relayTransport.deliver(url, init, signal);
    rateLimitBackoff.reset();
    return response;
  } catch (error) {
    if ((error as { status?: number })?.status === 429) {
      admissionBlockedUntil = Date.now() + rateLimitBackoff.next();
    }
    throw error;
  }
}

export async function deliverThroughRelay(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const method = String(init.method || 'GET').toUpperCase();
  const isRead = (method === 'GET' || method === 'HEAD') && init.body == null;
  if (!isRead) {
    inFlightReads.clear();
    return deliverTracked(url, init, signal);
  }
  // Reads yield to the owner rate limiter: while a 429 backoff is active they
  // fail fast instead of adding admissions; mutations still go through.
  if (Date.now() < admissionBlockedUntil) {
    throw new PycoreRelayError('rate-limited', 'RELAY_RATE_LIMITED', 429);
  }
  const key = `${method} ${url}`;
  let shared = inFlightReads.get(key);
  if (!shared) {
    const { signal: _ignored, ...sharedInit } = init;
    const flight: Promise<Response> = deliverTracked(url, sharedInit).then(
      (response) => {
        if (!response.ok) {
          if (inFlightReads.get(key) === flight) inFlightReads.delete(key);
          return response;
        }
        setTimeout(() => {
          if (inFlightReads.get(key) === flight) inFlightReads.delete(key);
        }, READ_COALESCE_MS);
        return response;
      },
      (error) => {
        if (inFlightReads.get(key) === flight) inFlightReads.delete(key);
        throw error;
      },
    );
    shared = flight;
    inFlightReads.set(key, shared);
  }
  return raceAbort(shared.then((response) => response.clone()), signal);
}

/** The Laravel origin the relay rides (contract `public_urls.laravel_api_origin`). */
export function relayPycoreOrigin(): string {
  return String(RELAY_CONTRACT.public_urls.laravel_api_origin || '').replace(/\/+$/, '');
}

/**
 * POST a pycore route through the Laravel relay to the paired pycore, whatever
 * pycore is selected (the relay delivers by path; binary answers pass through).
 */
export function relayPycoreFetch(route: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return deliverThroughRelay(
    `${relayPycoreOrigin()}${PycorePaths.api(route)}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) },
    signal,
  );
}
