/**
 * PcToolsView — the "Tools" tab: translate, image search, subtitle search and word
 * audio behind one segmented switch. The tool list is defined once (TOOLS); the
 * selection persists.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ScanSearch, Captions, Volume2, type LucideIcon } from 'lucide-react';
import { StorageManager } from '../../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../../persistence/PycoreManagerStorageKeys';
import PcTranslatePage from '../PcTranslatePage';
import PcImageSearchPage from '../PcImageSearchPage';
import PcSubtitleSearchPage from '../PcSubtitleSearchPage';
import PcWordAudioPage from '../PcWordAudioPage';

interface ToolDef {
  key: string;
  labelKey: string;
  Icon: LucideIcon;
  Component: React.ComponentType;
}

export const TOOLS = [
  { key: 'translate', labelKey: 'ai.tabs.translate', Icon: Languages, Component: PcTranslatePage },
  { key: 'imageSearch', labelKey: 'ai.tabs.imageSearch', Icon: ScanSearch, Component: PcImageSearchPage },
  { key: 'subtitleSearch', labelKey: 'ai.tabs.subtitleSearch', Icon: Captions, Component: PcSubtitleSearchPage },
  { key: 'wordAudio', labelKey: 'ai.tabs.wordAudio', Icon: Volume2, Component: PcWordAudioPage },
] as const satisfies readonly ToolDef[];

export type ToolKey = (typeof TOOLS)[number]['key'];

export const isToolKey = (value: string | null | undefined): value is ToolKey =>
  !!value && TOOLS.some((tool) => tool.key === value);

const DEFAULT_TOOL: ToolKey = 'translate';

const PcToolsView: React.FC<{ initialTool?: ToolKey }> = ({ initialTool }) => {
  const { t } = useTranslation('pc');
  const [tool, setTool] = useState<ToolKey>(() => {
    if (initialTool) return initialTool;
    const saved = StorageManager.getRaw(StorageKeys.PYCORE_AI_TOOL);
    return isToolKey(saved) ? saved : DEFAULT_TOOL;
  });
  useEffect(() => { StorageManager.setRaw(StorageKeys.PYCORE_AI_TOOL, tool); }, [tool]);
  useEffect(() => { if (initialTool) setTool(initialTool); }, [initialTool]);

  const active = TOOLS.find((entry) => entry.key === tool) ?? TOOLS[0];
  const Active = active.Component;
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex rounded-xl pc-glass overflow-x-auto max-w-full self-start no-scrollbar w-fit">
        {TOOLS.map(({ key, labelKey, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTool(key)}
            className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition ${
              tool === key ? 'bg-indigo-500/15 text-indigo-500' : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {t(labelKey)}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
};

export default PcToolsView;
