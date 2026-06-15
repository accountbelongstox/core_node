/**
 * pycore-manager page registry — single source of truth for the sidebar + router.
 * Mirrors desktop-manager/src/pages/registry.tsx, adapted to the shell's routes
 * (/pycore-manager/<id>). Add a page by appending one entry.
 */
import React, { lazy } from 'react';
import {
  Volume2, ListOrdered, AppWindow, FolderSync,
  Film, Settings, BookOpen, Activity, Image as ImageIcon, type LucideIcon,
} from 'lucide-react';

export const PcVoiceSubtitlePage = lazy(() => import('./pages/PcVoiceSubtitlePage'));
export const PcQueueCenterPage = lazy(() => import('./pages/PcQueueCenterPage'));
export const PcWindowAutomationPage = lazy(() => import('./pages/PcWindowAutomationPage'));
export const PcCodeSyncPage = lazy(() => import('./pages/PcCodeSyncPage'));
export const PcVideoExtractPage = lazy(() => import('./pages/PcVideoExtractPage'));
export const PcBooksPage = lazy(() => import('./pages/PcBooksPage'));
export const PcAiStatusPage = lazy(() => import('./pages/PcAiStatusPage'));
export const PcAiImagePage = lazy(() => import('./pages/PcAiImagePage'));
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
  { id: 'video-extract', labelKey: 'nav.videoExtract', Icon: Film, Component: PcVideoExtractPage },
  { id: 'books', labelKey: 'nav.books', Icon: BookOpen, Component: PcBooksPage },
  { id: 'ai-status', labelKey: 'nav.aiStatus', Icon: Activity, Component: PcAiStatusPage },
  { id: 'ai-image', labelKey: 'nav.aiImage', Icon: ImageIcon, Component: PcAiImagePage },
  { id: 'settings', labelKey: 'nav.settings', Icon: Settings, Component: PcSettingsPage, bottom: true },
];
