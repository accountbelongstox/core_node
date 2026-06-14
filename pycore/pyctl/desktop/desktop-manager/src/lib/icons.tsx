/**
 * Central icon system (lucide-react). The whole UI uses these instead of emoji.
 * lucide-react is already a dependency and is tree-shakeable + visually consistent.
 */
import {
  LayoutDashboard, Captions, Layers, MonitorCog, Code2, ListChecks,
  Clapperboard, Settings as SettingsIcon, Cpu, Sun, Moon, Mic, Image as ImageIcon,
  FileText, ListTodo, AppWindow, BrainCircuit, ListOrdered, type LucideIcon,
} from 'lucide-react';
import type { TabType, QueueItem } from '../types';

/** Sidebar / tab icons, keyed by tab id. */
export const TAB_ICONS: Record<TabType, LucideIcon> = {
  voice_player: LayoutDashboard,
  subtitle: Captions,
  queue_manager: Layers,
  window_automation: MonitorCog,
  code_sync: Code2,
  task_queue: ListChecks,
  video_extract: Clapperboard,
  ai_status: BrainCircuit,
  translation_queue: ListOrdered,
  settings: SettingsIcon,
};

/** Queue item category icons. */
export const CATEGORY_ICONS: Record<QueueItem['category'], LucideIcon> = {
  Voice: Mic,
  Image: ImageIcon,
  File: FileText,
  Task: ListTodo,
  Video: Clapperboard,
  Window: AppWindow,
};

export { Cpu, Sun, Moon, SettingsIcon, Captions };
export type { LucideIcon };
