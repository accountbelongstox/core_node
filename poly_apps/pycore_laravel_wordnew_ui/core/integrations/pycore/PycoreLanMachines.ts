/**
 * PycoreLanMachines - the other pycore machines (:59000) on the LAN of this page's machine.
 *
 * The page asks its machine's pycore (`access.lan.machines_route`): pycore knows the real
 * interface addresses and netmasks, scans exactly those private segments and answers with the
 * segments and every machine found. A pycore without the route is covered by a browser scan of
 * the page address's /24. The found machines become LAN endpoints (`setPycoreLanEndpoints`) -
 * the terminal node tabs and the target switcher list them - and their peers documents join the
 * tailnet discovery, so a machine that runs Tailscale / Headscale lists the tailnet even when
 * the UI's own machine does not. The native app has no page machine: it scans its own Wi-Fi
 * segments (LanInfo plugin) through LanDiscovery. Tailnet machines are never scanned on the direct
 * port: pycore serves the tailnet only through each machine's HTTPS mount (already a candidate).
 */
import { ChangeSignal } from '../../events/ChangeSignal';
import { protocolFetch } from '../../network/ProtocolFetch';
import { LAN_MACHINES_ROUTE, TAILNET_PEERS_ROUTE } from '../../contracts/ServiceContract';
import { addTailnetPublishers, refreshTailnetPeers } from '../../network/TailnetDiscovery';
import { discoverServices, lanSegmentOf } from '../../network/LanDiscovery';
import { currentLanInfo } from '../../network/LanInfo';
import { isNativeAppShell } from '../../network/NativeShell';
import { PYCORE_BACKEND_PORT, pycoreHttpProto } from './pycoreEndpoints';
import { PYCORE_HTTP_PATHS } from './PycoreNetwork';
import { lanSegmentHosts, scanLanPycore, type LanSegment } from './PycoreLanScanner';
import { pycoreLanSourceUrl, setPycoreLanEndpoints } from './pycoreTarget';

export interface LanMachine {
  ip: string;
  url: string;
  hostname: string;
  ms: number;
  /** The machine the page asked (its own pycore). */
  self: boolean;
}

export type LanMachinesSource = 'pycore' | 'browser' | 'device' | 'none';

export interface LanMachinesSnapshot {
  segments: LanSegment[];
  machines: LanMachine[];
  scanning: boolean;
  source: LanMachinesSource;
  updatedAt: number;
}

const REQUEST_TIMEOUT_MS = 6_000;
const RESCAN_POLL_MS = 3_000;
const MAX_RESCAN_POLLS = 10;
const EMPTY: LanMachinesSnapshot = { segments: [], machines: [], scanning: false, source: 'none', updatedAt: 0 };

const changes = new ChangeSignal();
let snapshot: LanMachinesSnapshot = EMPTY;
let pending: Promise<LanMachinesSnapshot> | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let polls = 0;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseSegments(value: unknown): LanSegment[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => ({ cidr: text(entry?.cidr), address: text(entry?.address) }))
    .filter((entry) => entry.cidr !== '' && entry.address !== '');
}

function parseMachines(value: unknown): LanMachine[] {
  return (Array.isArray(value) ? value : [])
    .map((entry): LanMachine => ({
      ip: text(entry?.ip),
      url: text(entry?.url).replace(/\/+$/, ''),
      hostname: text(entry?.hostname),
      ms: Number(entry?.ms) || 0,
      self: entry?.self === true,
    }))
    .filter((entry) => entry.ip !== '' && entry.url !== '');
}

async function askPycore(base: string): Promise<Omit<LanMachinesSnapshot, 'source' | 'updatedAt'> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await protocolFetch(`${base}${LAN_MACHINES_ROUTE}`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    if (!body || !Array.isArray(body.machines)) return null;
    return { segments: parseSegments(body.segments), machines: parseMachines(body.machines), scanning: body.scanning === true };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Browser scan of the page address's /24 (a pycore without the LAN route). */
async function scanFromBrowser(base: string): Promise<Omit<LanMachinesSnapshot, 'source' | 'updatedAt'>> {
  const address = new URL(base).hostname;
  const segment: LanSegment = { cidr: `${address}/24`, address };
  const found = await scanLanPycore(lanSegmentHosts(segment));
  const machines = found
    .filter((entry) => entry.state === 'up')
    .map((entry): LanMachine => ({ ip: entry.host, url: entry.url, hostname: entry.hostname, ms: entry.ms, self: entry.host === address }));
  return { segments: [segment], machines, scanning: false };
}

/** Native app: the device's own LAN segments, probed for pycore. */
async function scanFromDevice(): Promise<Omit<LanMachinesSnapshot, 'source' | 'updatedAt'>> {
  const info = await currentLanInfo().catch(() => null);
  const segments = info?.lan ? info.addresses.map((entry) => lanSegmentOf(entry.address, entry.prefixLength)) : [];
  const found = await discoverServices({
    ports: [PYCORE_BACKEND_PORT],
    path: PYCORE_HTTP_PATHS.status,
    scheme: pycoreHttpProto(),
    segments,
    match: (probe) => {
      const body = probe.body as { is_http_service?: boolean; hostname?: string } | null;
      return body?.is_http_service ? { hostname: String(body.hostname || '') } : null;
    },
  });
  const machines = found.map((entry): LanMachine => ({ ip: entry.host, url: entry.url, hostname: entry.info.hostname, ms: entry.ms, self: false }));
  return { segments, machines, scanning: false };
}

function publish(next: LanMachinesSnapshot): void {
  snapshot = next;
  setPycoreLanEndpoints(next.machines
    .filter((machine) => !machine.self)
    .map((machine) => ({ url: machine.url, label: machine.hostname || machine.ip })));
  const added = addTailnetPublishers(next.machines.map((machine) => `${machine.url}${TAILNET_PEERS_ROUTE}`));
  changes.emit();
  if (added) void refreshTailnetPeers();
}

function schedulePoll(): void {
  if (pollTimer !== null) clearTimeout(pollTimer);
  pollTimer = null;
  if (!snapshot.scanning || polls >= MAX_RESCAN_POLLS) return;
  polls += 1;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void refreshLanMachines();
  }, RESCAN_POLL_MS);
}

/** Ask for the LAN machines now (shared in-flight request); resolves with the last list when nothing answers. */
export function refreshLanMachines(): Promise<LanMachinesSnapshot> {
  const base = pycoreLanSourceUrl();
  if (pending) return pending;
  if (!base) {
    if (!isNativeAppShell()) return Promise.resolve(snapshot);
    pending = scanFromDevice()
      .then((result) => {
        publish({ ...result, source: 'device', updatedAt: Date.now() });
        return snapshot;
      })
      .finally(() => { pending = null; });
    return pending;
  }
  pending = askPycore(base)
    .then(async (answer): Promise<LanMachinesSnapshot> => {
      const source: LanMachinesSource = answer ? 'pycore' : 'browser';
      const result = answer ?? await scanFromBrowser(base);
      return { ...result, source, updatedAt: Date.now() };
    })
    .then((next) => {
      publish(next);
      schedulePoll();
      return snapshot;
    })
    .finally(() => { pending = null; });
  return pending;
}

export function getLanMachines(): LanMachinesSnapshot {
  return snapshot;
}

export const subscribeLanMachines = changes.subscribe;

/** True when this page's machine can report a LAN (a loopback or LAN page). */
export function isLanMachinesAvailable(): boolean {
  return pycoreLanSourceUrl() !== null || isNativeAppShell();
}

/** Restart the polling budget (a user-requested rescan). */
export function rescanLanMachines(): Promise<LanMachinesSnapshot> {
  polls = 0;
  return refreshLanMachines();
}
