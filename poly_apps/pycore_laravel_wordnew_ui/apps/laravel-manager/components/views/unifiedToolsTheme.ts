import {
  BookOpen,
  Calculator,
  Code,
  Database,
  FileCode,
  Globe,
  Hash,
  Image,
  Lock,
  Network,
  Sparkles,
  Type,
  Wrench,
} from 'lucide-react';

export const MCP_TOOLS_CATEGORY = '__mcp_server__';
export const AI_TOOLS_CATEGORY = '__ai_tools__';

export interface ToolHistory {
  toolId: string;
  toolName: string;
  timestamp: number;
  input: unknown;
  output: unknown;
}

export type ToolsViewTab = 'all' | 'favorites' | 'recent';

const categoryConfig: Record<string, { icon: typeof Hash; accent: string }> = {
  'Crypto & Security': { icon: Lock, accent: 'emerald' },
  Converters: { icon: Code, accent: 'blue' },
  'Web Development': { icon: Globe, accent: 'cyan' },
  'Text Processing': { icon: Type, accent: 'purple' },
  'Math & Calculators': { icon: Calculator, accent: 'orange' },
  'Network Tools': { icon: Network, accent: 'pink' },
  'Image Tools': { icon: Image, accent: 'amber' },
  'PDF Tools': { icon: FileCode, accent: 'indigo' },
  'AI Tools': { icon: Sparkles, accent: 'fuchsia' },
  'Server Manager': { icon: Wrench, accent: 'teal' },
  'Media Tools': { icon: Database, accent: 'lime' },
  Vocabulary: { icon: BookOpen, accent: 'rose' },
};

const fallbackCategory = { icon: Hash, accent: 'slate' };

const accentClasses: Record<string, { chip: string; iconBg: string; ring: string }> = {
  emerald: { chip: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/40' },
  blue: { chip: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10', iconBg: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/40' },
  cyan: { chip: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10', iconBg: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', ring: 'ring-cyan-500/40' },
  purple: { chip: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10', iconBg: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400', ring: 'ring-purple-500/40' },
  orange: { chip: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10', iconBg: 'bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400', ring: 'ring-orange-500/40' },
  pink: { chip: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10', iconBg: 'bg-pink-100 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/40' },
  amber: { chip: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10', iconBg: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/40' },
  indigo: { chip: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10', iconBg: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-500/40' },
  fuchsia: { chip: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-500/10', iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400', ring: 'ring-fuchsia-500/40' },
  teal: { chip: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10', iconBg: 'bg-teal-100 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400', ring: 'ring-teal-500/40' },
  lime: { chip: 'text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-500/10', iconBg: 'bg-lime-100 dark:bg-lime-500/15 text-lime-600 dark:text-lime-400', ring: 'ring-lime-500/40' },
  rose: { chip: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10', iconBg: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400', ring: 'ring-rose-500/40' },
  slate: { chip: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10', iconBg: 'bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400', ring: 'ring-slate-500/40' },
};

export const unifiedToolsInputClass = 'w-full px-3 py-2 rounded-lg text-sm transition-all border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500';

export const getUnifiedToolCategoryMeta = (category: string) => categoryConfig[category] || fallbackCategory;
export const getUnifiedToolAccent = (accent: string) => accentClasses[accent] || accentClasses.slate;
