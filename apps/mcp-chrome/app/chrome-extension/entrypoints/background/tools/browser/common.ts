import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { ERROR_MESSAGES } from '@/common/constants';
import { waitForTabComplete } from '@/utils/tab-readiness';

// Default window dimensions
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 720;

const NAVIGATION_WAIT_MS = 15_000;
const NAVIGATION_PROBE_DELAY_MS = 300;
const HISTORY_BACK = 'back';
const HISTORY_FORWARD = 'forward';

interface NavigateToolParams {
  url?: string;
  newWindow?: boolean;
  tabId?: number;
  windowId?: number;
  background?: boolean;
  width?: number;
  height?: number;
  refresh?: boolean;
}

function normalizeUrl(url: string | undefined): string | undefined {
  return url?.endsWith('/') ? url.slice(0, -1) : url;
}

async function waitForNavigation(tabId: number): Promise<chrome.tabs.Tab> {
  await waitForTabComplete(tabId, {
    timeoutMs: NAVIGATION_WAIT_MS,
    statusProbeDelayMs: NAVIGATION_PROBE_DELAY_MS,
    rejectOnTabClose: false,
  });
  return chrome.tabs.get(tabId);
}

function tabResponse(message: string, tab: chrome.tabs.Tab): ToolResult {
  return createJsonResponse({
    success: true,
    message,
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url || tab.pendingUrl,
    title: tab.title,
  });
}

/**
 * Tool for navigating to URLs in browser tabs or windows
 */
class NavigateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NAVIGATE;

  private async focus(tab: chrome.tabs.Tab, background: boolean): Promise<void> {
    if (!background) {
      await this.ensureFocus(tab, { activate: true, focusWindow: true });
    }
  }

  async execute(args: NavigateToolParams): Promise<ToolResult> {
    const { newWindow = false, width, height, url, refresh = false, tabId, windowId, background = false } =
      args || {};

    try {
      if (refresh || url === HISTORY_BACK || url === HISTORY_FORWARD) {
        const target = await this.resolveTargetTab(tabId, windowId);
        if (!target?.id) {
          return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND);
        }
        if (refresh) {
          await chrome.tabs.reload(target.id);
        } else if (url === HISTORY_BACK) {
          await chrome.tabs.goBack(target.id);
        } else {
          await chrome.tabs.goForward(target.id);
        }
        await this.focus(target, background);
        return tabResponse(
          refresh ? 'Successfully refreshed tab' : `Successfully navigated ${url} in browser history`,
          await waitForNavigation(target.id),
        );
      }

      if (!url) {
        return createErrorResponse('URL parameter is required when refresh is not true');
      }

      if (typeof tabId === 'number') {
        const target = await this.tryGetTab(tabId);
        if (!target?.id) {
          return createErrorResponse(`${ERROR_MESSAGES.TAB_NOT_FOUND}: ${tabId}`);
        }
        await chrome.tabs.update(target.id, { url });
        await this.focus(target, background);
        return tabResponse('Navigated existing tab', await waitForNavigation(target.id));
      }

      const openInNewWindow = newWindow || typeof width === 'number' || typeof height === 'number';
      if (!openInNewWindow) {
        const existingTab = (await chrome.tabs.query({})).find(
          (tab) =>
            normalizeUrl(tab.url) === normalizeUrl(url) &&
            (typeof windowId !== 'number' || tab.windowId === windowId),
        );
        if (existingTab?.id !== undefined) {
          await this.focus(existingTab, background);
          return tabResponse('Activated existing tab', await chrome.tabs.get(existingTab.id));
        }
      }

      if (!openInNewWindow) {
        const targetWindow =
          typeof windowId === 'number'
            ? await chrome.windows.get(windowId)
            : await chrome.windows.getLastFocused({ populate: false }).catch(() => null);
        if (targetWindow?.id !== undefined) {
          const newTab = await chrome.tabs.create({ url, windowId: targetWindow.id, active: !background });
          if (!background) {
            await chrome.windows.update(targetWindow.id, { focused: true });
          }
          return tabResponse(
            'Opened URL in new tab in existing window',
            newTab.id === undefined ? newTab : await waitForNavigation(newTab.id),
          );
        }
      }

      const createdWindow = await chrome.windows.create({
        url,
        width: typeof width === 'number' ? width : DEFAULT_WINDOW_WIDTH,
        height: typeof height === 'number' ? height : DEFAULT_WINDOW_HEIGHT,
        focused: !background,
      });
      const createdTab = createdWindow?.tabs?.[0];
      if (createdTab?.id !== undefined) {
        await waitForNavigation(createdTab.id);
      }
      return createJsonResponse({
        success: true,
        message: 'Opened URL in new window',
        windowId: createdWindow?.id,
        tabId: createdTab?.id,
        tabs: (createdWindow?.tabs || []).map((tab) => ({ tabId: tab.id, url: tab.url || tab.pendingUrl })),
      });
    } catch (error) {
      console.error('Error in navigate:', error);
      return createErrorResponse(`Error navigating to URL: ${toErrorMessage(error)}`);
    }
  }
}
export const navigateTool = new NavigateTool();

interface CloseTabsToolParams {
  tabIds?: number[];
  url?: string;
}

/**
 * Tool for closing browser tabs
 */
class CloseTabsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.CLOSE_TABS;

  async execute(args: CloseTabsToolParams): Promise<ToolResult> {
    const { tabIds, url } = args;
    let urlPattern = url;
    console.log(`Attempting to close tabs with options:`, args);

    try {
      // If URL is provided, close all tabs matching that URL
      if (urlPattern) {
        console.log(`Searching for tabs with URL: ${url}`);
        // Match the URL itself and its sub-paths by comparing strings: a bare
        // origin such as "https://example.com" is not a valid Chrome match pattern.
        if (urlPattern.endsWith('*')) {
          urlPattern = urlPattern.slice(0, -1);
        }
        const urlPrefix = normalizeUrl(urlPattern) || urlPattern;
        const tabs = (await chrome.tabs.query({})).filter((tab) => {
          const tabUrl = normalizeUrl(tab.url);
          return !!tabUrl && (tabUrl === urlPrefix || tabUrl.startsWith(`${urlPrefix}/`) || tabUrl.startsWith(`${urlPrefix}?`) || tabUrl.startsWith(`${urlPrefix}#`));
        });

        if (!tabs || tabs.length === 0) {
          console.log(`No tabs found with URL: ${url}`);
          return createJsonResponse({
            success: false,
            message: `No tabs found with URL: ${url}`,
            closedCount: 0,
          });
        }

        console.log(`Found ${tabs.length} tabs with URL: ${url}`);
        const tabIdsToClose = tabs
          .map((tab) => tab.id)
          .filter((id): id is number => id !== undefined);

        if (tabIdsToClose.length === 0) {
          return createErrorResponse('Found tabs but could not get their IDs');
        }

        await chrome.tabs.remove(tabIdsToClose);

        return createJsonResponse({
          success: true,
          message: `Closed ${tabIdsToClose.length} tabs with URL: ${url}`,
          closedCount: tabIdsToClose.length,
          closedTabIds: tabIdsToClose,
        });
      }

      // If tabIds are provided, close those tabs
      if (tabIds && tabIds.length > 0) {
        console.log(`Closing tabs with IDs: ${tabIds.join(', ')}`);

        // Verify that all tabIds exist
        const existingTabs = await Promise.all(
          tabIds.map(async (tabId) => {
            try {
              return await chrome.tabs.get(tabId);
            } catch (error) {
              console.warn(`Tab with ID ${tabId} not found`);
              return null;
            }
          }),
        );

        const validTabIds = existingTabs
          .filter((tab): tab is chrome.tabs.Tab => tab !== null)
          .map((tab) => tab.id)
          .filter((id): id is number => id !== undefined);

        if (validTabIds.length === 0) {
          return createJsonResponse({
            success: false,
            message: 'None of the provided tab IDs exist',
            closedCount: 0,
          });
        }

        await chrome.tabs.remove(validTabIds);

        return createJsonResponse({
          success: true,
          message: `Closed ${validTabIds.length} tabs`,
          closedCount: validTabIds.length,
          closedTabIds: validTabIds,
          invalidTabIds: tabIds.filter((id) => !validTabIds.includes(id)),
        });
      }

      // If no tabIds or URL provided, close the current active tab
      console.log('No tabIds or URL provided, closing active tab');
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!activeTab || !activeTab.id) {
        return createErrorResponse('No active tab found');
      }

      await chrome.tabs.remove(activeTab.id);

      return createJsonResponse({
        success: true,
        message: 'Closed active tab',
        closedCount: 1,
        closedTabIds: [activeTab.id],
      });
    } catch (error) {
      console.error('Error in CloseTabsTool.execute:', error);
      return createErrorResponse(
        `Error closing tabs: ${toErrorMessage(error)}`,
      );
    }
  }
}

export const closeTabsTool = new CloseTabsTool();

interface GoBackOrForwardToolParams {
  forward?: boolean;
  isForward?: boolean;
  tabId?: number;
  windowId?: number;
}

/**
 * Tool for navigating back or forward in browser history
 */
class GoBackOrForwardTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GO_BACK_OR_FORWARD;

  async execute(args: GoBackOrForwardToolParams): Promise<ToolResult> {
    const { tabId, windowId } = args || {};
    const isForward = args?.forward ?? args?.isForward ?? false;
    const direction = isForward ? 'forward' : 'back';

    try {
      const target = await this.resolveTargetTab(tabId, windowId);
      if (!target?.id) {
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND);
      }
      if (isForward) {
        await chrome.tabs.goForward(target.id);
      } else {
        await chrome.tabs.goBack(target.id);
      }
      return tabResponse(
        `Successfully navigated ${direction} in browser history`,
        await waitForNavigation(target.id),
      );
    } catch (error) {
      console.error('Error in GoBackOrForwardTool.execute:', error);
      return createErrorResponse(`Error navigating ${direction}: ${toErrorMessage(error)}`);
    }
  }
}

export const goBackOrForwardTool = new GoBackOrForwardTool();

interface SwitchTabToolParams {
  tabId: number;
  windowId?: number;
}

/**
 * Tool for switching the active tab
 */
class SwitchTabTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SWITCH_TAB;

  async execute(args: SwitchTabToolParams): Promise<ToolResult> {
    const { tabId, windowId } = args;

    console.log(`Attempting to switch to tab ID: ${tabId} in window ID: ${windowId}`);

    try {
      if (windowId !== undefined) {
        await chrome.windows.update(windowId, { focused: true });
      }
      await chrome.tabs.update(tabId, { active: true });

      const updatedTab = await chrome.tabs.get(tabId);

      return createJsonResponse({
        success: true,
        message: `Successfully switched to tab ID: ${tabId}`,
        tabId: updatedTab.id,
        windowId: updatedTab.windowId,
        url: updatedTab.url,
      });
    } catch (error) {
      if (chrome.runtime.lastError) {
        console.error(`Chrome API Error: ${chrome.runtime.lastError.message}`, error);
        return createErrorResponse(`Chrome API Error: ${chrome.runtime.lastError.message}`);
      } else {
        console.error('Error in SwitchTabTool.execute:', error);
        return createErrorResponse(
          `Error switching tab: ${toErrorMessage(error)}`,
        );
      }
    }
  }
}

export const switchTabTool = new SwitchTabTool();
