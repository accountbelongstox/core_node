/**
 * pycoreLanAuth - K3 signature of requests to a LAN pycore (`http://<RFC 1918 host>:59000`).
 *
 * pycore's K7 gate admits a non-loopback caller only with a valid client-key signature; a native
 * shell built with the client key signs every LAN request with the one UI signer. Other URLs
 * (loopback, tailnet proxy, relay) get no headers.
 */
import { clientKeyHeaders } from '../laravel/ClientKeySigner';
import { isNativeAppShell } from '../../network/NativeShell';
import { classifyPycoreBackendUrl, isPrivateLanHost } from './pycoreTarget';

/** True for a direct backend URL (or a URL on one) whose host is a LAN machine, in a native shell. */
export function isPycoreLanUrl(url: string): boolean {
  if (!isNativeAppShell()) return false;
  try {
    const parsed = new URL(url);
    return isPrivateLanHost(parsed.hostname) && classifyPycoreBackendUrl(parsed.origin) === 'direct';
  } catch {
    return false;
  }
}

/** K3 headers for one LAN pycore request; `{}` for any other URL or a build without the key. */
export async function pycoreLanSignHeaders(
  method: string,
  url: string,
  body: BodyInit | null | undefined = null,
  contentType = '',
): Promise<Record<string, string>> {
  if (!isPycoreLanUrl(url)) return {};
  try {
    return await clientKeyHeaders(method, url, body, contentType);
  } catch {
    return {};
  }
}
