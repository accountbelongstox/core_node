/**
 * pycore-manager page registry — single source of truth for the sidebar + router.
 * Mirrors desktop-manager/src/pages/registry.tsx, adapted to the shell's routes
 * (/pycore-manager/<id>). Add a page by appending one entry.
 */
import React, { lazy } from 'react';
import {
  ListOrdered, AppWindow, FolderSync,
  Settings, Library, Sparkles, History, BookOpen, type LucideIcon,
} from 'lucide-react';

export const PcQueueCenterPage = lazy(() => import('./pages/PcQueueCenterPage'));
export const PcWindowAutomationPage = lazy(() => import('./pages/PcWindowAutomationPage'));
export const PcCodeSyncPage = lazy(() => import('./pages/PcCodeSyncPage'));
// The "Content" page is the single laravel_main DATA-INGEST surface: it merges
// the former ingest pages (video-extract / books / add-document) AND Movie Poster
// into ONE tabbed page (sub-tabs, keep-alive mounted so progress survives
// switching). CoreBook is folded into the Books sub-tab as an advanced section
// (PcCoreBookPanel). Their old routes redirect into it with the matching ?tab=
// (corebook → ?tab=books; see PcApp.tsx); none have their own sidebar entry.
export const PcContentPage = lazy(() => import('./pages/PcContentPage'));
// The unified "AI & Pycore Capabilities" page. It merges the three former AI
// pages (ai-status / ai-image / ai-keys) AND the former standalone Translate /
// Image Search / Subtitle Search pages into ONE tabbed surface, plus a unified
// usage-History tab. The old routes all redirect into it with the matching ?tab=
// (see PcApp.tsx). PcAiPage imports those three page components directly — they
// no longer have their own sidebar entry or route here.
export const PcAiPage = lazy(() => import('./pages/PcAiPage'));
export const PcAgentHistoryPage = lazy(() => import('./pages/PcAgentHistoryPage'));
export const PcTaskLogPage = lazy(() => import('./pages/PcTaskLogPage'));
// Vocabulary is a self-contained direct-Laravel surface. It does not reuse the
// shared VocabularyLearning component because pycore-manager has a separate UI
// composition and does not provide that component's shell contexts.
export const PcVocabularyPage = lazy(() => import('./pages/PcVocabularyPage'));
// OKX market data lives ONLY in /vortex (apps/vortex/OkxBacktestPanel.tsx, the
// "OKX 回测" tab). It is intentionally NOT surfaced in /pycore-manager — the crypto
// backtest belongs to the Vortex app, not the operator panel. Do not re-add a
// PcOkxMarketPage here; edit the shared OkxBacktestPanel in vortex instead.
export const PcSettingsPage = lazy(() => import('./pages/PcSettingsPage'));

export interface PcPageDef {
  id: string;
  /** i18n key under the `pc` namespace (e.g. nav.agentHistory). */
  labelKey: string;
  Icon: LucideIcon;
  Component: React.ComponentType;
  index?: boolean;
  bottom?: boolean;
}

export const PC_PAGES: PcPageDef[] = [
  { id: 'queue-center', labelKey: 'nav.queueCenter', Icon: ListOrdered, Component: PcQueueCenterPage },
  { id: 'window-automation', labelKey: 'nav.windowAutomation', Icon: AppWindow, Component: PcWindowAutomationPage },
  { id: 'code-sync', labelKey: 'nav.codeSync', Icon: FolderSync, Component: PcCodeSyncPage },
  // One data-ingest tab: Subtitles / Books / Add Document / Movie Poster are
  // sub-tabs inside PcContentPage (movie-poster folded in; CoreBook is an
  // advanced section inside the Books sub-tab).
  { id: 'content', labelKey: 'nav.content', Icon: Library, Component: PcContentPage },
  // Vocabulary - dictionary words / libraries / statistics / translate / TTS
  // queue through the browser-owned Laravel API client.
  { id: 'vocabulary', labelKey: 'nav.vocabulary', Icon: BookOpen, Component: PcVocabularyPage },
  // "AI & Pycore Capabilities" — Translate / Image Search / Subtitle Search are
  // now sub-tabs inside this page (+ a unified usage-History tab), not separate
  // sidebar entries; their old routes redirect to /ai?tab=… (see PcApp.tsx).
  { id: 'ai', labelKey: 'nav.ai', Icon: Sparkles, Component: PcAiPage },
  { id: 'agent-history', labelKey: 'nav.agentHistory', Icon: History, Component: PcAgentHistoryPage, index: true },
  { id: 'task-log', labelKey: 'nav.taskLog', Icon: History, Component: PcTaskLogPage },
  // NOTE: no OKX entry here — OKX market/backtest lives only in /vortex (see comment above).
  { id: 'settings', labelKey: 'nav.settings', Icon: Settings, Component: PcSettingsPage, bottom: true },
];
