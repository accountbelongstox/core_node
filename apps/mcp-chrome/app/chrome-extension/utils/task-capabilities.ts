/**
 * Task Center capability catalog — the SINGLE source of truth shared by the
 * popup checkboxes and the background scheduler / run-intent gate.
 *
 * A "capability" is one user-facing switch. It maps to the TaskCenter
 * processorTypes it activates. Keeping this catalog in one neutral module guarantees the popup UI
 * and the background can never disagree on which lanes a checkbox turns on.
 *
 * Every capability maps to a real in-extension runner or processor lane.
 */

import { LANES } from './task-center-lanes';

export type CapabilityKey =
  | 'image'
  | 'audio'
  | 'validity'
  | 'article'
  | 'notebooklm'
  | 'bing'
  | 'aiTranslate';

export interface CapabilityDef {
  key: CapabilityKey;
  /** chrome.storage key persisting this switch across popup blur/close. */
  storageKey: string;
  zhLabel: string;
  hint: string;
  /** TaskCenter processorTypes this capability enables. Empty => stub. */
  processors: string[];
  /** True when this capability also drives the client-side validity runner. */
  usesValidityRunner: boolean;
  /** Reserved for capability discovery during rolling upgrades. */
  stub: boolean;
}

export const CAPABILITIES: CapabilityDef[] = [
  {
    key: 'image',
    storageKey: 'tkCapImage',
    zhLabel: '执行图片生成任务',
    hint: 'Gemini image + poster/cover generation',
    processors: [LANES.REMOTE_GEMINI, LANES.MEDIA_IMAGE],
    usesValidityRunner: false,
    stub: false,
  },
  {
    key: 'audio',
    storageKey: 'tkCapAudio',
    zhLabel: '执行语音生成任务',
    hint: 'Laravel audio queue → shared Qwen3-TTS runtime → write-back',
    processors: [LANES.QWEN_TTS],
    usesValidityRunner: false,
    stub: false,
  },
  {
    key: 'validity',
    storageKey: 'tkCapValidity',
    zhLabel: '执行单词有效性检测',
    hint: 'Laravel validity queue → shared web classifier → write-back',
    processors: [LANES.WORD_VALIDITY_WEB],
    usesValidityRunner: false,
    stub: false,
  },
  {
    key: 'article',
    storageKey: 'tkCapArticle',
    zhLabel: '执行短文生成任务',
    hint: 'Gemini short-article and text generation',
    processors: [LANES.REMOTE_GEMINI_TEXT],
    usesValidityRunner: false,
    stub: false,
  },
  {
    key: 'notebooklm',
    storageKey: 'tkCapNotebooklm',
    zhLabel: '执行 NotebookLM 生成任务',
    hint: 'Laravel NotebookLM queue → shared browser runtime → write-back',
    processors: [LANES.REMOTE_NOTEBOOKLM],
    usesValidityRunner: false,
    stub: false,
  },
  {
    key: 'bing',
    storageKey: 'tkCapBing',
    zhLabel: '执行 Bing 翻译功能',
    hint: 'Bing dictionary translation, phonetics and media capture',
    processors: [LANES.BING_DICTIONARY],
    usesValidityRunner: false,
    stub: false,
  },
  {
    key: 'aiTranslate',
    storageKey: 'tkCapAiTranslate',
    zhLabel: '执行 Web-AI 翻译任务',
    hint: 'DeepSeek web translation tasks on the AI fast lane',
    processors: [LANES.WEB_AI_TRANSLATE],
    usesValidityRunner: false,
    stub: false,
  },
];

export const CAPABILITY_KEYS: CapabilityKey[] = CAPABILITIES.map((c) => c.key);

export const CAPABILITY_BY_KEY: Record<CapabilityKey, CapabilityDef> =
  CAPABILITIES.reduce(
    (acc, c) => {
      acc[c.key] = c;
      return acc;
    },
    {} as Record<CapabilityKey, CapabilityDef>,
  );

/** Deduped processorTypes for a set of capability keys. */
export function processorsForCapabilities(keys: CapabilityKey[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    const def = CAPABILITY_BY_KEY[key];
    if (def) {
      for (const processorType of def.processors) out.add(processorType);
    }
  }
  return Array.from(out);
}

/** The capability that owns a given processorType, or null (for run-intent gating). */
export function capabilityForProcessor(processorType: string): CapabilityKey | null {
  for (const def of CAPABILITIES) {
    if (def.processors.includes(processorType)) return def.key;
  }
  return null;
}
