/**
 * pycore-manager page registry — single source of truth for the sidebar + router.
 * Mirrors desktop-manager/src/pages/registry.tsx, adapted to the shell's routes
 * (/pycore-manager/<id>). Add a page by appending one entry.
 */
import React, { lazy } from 'react';
import {
  Volume2, ListOrdered, AppWindow, FolderSync,
  Settings, Library, Sparkles, Clapperboard, type LucideIcon,
} from 'lucide-react';

export const PcVoiceSubtitlePage = lazy(() => import('./pages/PcVoiceSubtitlePage'));
export const PcQueueCenterPage = lazy(() => import('./pages/PcQueueCenterPage'));
export const PcWindowAutomationPage = lazy(() => import('./pages/PcWindowAutomationPage'));
export const PcCodeSyncPage = lazy(() => import('./pages/PcCodeSyncPage'));
// The three former ingest pages (video-extract / books / add-document) are merged
// into ONE tabbed "Content" page. Their old routes redirect into it with the
// matching ?tab= (see PcApp.tsx).
export const PcContentPage = lazy(() => import('./pages/PcContentPage'));
export const PcMoviePosterPage = lazy(() => import('./pages/PcMoviePosterPage'));
// The three former AI pages (ai-status / ai-image / ai-keys) are merged into one
// tabbed "AI" page. Their old routes redirect into it with the matching ?tab=.
export const PcAiPage = lazy(() => import('./pages/PcAiPage'));
export const PcSettingsPage = lazy(() => import('./pages/PcSettingsPage'));

export interface PcPageDef {
  id: string;
  /** i18n key under the `pc` namespace (e.g. nav.voiceSubtitle). */
  labelKey: string;
  Icon: LucideIcon;
  Component: React.ComponentType;
  index?: boolean;
  bottom?: boolean;
}

export const PC_PAGES: PcPageDef[] = [
  { id: 'voice-subtitle', labelKey: 'nav.voiceSubtitle', Icon: Volume2, Component: PcVoiceSubtitlePage, index: true },
  { id: 'queue-center', labelKey: 'nav.queueCenter', Icon: ListOrdered, Component: PcQueueCenterPage },
  { id: 'window-automation', labelKey: 'nav.windowAutomation', Icon: AppWindow, Component: PcWindowAutomationPage },
  { id: 'code-sync', labelKey: 'nav.codeSync', Icon: FolderSync, Component: PcCodeSyncPage },
  { id: 'content', labelKey: 'nav.content', Icon: Library, Component: PcContentPage },
  { id: 'movie-poster', labelKey: 'nav.moviePoster', Icon: Clapperboard, Component: PcMoviePosterPage },
  { id: 'ai', labelKey: 'nav.ai', Icon: Sparkles, Component: PcAiPage },
  { id: 'settings', labelKey: 'nav.settings', Icon: Settings, Component: PcSettingsPage, bottom: true },
];
