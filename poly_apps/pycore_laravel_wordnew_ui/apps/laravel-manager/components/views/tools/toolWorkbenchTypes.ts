/** Contract between the Tools page shell and each tool's own workbench. */
import type { ComponentType, LazyExoticComponent } from 'react';
import type { ToolDefinition } from '@/apps/laravel-manager/types';
import type { ToolUsageEntry } from './toolUsageStore';

export interface ToolWorkbenchProps {
  /** Canonical tool definition. */
  tool: ToolDefinition;
  /** Tool id the user opened (an alias id selects a preset mode). */
  variant: string;
  /** Last recorded run of this tool, for prefilling inputs. */
  lastRun?: ToolUsageEntry;
}

export type ToolWorkbench = LazyExoticComponent<ComponentType<ToolWorkbenchProps>>;

export type ToolWorkbenchMap = Record<string, ToolWorkbench>;
