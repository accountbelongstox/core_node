/**
 * Lane capability of a pycore (`ui/queue_center/lane_capability`): the lanes, languages and engines the
 * node declares on its work-lease claims, as one answer. A client reads it to know which clips this pycore
 * can generate at all (a CPU pycore makes no English sentences).
 */
import { PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';

export interface PycoreLaneCapabilityLane {
  languages: string[];
  engines: string[];
}

export interface PycoreLaneCapability {
  /** Short id of this pycore in Laravel's work-node roster ('' when it is not a work node). */
  nodeSid: string;
  deviceId: string;
  computeClass: string;
  lanes: Record<string, PycoreLaneCapabilityLane>;
}

/** Route of the capability RPC (config/pycore_rpc_contract.json). */
export function pycoreLaneCapabilityRoute(): string {
  return PYCORE_HTTP_ROUTES.queueCenterLaneCapability;
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry !== '') : [];
}

/** The capability of a pycore answer (`{...}` or `{success, data: {...}}`); null when it has none. */
export function parsePycoreLaneCapability(answer: unknown): PycoreLaneCapability | null {
  const root = answer as { success?: boolean; data?: unknown } | null;
  const body = (root && typeof root === 'object' && root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || root?.success === false || !body.lanes || typeof body.lanes !== 'object') return null;
  const lanes: Record<string, PycoreLaneCapabilityLane> = {};
  Object.entries(body.lanes as Record<string, unknown>).forEach(([lane, declared]) => {
    const entry = declared as { languages?: unknown; engines?: unknown } | null;
    lanes[lane] = { languages: textList(entry?.languages), engines: textList(entry?.engines) };
  });
  return {
    nodeSid: typeof body.node_sid === 'string' ? body.node_sid : '',
    deviceId: typeof body.device_id === 'string' ? body.device_id : '',
    computeClass: typeof body.compute_class === 'string' ? body.compute_class : '',
    lanes,
  };
}

/** Can a pycore with this capability generate `language` clips of `lane`? A lane declaring no language claims nothing (as Laravel reads the claim). */
export function pycoreLaneCovers(capability: PycoreLaneCapability, lane: string, language: string): boolean {
  return Boolean(capability.lanes[lane]?.languages.includes(language));
}
