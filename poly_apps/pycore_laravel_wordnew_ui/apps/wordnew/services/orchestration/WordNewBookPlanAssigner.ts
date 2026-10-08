/**
 * App-led scheduling of a book plan (contract book_plan.assignments_*). While the app is open it knows
 * every node that can work for the plan: Laravel's online roster (lanes, class, throughput) and the
 * direct pycore it talks to. It spreads the next pending clips over them as windows - node short id,
 * lane, language, clip count, laid out from the reading position - and posts them to Laravel, which
 * honors them for as long as the posts keep coming (the plan heartbeat) and falls back to its own fair
 * share when they stop. The direct pycore's own windows carry this device's direct sid
 * (`direct:<device id prefix>`): no node leases those rows, the app generates them directly (the `direct`
 * counts below feed the generate:pycore stage). They exist only for the (lane, language) pairs the direct
 * pycore's declared capability covers, so a CPU pycore never holds English sentences hostage.
 */
import { AUDIO_ORCH_BOOK_PLAN } from '../../../../core/contracts/AudioOrchestrationContract';
import type { AudioLaneKey, WorkNode } from '../../../../core/contracts/QueueCenterTypes';
import type { OrchResourceKind } from '../../../../core/integrations/pycore';
import type { WfNewBookPlanWindow } from '../../api';

/** Generation lanes the app-led assignment spreads (a plan without clips of a lane posts no window for it). */
export const ASSIGNMENT_LANES: readonly AudioLaneKey[] = ['sentence_audio', 'word_audio', 'phrase_audio'];
const LANES = ASSIGNMENT_LANES;
const LANE_OF_KIND: Record<OrchResourceKind, AudioLaneKey> = { word: 'word_audio', sentence: 'sentence_audio', phrase: 'phrase_audio' };

/** The work-lease / generate lane a clip kind belongs to (a meaning clip is a zh sentence clip: the sentence lane). */
export function laneOfKind(kind: OrchResourceKind): AudioLaneKey {
  return LANE_OF_KIND[kind];
}
const MINUTES_PER_HOUR = 60;

export type AssignmentLanguages = Record<AudioLaneKey, readonly string[]>;

/** The direct pycore as the assignment sees it (null in the input: none is usable). */
export interface AssignmentDirect {
  /** Work-node sid of the direct pycore as Laravel lists it ('' when unknown). */
  nodeSid: string;
  /** First DNS label of its host: the match for a pycore that does not declare a node sid. */
  host: string;
  /** Window sid of this device's direct range (`directWindowSid`). */
  windowSid: string;
  /** Can it generate this lane and language (its declared capability; true while unknown)? */
  covers: (lane: AudioLaneKey, language: string) => boolean;
}

export interface AssignmentInput {
  /** Laravel's online work nodes. */
  roster: readonly WorkNode[];
  /** The usable direct pycore; null when none is. */
  direct: AssignmentDirect | null;
  /** Languages the plan voices per lane (the plan's covered clips). */
  languages: AssignmentLanguages;
}

/** Window sid of one device's direct range: the contract direct sid plus the device id prefix. */
export function directWindowSid(deviceId: string): string {
  return `${AUDIO_ORCH_BOOK_PLAN.directSid}:${deviceId.slice(0, AUDIO_ORCH_BOOK_PLAN.directSidDeviceChars)}`;
}

export interface Assignment {
  windows: WfNewBookPlanWindow[];
  /** Clips per lane the direct pycore generates itself. */
  direct: Record<AudioLaneKey, number>;
}

/** What the direct pycore takes per lane when no assignment was computed (no node to spread over). */
export function defaultDirectShare(): Record<AudioLaneKey, number> {
  return { sentence_audio: AUDIO_ORCH_BOOK_PLAN.localHeadItems, word_audio: AUDIO_ORCH_BOOK_PLAN.localHeadItems, phrase_audio: AUDIO_ORCH_BOOK_PLAN.localHeadItems };
}

/** First DNS label of a node's host label, lower case ('' when it has none): how a direct pycore without a node sid is matched to its work node. */
export function workNodeHost(node: WorkNode): string {
  return String(node.label ?? '').toLowerCase().split('.')[0];
}

const rateOf = (node: WorkNode, lane: AudioLaneKey): number => Math.max(1, Number(node.lane_rates?.[lane] ?? node.done_per_hour) || 0);

/** Clips a node of `rate` items per hour works through in the contract horizon, never fewer than one lease batch (the node's next claim stays inside the plan). */
function windowOf(rate: number, leaseBatch = 0): number {
  const clips = Math.ceil(rate * AUDIO_ORCH_BOOK_PLAN.assignmentHorizonMinutes / MINUTES_PER_HOUR);
  return Math.max(AUDIO_ORCH_BOOK_PLAN.assignmentMinClips, Math.min(AUDIO_ORCH_BOOK_PLAN.assignmentWindowMax, Math.max(clips, leaseBatch)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 1;
}

/** One window per language: the count split over them (at least one clip each). */
function perLanguage(sid: string, lane: AudioLaneKey, languages: readonly string[], count: number): WfNewBookPlanWindow[] {
  if (languages.length === 0 || count <= 0) return [];
  const share = Math.max(1, Math.ceil(count / languages.length));
  return languages.map((language) => ({ sid, lane, language, count: share }));
}

/**
 * Windows and the direct share. Per lane, nodes that serve a plan language are sized by their items per
 * hour over the contract horizon, fastest first. A direct pycore that is also a node (matched by its node
 * sid, else its host label) takes `assignmentDirectFraction` of that node's window (the rest stays the
 * node's); one that is not a node takes a median node's window. The direct windows are posted only for the
 * languages of the lane the direct pycore can generate; a lane it cannot serve gets no direct window and
 * a zero share. Without any node on a lane Laravel gets no window for it and the direct pycore keeps the
 * default head share.
 */
export function buildAssignment({ roster, direct, languages }: AssignmentInput): Assignment {
  const windows: WfNewBookPlanWindow[] = [];
  const share = defaultDirectShare();
  for (const lane of LANES) {
    const wanted = languages[lane];
    const directLanguages = direct ? wanted.filter((language) => direct.covers(lane, language)) : [];
    if (direct && directLanguages.length === 0) share[lane] = 0;
    const nodes = roster
      .filter((node) => node.online && node.sid)
      .map((node) => ({ node, served: (node.lanes?.[lane] ?? []).filter((language) => wanted.includes(language)) }))
      .filter((entry) => entry.served.length > 0)
      .sort((left, right) => rateOf(right.node, lane) - rateOf(left.node, lane));
    if (nodes.length === 0 || wanted.length === 0) continue;
    const machine = direct
      ? nodes.find((entry) => (direct.nodeSid ? entry.node.sid === direct.nodeSid : direct.host !== '' && workNodeHost(entry.node) === direct.host))
      : undefined;
    const directWindow = direct && directLanguages.length > 0
      ? Math.max(1, Math.min(
        AUDIO_ORCH_BOOK_PLAN.assignmentDirectMax,
        Math.floor((machine ? windowOf(rateOf(machine.node, lane)) : windowOf(median(nodes.map((entry) => rateOf(entry.node, lane))))) * AUDIO_ORCH_BOOK_PLAN.assignmentDirectFraction),
      ))
      : 0;
    if (direct) share[lane] = directWindow;
    if (direct && directWindow > 0) windows.push(...perLanguage(direct.windowSid, lane, directLanguages, directWindow));
    for (const entry of nodes) {
      const own = windowOf(rateOf(entry.node, lane), Number(entry.node.batch_size) || 0) - (entry === machine ? directWindow : 0);
      windows.push(...perLanguage(entry.node.sid as string, lane, entry.served, own));
    }
  }
  return { windows: windows.slice(0, AUDIO_ORCH_BOOK_PLAN.assignmentWindowsMax), direct: share };
}
