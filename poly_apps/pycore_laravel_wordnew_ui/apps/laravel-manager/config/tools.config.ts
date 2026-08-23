/** Composed Laravel Manager tool registry and lookup helpers. */
import type { ToolDefinition } from '@/apps/laravel-manager/types';
import { AI_TOOLS, VOCABULARY_TOOLS } from './tools.config.ai';
import { ALL_ADVANCED_IT_TOOLS } from './tools.config.advanced';
import { ALL_EXTENDED_IT_TOOLS } from './tools.config.extended';
import { IT_TOOLS } from './tools.config.it';
import { ALL_MISSING_TOOLS } from './tools.config.missing';
import { SERVER_MANAGER_TOOLS, VOICE_SUBTITLE_TOOLS } from './tools.config.system';

export { AI_TOOLS, IT_TOOLS, SERVER_MANAGER_TOOLS, VOCABULARY_TOOLS, VOICE_SUBTITLE_TOOLS };

export const ALL_TOOLS: Record<string, ToolDefinition> = {
  ...AI_TOOLS,
  ...VOCABULARY_TOOLS,
  ...SERVER_MANAGER_TOOLS,
  ...IT_TOOLS,
  ...ALL_EXTENDED_IT_TOOLS,
  ...ALL_ADVANCED_IT_TOOLS,
  ...ALL_MISSING_TOOLS,
  ...VOICE_SUBTITLE_TOOLS,
};

export function getToolConfig(toolId: string): ToolDefinition | undefined {
  return ALL_TOOLS[toolId];
}

export function getToolsByCategory(category: string): ToolDefinition[] {
  return Object.values(ALL_TOOLS).filter((tool) => tool.category === category);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(Object.values(ALL_TOOLS).map((tool) => tool.category)));
}

