/**
 * UserScript Tool - Manage and execute userscripts
 * Basic implementation for userscript management
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { injectScriptTool } from './inject-script';

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
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, id, message: 'UserScript created' }),
              },
            ],
            isError: false,
          };

        case 'list':
          const scripts = Array.from(userScripts.entries()).map(([scriptId, script]) => ({
            id: scriptId,
            name: script.name,
            enabled: script.enabled,
          }));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, scripts }),
              },
            ],
            isError: false,
          };

        case 'get':
          if (!id) {
            return createErrorResponse('id is required for get action');
          }
          const script = userScripts.get(id);
          if (!script) {
            return createErrorResponse(`UserScript with id "${id}" not found`);
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, id, ...script }),
              },
            ],
            isError: false,
          };

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
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  id,
                  enabled: targetScript.enabled,
                }),
              },
            ],
            isError: false,
          };

        case 'remove':
          if (!id) {
            return createErrorResponse('id is required for remove action');
          }
          const removed = userScripts.delete(id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: removed,
                  id,
                  message: removed ? 'UserScript removed' : 'UserScript not found',
                }),
              },
            ],
            isError: false,
          };

        case 'send_command':
          if (!id || !code) {
            return createErrorResponse('id and code are required for send_command action');
          }
          const cmdScript = userScripts.get(id);
          if (!cmdScript || !cmdScript.enabled) {
            return createErrorResponse(`UserScript with id "${id}" not found or disabled`);
          }

          // Execute the command code in the tab
          let targetTab: chrome.tabs.Tab | undefined;
          if (tabId) {
            targetTab = await this.tryGetTab(tabId);
          } else {
            targetTab = await this.getActiveTabOrThrow();
          }

          if (!targetTab?.id) {
            return createErrorResponse('No active tab found');
          }

          return await injectScriptTool.execute({
            code,
            tabId: targetTab.id,
          });

        default:
          return createErrorResponse(`Action "${action}" is not yet implemented`);
      }
    } catch (error) {
      console.error('Error in userscript tool:', error);
      return createErrorResponse(
        `UserScript tool error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const userscriptTool = new UserScriptTool();
