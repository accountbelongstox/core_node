import type { ComponentType } from 'react';
import type { TabType } from '../types';
import { TAB_ICONS, type LucideIcon } from '../lib/icons';
import DashboardPage from './DashboardPage';
import SubtitlePage from './SubtitlePage';
import QueueManagerPage from './QueueManagerPage';
import WindowAutomationPage from './WindowAutomationPage';
import CodeSyncPage from './CodeSyncPage';
import VideoExtractPage from './VideoExtractPage';
import TaskQueuePage from './TaskQueuePage';
import AiStatusPage from './AiStatusPage';
import TranslationQueuePage from './TranslationQueuePage';
import SettingsPage from './SettingsPage';

export interface PageDef {
  id: TabType;
  labelKey: string;       // key into the translation dictionary
  icon: LucideIcon;
  Component: ComponentType;
  bottom?: boolean;       // pin to the bottom of the sidebar
}

/**
 * Single source of truth for tabs. Add a new feature interface by appending one
 * entry here — the sidebar and the router both read from this list.
 */
export const PAGES: PageDef[] = [
  { id: 'voice_player',      labelKey: 'voicePlayer',      icon: TAB_ICONS.voice_player,      Component: DashboardPage },
  { id: 'subtitle',          labelKey: 'subtitle',         icon: TAB_ICONS.subtitle,          Component: SubtitlePage },
  { id: 'queue_manager',     labelKey: 'queueManager',     icon: TAB_ICONS.queue_manager,     Component: QueueManagerPage },
  { id: 'window_automation', labelKey: 'windowAutomation', icon: TAB_ICONS.window_automation, Component: WindowAutomationPage },
  { id: 'code_sync',         labelKey: 'codeSync',         icon: TAB_ICONS.code_sync,         Component: CodeSyncPage },
  { id: 'video_extract',     labelKey: 'videoExtract',     icon: TAB_ICONS.video_extract,     Component: VideoExtractPage },
  { id: 'task_queue',        labelKey: 'taskQueue',        icon: TAB_ICONS.task_queue,        Component: TaskQueuePage },
  { id: 'ai_status',         labelKey: 'aiStatus',         icon: TAB_ICONS.ai_status,         Component: AiStatusPage },
  { id: 'translation_queue', labelKey: 'tq',               icon: TAB_ICONS.translation_queue, Component: TranslationQueuePage },
  { id: 'settings',          labelKey: 'settings',         icon: TAB_ICONS.settings,          Component: SettingsPage, bottom: true },
];

export const PAGE_MAP = Object.fromEntries(PAGES.map((p) => [p.id, p])) as Record<TabType, PageDef>;
