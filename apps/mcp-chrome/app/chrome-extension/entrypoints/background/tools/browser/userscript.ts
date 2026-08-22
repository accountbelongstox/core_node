/**
 * UserScript Tool - Manage and execute userscripts
 * Basic implementation for userscript management
 */

import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { injectScriptTool } from './inject-script';
import { ExecutionWorld } from '@/common/constants';

interface UserScriptParams {
  action: 'create' | 'list' | 'get' | 'enable' | 'disable' | 'update' | 'remove' | 'send_command' | 'export';
  id?: string;
  code?: string;
  name?: string;
  enabled?: boolean;
  tabId?: number;
}

// Simple in-memory storage for userscripts
const userScripts = new Map<string, { code: string; name: string; enabled: boolean }>();

class UserScriptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.USERSCRIPT;

  async execute(args: UserScriptParams): Promise<ToolResult> {
    const { action, id, code, name, enabled, tabId } = args || {};

    try {
      switch (action) {
        case 'create':
          if (!code || !id) {
            return createErrorResponse('id and code are required for create action');
          }
          userScripts.set(id, {
            code,
            name: name || `UserScript ${id}`,
            enabled: enabled !== false,
          });
          return createJsonResponse({ success: true, id, message: 'UserScript created' });

        case 'list':
          const scripts = Array.from(userScripts.entries()).map(([scriptId, script]) => ({
            id: scriptId,
            name: script.name,
            enabled: script.enabled,
          }));
          return createJsonResponse({ success: true, scripts });

        case 'get':
          if (!id) {
            return createErrorResponse('id is required for get action');
          }
          const script = userScripts.get(id);
          if (!script) {
            return createErrorResponse(`UserScript with id "${id}" not found`);
          }
          return createJsonResponse({ success: true, id, ...script });

        case 'enable':
        case 'disable':
          if (!id) {
            return createErrorResponse('id is required for enable/disable action');
          }
          const targetScript = userScripts.get(id);
          if (!targetScript) {
            return createErrorResponse(`UserScript with id "${id}" not found`);
          }
          targetScript.enabled = action === 'enable';
          return createJsonResponse({
            success: true,
            id,
            enabled: targetScript.enabled,
          });

        case 'remove':
          if (!id) {
            return createErrorResponse('id is required for remove action');
          }
          const removed = userScripts.delete(id);
          return createJsonResponse({
            success: removed,
            id,
            message: removed ? 'UserScript removed' : 'UserScript not found',
          });

        case 'send_command':
          if (!id || !code) {
            return createErrorResponse('id and code are required for send_command action');
          }
          const cmdScript = userScripts.get(id);
          if (!cmdScript || !cmdScript.enabled) {
            return createErrorResponse(`UserScript with id "${id}" not found or disabled`);
          }

          // Execute the command code in the tab
          let targetTab: chrome.tabs.Tab | null | undefined;
          if (tabId) {
            targetTab = await this.tryGetTab(tabId);
          } else {
            targetTab = await this.getActiveTabOrThrow();
          }

          if (!targetTab?.id) {
            return createErrorResponse('No active tab found');
          }

          return await injectScriptTool.execute({
            jsScript: code,
            type: ExecutionWorld.ISOLATED,
          });

        default:
          return createErrorResponse(`Action "${action}" is not yet implemented`);
      }
    } catch (error) {
      console.error('Error in userscript tool:', error);
      return createErrorResponse(
        `UserScript tool error: ${toErrorMessage(error)}`,
      );
    }
  }
}

export const userscriptTool = new UserScriptTool();
