/**
 * App-led scheduling of a book plan (contract book_plan.assignments_*). While the app is open it knows
 * every node that can work for the plan: Laravel's online roster (lanes, class, throughput) and the
 * direct pycore it talks to. It spreads the next pending clips over them as windows - node short id,
 * lane, language, clip count, laid out from the reading position - and posts them to Laravel, which
 * honors them for as long as the posts keep coming (the plan heartbeat) and falls back to its own fair
 * share when they stop. The direct pycore's own windows carry `directSid`: no node leases those rows, the
 * app generates them directly (the `direct` counts below feed the generate:pycore stage).
 */
import { AUDIO_ORCH_BOOK_PLAN } from '../../../../core/contracts/AudioOrchestrationContract';
import type { AudioLaneKey, WorkNode } from '../../../../core/contracts/QueueCenterTypes';
import type { OrchResourceKind } from '../../../../core/integrations/pycore';
import type { WfNewBookPlanWindow } from '../../api';
import { workNodeHost } from '../WordNewPycoreNodes';

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

export interface AssignmentInput {
  /** Laravel's online work nodes. */
  roster: readonly WorkNode[];
  /** First DNS label of the direct pycore's host; '' when no direct pycore is usable. */
  directHost: string;
  /** Languages the plan voices per lane (the plan's covered clips). */
  languages: AssignmentLanguages;
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
 * hour over the contract horizon, fastest first. A direct pycore on the same host as a node takes
 * `assignmentDirectFraction` of that machine's window (the rest stays the node's); one that is not a node
 * takes a median node's window. Without any node on a lane Laravel gets no window for it and the direct
 * pycore keeps the default head share.
 */
export function buildAssignment({ roster, directHost, languages }: AssignmentInput): Assignment {
  const windows: WfNewBookPlanWindow[] = [];
  const direct = defaultDirectShare();
  for (const lane of LANES) {
    const wanted = languages[lane];
    const nodes = roster
      .filter((node) => node.online && node.sid)
      .map((node) => ({ node, served: (node.lanes?.[lane] ?? []).filter((language) => wanted.includes(language)) }))
      .filter((entry) => entry.served.length > 0)
      .sort((left, right) => rateOf(right.node, lane) - rateOf(left.node, lane));
    if (nodes.length === 0 || wanted.length === 0) continue;
    const machine = directHost ? nodes.find((entry) => workNodeHost(entry.node) === directHost) : undefined;
    const directWindow = directHost
      ? Math.max(1, Math.min(
        AUDIO_ORCH_BOOK_PLAN.assignmentDirectMax,
        Math.floor((machine ? windowOf(rateOf(machine.node, lane)) : windowOf(median(nodes.map((entry) => rateOf(entry.node, lane))))) * AUDIO_ORCH_BOOK_PLAN.assignmentDirectFraction),
      ))
      : 0;
    direct[lane] = directWindow;
    if (directWindow > 0) windows.push(...perLanguage(AUDIO_ORCH_BOOK_PLAN.directSid, lane, wanted, directWindow));
    for (const entry of nodes) {
      const own = windowOf(rateOf(entry.node, lane), Number(entry.node.batch_size) || 0) - (entry === machine ? directWindow : 0);
      windows.push(...perLanguage(entry.node.sid as string, lane, entry.served, own));
    }
  }
  return { windows: windows.slice(0, AUDIO_ORCH_BOOK_PLAN.assignmentWindowsMax), direct };
}
