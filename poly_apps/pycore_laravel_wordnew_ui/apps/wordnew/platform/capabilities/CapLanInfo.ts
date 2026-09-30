/* =============================================================================
 * CapLanInfo - the device's local network (for LAN service discovery)
 * =============================================================================
 * Native (Android, app plugin `LanInfo`): IPv4 addresses with prefix length and
 * the default gateway of the active network. Web: a browser cannot read its
 * addresses; a page served from a private address gives its own subnet,
 * otherwise the caller asks for a gateway.
 * ========================================================================== */
import { registerPlugin } from '@capacitor/core';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { isPrivateLanHost } from '../../../../core/integrations/pycore';

export interface CapLanAddress {
  address: string;
  prefixLength: number;
}

export interface CapLanInfo {
  addresses: CapLanAddress[];
  /** Default gateway IPv4 ('' when unknown). */
  gateway: string;
  /** The active network is Wi-Fi / Ethernet (a LAN to scan). */
  lan: boolean;
}

interface LanInfoPlugin {
  current(): Promise<CapLanInfo>;
}

const nativeLanInfo = registerPlugin<LanInfoPlugin>('LanInfo');
const WEB_PREFIX_LENGTH = 24;

export async function currentLanInfo(): Promise<CapLanInfo> {
  if (isNativeAppShell()) return nativeLanInfo.current();
  const host = typeof location === 'undefined' ? '' : location.hostname;
  return isPrivateLanHost(host)
    ? { addresses: [{ address: host, prefixLength: WEB_PREFIX_LENGTH }], gateway: '', lan: true }
    : { addresses: [], gateway: '', lan: false };
}
