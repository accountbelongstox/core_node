import React from 'react';
import { User as UserIcon, Bot, Wrench, Brain, Cpu } from 'lucide-react';

/** Shared presentational vocabulary for the dev-history surfaces (badges, roles). */

export const PAGE_SIZE = 50;
export const AGENT_HISTORY_TOOLS = [
  'agent', 'pi', 'claude', 'codex', 'cursor', 'gemini',
  'kimi', 'antigravity', 'cline',
] as const;

export const TOOL_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  cursor: 'Cursor',
  kimi: 'Kimi',
  antigravity: 'Antigravity',
  cline: 'Cline',
  agent: 'Local Agent',
  pi: 'Pi',
};

export const TOOL_BADGE: Record<string, string> = {
  claude: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30',
  codex: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  gemini: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
  cursor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  kimi: 'bg-pink-500/15 text-pink-600 dark:text-pink-300 border-pink-500/30',
  antigravity: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  cline: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  agent: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  pi: 'bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/30',
};

export const ROLE_STYLE: Record<string, { ring: string; label: string; icon: React.ReactNode }> = {
  user: { ring: 'border-l-indigo-500', label: 'USER', icon: <UserIcon size={13} /> },
  assistant: { ring: 'border-l-emerald-500', label: 'ASSISTANT', icon: <Bot size={13} /> },
  thinking: { ring: 'border-l-slate-400', label: 'THINKING', icon: <Brain size={13} /> },
  tool_use: { ring: 'border-l-amber-500', label: 'TOOL', icon: <Wrench size={13} /> },
  tool_result: { ring: 'border-l-cyan-500', label: 'RESULT', icon: <Cpu size={13} /> },
  system: { ring: 'border-l-slate-400', label: 'SYSTEM', icon: <Cpu size={13} /> }
};

export const toolLabel = (tool: string): string => TOOL_LABELS[tool] || tool;

export const toolPill = (tool: string): string =>
  `inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${TOOL_BADGE[tool] || 'bg-slate-500/15 text-slate-500 border-slate-500/30'
  }`;
