import React, { useState } from 'react';
import {
  Sparkles,
  Languages,
  Volume2,
  FileImage,
  FileText,
  Activity,
  MessageSquare,
  ImagePlus,
  Images,
  Boxes,
  History,
  AudioLines,
  Film,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

// Centralized architecture tool forms (rendered unchanged).
import TranslationForm from '../examples/TranslationForm';
import TTSForm from '../tools/TTSForm';
import OCRForm from '../tools/OCRForm';
import PromptForm from '../tools/PromptForm';
import AiStatusPanel from '../ai-tools/AiStatusPanel';
import AiChatTestPanel from '../ai-tools/AiChatTestPanel';
import AiImageGenPanel from '../ai-tools/AiImageGenPanel';
import AiImageHistoryPanel from '../ai-tools/AiImageHistoryPanel';
import AssistQueuePanel from '../ai-tools/AssistQueuePanel';
import MoviePosterPanel from '../ai-tools/MoviePosterPanel';
import TranslationHistoryPanel from '../ai-tools/TranslationHistoryPanel';
import TtsHistoryPanel from '../ai-tools/TtsHistoryPanel';

type ToolView =
  | 'chat'
  | 'image-gen'
  | 'image-history'
  | 'translation'
  | 'translation-history'
  | 'tts'
  | 'tts-history'
  | 'assist-queue'
  | 'movie-poster'
  | 'ocr'
  | 'prompts'
  | 'status';

interface NavItem {
  id: ToolView;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  /** One-word signal used in the mono breadcrumb. */
  signal: string;
}

/**
 * Per-tool accent tokens. A single signal colour per tool drives the active
 * rail bar, icon and glow — not a full gradient fill — so the shell reads as
 * a precision console rather than a generic SaaS panel.
 */
const ACCENT: Record<ToolView, { text: string; bar: string; ring: string; glow: string; dot: string; ambient: string }> = {
  chat: { text: 'text-sky-300', bar: 'bg-sky-400', ring: 'ring-sky-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(56,189,248,0.55)]', dot: 'bg-sky-400', ambient: 'bg-sky-500/10 dark:bg-sky-400/10' },
  'image-gen': { text: 'text-fuchsia-300', bar: 'bg-fuchsia-400', ring: 'ring-fuchsia-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(232,121,249,0.55)]', dot: 'bg-fuchsia-400', ambient: 'bg-fuchsia-500/10 dark:bg-fuchsia-400/10' },
  'image-history': { text: 'text-rose-300', bar: 'bg-rose-400', ring: 'ring-rose-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(251,113,133,0.55)]', dot: 'bg-rose-400', ambient: 'bg-rose-500/10 dark:bg-rose-400/10' },
  translation: { text: 'text-cyan-300', bar: 'bg-cyan-400', ring: 'ring-cyan-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(34,211,238,0.55)]', dot: 'bg-cyan-400', ambient: 'bg-cyan-500/10 dark:bg-cyan-400/10' },
  'translation-history': { text: 'text-cyan-300', bar: 'bg-cyan-400', ring: 'ring-cyan-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(34,211,238,0.55)]', dot: 'bg-cyan-400', ambient: 'bg-cyan-500/10 dark:bg-cyan-400/10' },
  tts: { text: 'text-emerald-300', bar: 'bg-emerald-400', ring: 'ring-emerald-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(52,211,153,0.55)]', dot: 'bg-emerald-400', ambient: 'bg-emerald-500/10 dark:bg-emerald-400/10' },
  'tts-history': { text: 'text-emerald-300', bar: 'bg-emerald-400', ring: 'ring-emerald-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(52,211,153,0.55)]', dot: 'bg-emerald-400', ambient: 'bg-emerald-500/10 dark:bg-emerald-400/10' },
  'assist-queue': { text: 'text-indigo-300', bar: 'bg-indigo-400', ring: 'ring-indigo-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(129,140,248,0.55)]', dot: 'bg-indigo-400', ambient: 'bg-indigo-500/10 dark:bg-indigo-400/10' },
  'movie-poster': { text: 'text-rose-300', bar: 'bg-rose-400', ring: 'ring-rose-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(251,113,133,0.55)]', dot: 'bg-rose-400', ambient: 'bg-rose-500/10 dark:bg-rose-400/10' },
  ocr: { text: 'text-amber-300', bar: 'bg-amber-400', ring: 'ring-amber-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(251,191,36,0.55)]', dot: 'bg-amber-400', ambient: 'bg-amber-500/10 dark:bg-amber-400/10' },
  prompts: { text: 'text-violet-300', bar: 'bg-violet-400', ring: 'ring-violet-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(167,139,250,0.55)]', dot: 'bg-violet-400', ambient: 'bg-violet-500/10 dark:bg-violet-400/10' },
  status: { text: 'text-indigo-300', bar: 'bg-indigo-400', ring: 'ring-indigo-400/30', glow: 'shadow-[0_0_24px_-6px_rgba(129,140,248,0.55)]', dot: 'bg-indigo-400', ambient: 'bg-indigo-500/10 dark:bg-indigo-400/10' }
};

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat Test', description: 'Single-message gateway chat test', signal: 'CHAT' },
  { id: 'image-gen', icon: ImagePlus, label: 'Image Gen', description: 'Generate an image via the gateway', signal: 'IMAGE' },
  { id: 'image-history', icon: Images, label: 'Image History', description: 'Browse & manage generated images', signal: 'GALLERY' },
  { id: 'translation', icon: Languages, label: 'AI Translation', description: 'Translate text between languages', signal: 'TRANSLATE' },
  { id: 'translation-history', icon: History, label: 'Translation History', description: 'Completed & failed translation records', signal: 'TRANS-LOG' },
  { id: 'tts', icon: Volume2, label: 'Text-to-Speech', description: 'Convert text to natural speech', signal: 'SPEECH' },
  { id: 'tts-history', icon: AudioLines, label: 'TTS History', description: 'Per-word audio generation records', signal: 'TTS-LOG' },
  { id: 'assist-queue', icon: Boxes, label: 'Assist Queue', description: 'Cover/TTS/translation work pycore drains', signal: 'ASSIST' },
  { id: 'movie-poster', icon: Film, label: 'Movie Poster', description: 'Poster pipeline status & on-demand fetch', signal: 'POSTER' },
  { id: 'ocr', icon: FileImage, label: 'OCR', description: 'Extract text from images', signal: 'VISION' },
  { id: 'prompts', icon: FileText, label: 'Prompt Manager', description: 'Manage and organize prompts', signal: 'PROMPTS' },
  { id: 'status', icon: Activity, label: 'AI Status', description: 'Providers, keys, models & live test', signal: 'STATUS' }
];

const AITools: React.FC = () => {
  const [currentView, setCurrentView] = useState<ToolView>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderContent = () => {
    switch (currentView) {
      case 'chat':
        return <AiChatTestPanel />;
      case 'image-gen':
        return <AiImageGenPanel />;
      case 'image-history':
        return <AiImageHistoryPanel onReuse={() => setCurrentView('image-gen')} />;
      case 'translation':
        return <TranslationForm />;
      case 'translation-history':
        return <TranslationHistoryPanel />;
      case 'tts':
        return <TTSForm />;
      case 'tts-history':
        return <TtsHistoryPanel />;
      case 'assist-queue':
        return <AssistQueuePanel />;
      case 'movie-poster':
        return <MoviePosterPanel />;
      case 'ocr':
        return <OCRForm />;
      case 'prompts':
        return <PromptForm />;
      case 'status':
        return <AiStatusPanel />;
      default:
        return <TranslationForm />;
    }
  };

  const active = NAV_ITEMS.find((i) => i.id === currentView) ?? NAV_ITEMS[0];
  const activeAccent = ACCENT[active.id];

  return (
    <div className="relative h-full flex overflow-hidden bg-[#f7f8fa] text-slate-800 dark:bg-[#0a0d12] dark:text-slate-200">
      {/* Atmospheric backdrop: hairline dot-grid + a single soft corner glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.05)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.045)_1px,transparent_0)] [background-size:22px_22px]"
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full blur-3xl transition-colors duration-700 ${activeAccent.ambient}`}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-slate-400/5 dark:bg-white/[0.02] blur-3xl"
      />

      {/* ── Console rail ─────────────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'w-72' : 'w-[68px]'} relative z-10 flex flex-col
          border-r border-slate-200/80 dark:border-white/5
          bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl
          transition-[width] duration-300 ease-out`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200/80 dark:border-white/5">
          <div className="relative shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-slate-900 dark:bg-white/10 ring-1 ring-white/10">
            <span className="absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,rgba(34,211,238,0.6),transparent_55%)] animate-[spin_6s_linear_infinite] opacity-70" />
            <Sparkles className="relative w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="font-semibold tracking-tight leading-none truncate">AI Tools</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Console
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {sidebarOpen && (
            <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">
              Modules
            </div>
          )}
          <ul className="space-y-1">
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const a = ACCENT[item.id];
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setCurrentView(item.id)}
                    title={sidebarOpen ? undefined : item.label}
                    className={`group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left
                      transition-all duration-200
                      ${isActive
                        ? 'bg-slate-900/[0.04] dark:bg-white/[0.05]'
                        : 'hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.03] hover:translate-x-0.5'}`}
                  >
                    {/* Active accent bar */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300
                        ${isActive ? `h-7 ${a.bar}` : 'h-0 bg-transparent'}`}
                    />
                    {/* Index ticker */}
                    {sidebarOpen && (
                      <span className="w-5 shrink-0 text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-600">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    )}
                    {/* Icon chip */}
                    <span
                      className={`grid place-items-center shrink-0 w-9 h-9 rounded-lg ring-1 transition-all duration-200
                        ${isActive
                          ? `bg-white dark:bg-white/[0.06] ${a.ring} ${a.glow}`
                          : 'bg-slate-100 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/5'}`}
                    >
                      <Icon className={`w-[18px] h-[18px] ${isActive ? a.text : 'text-slate-500 dark:text-slate-400'}`} />
                    </span>
                    {sidebarOpen && (
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-medium leading-tight truncate ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {item.label}
                        </span>
                        <span className="block mt-0.5 text-[11px] leading-tight text-slate-400 dark:text-slate-500 truncate">
                          {item.description}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse control */}
        <div className="p-2 border-t border-slate-200/80 dark:border-white/5">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400
              hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04] hover:text-slate-800 dark:hover:text-slate-200
              transition-colors"
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            {sidebarOpen
              ? <PanelLeftClose className="w-[18px] h-[18px] shrink-0" />
              : <PanelLeftOpen className="w-[18px] h-[18px] shrink-0" />}
            {sidebarOpen && <span className="text-xs font-mono uppercase tracking-[0.15em]">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Workspace ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Header strip */}
        <header className="shrink-0 px-7 h-16 flex items-center justify-between border-b border-slate-200/80 dark:border-white/5 bg-white/40 dark:bg-white/[0.015] backdrop-blur-sm">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 dark:text-slate-600">
              AI&nbsp;TOOLS&nbsp;<span className="text-slate-300 dark:text-slate-700">/</span>&nbsp;
              <span className={activeAccent.text}>{active.signal}</span>
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white truncate">
              {active.label}
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0 rounded-full px-3 py-1.5 bg-slate-900/[0.04] dark:bg-white/[0.04] ring-1 ring-slate-200/70 dark:ring-white/5">
            <span className={`relative flex w-2 h-2`}>
              <span className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${activeAccent.dot}`} />
              <span className={`relative inline-flex w-2 h-2 rounded-full ${activeAccent.dot}`} />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
              Ready
            </span>
          </div>
        </header>

        {/* Content frame */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="min-h-full rounded-2xl ring-1 ring-slate-200/60 dark:ring-white/5 bg-white/70 dark:bg-white/[0.025] backdrop-blur-md overflow-auto shadow-sm">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AITools;
