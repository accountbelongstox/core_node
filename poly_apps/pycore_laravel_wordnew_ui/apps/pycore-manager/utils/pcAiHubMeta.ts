/** Category presentation table of the AI hub (icon + accent); the catalog supplies the categories. */
import {
  AudioLines, BrainCircuit, Cpu, Image as ImageIcon, Languages, Mic, Package, ScanText,
  type LucideIcon,
} from 'lucide-react';

export interface PcAiHubCategoryMeta {
  Icon: LucideIcon;
  accent: string;
}

export const PC_AI_HUB_CATEGORY_META: Record<string, PcAiHubCategoryMeta> = {
  ai_text: { Icon: Cpu, accent: 'text-fuchsia-500' },
  ai_image: { Icon: ImageIcon, accent: 'text-pink-500' },
  tts: { Icon: AudioLines, accent: 'text-indigo-500' },
  stt: { Icon: Mic, accent: 'text-sky-500' },
  ocr: { Icon: ScanText, accent: 'text-emerald-500' },
  llm: { Icon: BrainCircuit, accent: 'text-violet-500' },
  translate: { Icon: Languages, accent: 'text-amber-500' },
  library: { Icon: Package, accent: 'text-slate-500' },
};

/** Categories whose engines report a live model load through the engine-load store. */
export const PC_ENGINE_LOAD_CATEGORIES: readonly string[] = ['tts', 'stt'];

const FALLBACK_META: PcAiHubCategoryMeta = { Icon: Package, accent: 'text-slate-500' };

export function aiHubCategoryMeta(category: string): PcAiHubCategoryMeta {
  return PC_AI_HUB_CATEGORY_META[category] ?? FALLBACK_META;
}
