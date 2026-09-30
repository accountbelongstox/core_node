/**
 * The `ai` page tab model — defined ONCE. The tab keys, the URL / storage
 * validation, the legacy-slug aliases and the view registry all derive from AI_TABS.
 */
import React from 'react';
import { Activity, ImagePlay, KeyRound, Wrench, History, type LucideIcon } from 'lucide-react';
import PcModelsView from '../../components/ai/models/PcModelsView';
import PcProvidersView from '../../components/ai/providers/PcProvidersView';
import PcAiStudioView from '../../components/PcAiStudioView';
import PcHistoryView from '../../components/ai/PcHistoryView';
import PcToolsView, { isToolKey, type ToolKey } from './PcToolsView';

export interface AiTabViewProps {
  refreshSignal?: number;
  initialTool?: ToolKey;
}

interface AiTabDef {
  key: string;
  labelKey: string;
  hintKey: string;
  Icon: LucideIcon;
  View: React.ComponentType<AiTabViewProps>;
}

export const AI_TABS = [
  { key: 'models', labelKey: 'ai.tabs.models', hintKey: 'ai.tabHint.models', Icon: Activity, View: PcModelsView },
  { key: 'providers', labelKey: 'ai.tabs.providers', hintKey: 'ai.tabHint.providers', Icon: KeyRound, View: PcProvidersView },
  { key: 'studio', labelKey: 'ai.tabs.studio', hintKey: 'ai.tabHint.studio', Icon: ImagePlay, View: PcAiStudioView },
  { key: 'tools', labelKey: 'ai.tabs.tools', hintKey: 'ai.tabHint.tools', Icon: Wrench, View: PcToolsView },
  { key: 'history', labelKey: 'ai.tabs.history', hintKey: 'ai.tabHint.history', Icon: History, View: PcHistoryView },
] as const satisfies readonly AiTabDef[];

export type AiTab = (typeof AI_TABS)[number]['key'];

export const ALL_TABS: AiTab[] = AI_TABS.map((tab) => tab.key);
export const DEFAULT_TAB: AiTab = ALL_TABS[0];

export const isTab = (value: string | null | undefined): value is AiTab =>
  !!value && (ALL_TABS as string[]).includes(value);

export interface AiTabTarget {
  tab: AiTab;
  tool?: ToolKey;
}

/** Former `?tab=` slugs (and the former per-tool tabs) mapped onto the current tabs. */
const LEGACY_TAB_ALIASES: Record<string, AiTabTarget> = {
  capability: { tab: 'models' },
  keys: { tab: 'providers' },
};

/** Current tab for a URL / storage value, including legacy slugs and former per-tool tabs. */
export function resolveTabTarget(value: string | null | undefined): AiTabTarget | null {
  if (!value) return null;
  if (isTab(value)) return { tab: value };
  if (isToolKey(value)) return { tab: 'tools', tool: value };
  return LEGACY_TAB_ALIASES[value] ?? null;
}
