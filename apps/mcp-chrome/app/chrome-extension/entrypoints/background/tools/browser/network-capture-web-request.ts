import { createErrorResponse, createJsonResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { LIMITS } from '@/common/constants';
import { firefoxNetworkBodyCapture } from './network-capture-body-firefox';
import { delay as waitForDelay } from '@/utils/async';
import {
  StopReason,
  shouldFilterRequest,
  shouldFilterByMimeType,
  analyzeCommonHeaders,
  filterOutCommonHeaders,
} from './network-capture-utils';
import { NetworkCaptureStopExecutor } from './network-capture-stop';

interface NetworkCaptureStartToolParams {
  url?: string; // URL to navigate to or focus. If not provided, uses active tab.
  maxCaptureTime?: number; // Maximum capture time (milliseconds)
  inactivityTimeout?: number; // Inactivity timeout (milliseconds)
  includeStatic?: boolean; // Whether to include static resources
  tabId?: number; // Specific tab to capture; bypasses URL query / active-tab lookup.
}

interface NetworkRequestInfo {
  requestId: string;
  url: string;
  method: string;
  type: string;
  requestTime: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseTime?: number;
  status?: number;
  statusText?: string;
  responseSize?: number;
  responseType?: string;
  responseBody?: string;
  base64Encoded?: boolean; // For responseBody (Firefox StreamFilter capture)
  errorText?: string;
  specificRequestHeaders?: Record<string, string>;
  specificResponseHeaders?: Record<string, string>;
  mimeType?: string; // Response MIME type
}

interface CaptureInfo {
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  startTime: number;
  endTime?: number;
  requests: Record<string, NetworkRequestInfo>;
  maxCaptureTime: number;
  inactivityTimeout: number;
  includeStatic: boolean;
  limitReached?: boolean; // Whether request count limit is reached
}

/**
 * Network Capture Start Tool V2 - Uses Chrome webRequest API to start capturing network requests
 */
export class NetworkCaptureStartTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NETWORK_CAPTURE_START;
  public static instance: NetworkCaptureStartTool | null = null;
  public captureData: Map<number, CaptureInfo> = new Map(); // tabId -> capture data
  private captureTimers: Map<number, NodeJS.Timeout> = new Map(); // tabId -> max capture timer
  private inactivityTimers: Map<number, NodeJS.Timeout> = new Map(); // tabId -> inactivity timer
  private lastActivityTime: Map<number, number> = new Map(); // tabId -> timestamp of last activity
  private requestCounters: Map<number, number> = new Map(); // tabId -> count of captured requests
  public static MAX_REQUESTS_PER_CAPTURE = LIMITS.MAX_NETWORK_REQUESTS; // Maximum capture request count
  private listeners: { [key: string]: (details: any) => void } = {};
  private listenersRegistered = false; // Guards against duplicate webRequest listener registration

  constructor() {
    super();
    if (NetworkCaptureStartTool.instance) {
      return NetworkCaptureStartTool.instance;
    }
    NetworkCaptureStartTool.instance = this;

    // Listen for tab close events
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    // Listen for tab creation events
    chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));

    // Register webRequest listeners once for the lifetime of the service worker;
    // handlers short-circuit via captureData when no tab is being captured, so
    // they must not be added/removed per capture cycle (which leaks listeners).
    this.setupListeners();
  }

  /**
   * Handle tab close events
   */
  private handleTabRemoved(tabId: number) {
    if (this.captureData.has(tabId)) {
      console.log(`NetworkCaptureV2: Tab ${tabId} was closed, cleaning up resources.`);
      this.cleanupCapture(tabId);
    }
  }

  /**
   * Handle tab creation events
   * If a new tab is opened from a tab being captured, automatically start capturing the new tab's requests
   */
  private async handleTabCreated(tab: chrome.tabs.Tab) {
    try {
      // Check if there are any tabs currently capturing
      if (this.captureData.size === 0) return;

      // Get the openerTabId of the new tab (ID of the tab that opened this tab)
      const openerTabId = tab.openerTabId;
      if (!openerTabId) return;

      // Check if the opener tab is currently capturing
      if (!this.captureData.has(openerTabId)) return;

      // Get the new tab's ID
      const newTabId = tab.id;
      if (!newTabId) return;

      console.log(
        `NetworkCaptureV2: New tab ${newTabId} created from capturing tab ${openerTabId}, will extend capture to it.`,
      );

      // Get the opener tab's capture settings
      const openerCaptureInfo = this.captureData.get(openerTabId);
      if (!openerCaptureInfo) return;

      // Wait a short time to ensure the tab is ready
      await waitForDelay(500);

      // Start capturing requests for the new tab
      await this.startCaptureForTab(newTabId, {
        maxCaptureTime: openerCaptureInfo.maxCaptureTime,
        inactivityTimeout: openerCaptureInfo.inactivityTimeout,
        includeStatic: openerCaptureInfo.includeStatic,
      });

      console.log(`NetworkCaptureV2: Successfully extended capture to new tab ${newTabId}`);
    } catch (error) {
      console.error(`NetworkCaptureV2: Error extending capture to new tab:`, error);
    }
  }

  /**
   * Update last activity time and reset inactivity timer
   */
  private updateLastActivityTime(tabId: number): void {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    this.lastActivityTime.set(tabId, Date.now());

    // Reset inactivity timer
    if (this.inactivityTimers.has(tabId)) {
      clearTimeout(this.inactivityTimers.get(tabId)!);
    }

    if (captureInfo.inactivityTimeout > 0) {
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), captureInfo.inactivityTimeout),
      );
    }
  }

  /**
   * Check for inactivity
   */
  private checkInactivity(tabId: number): void {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const lastActivity = this.lastActivityTime.get(tabId) || captureInfo.startTime;
    const now = Date.now();
    const inactiveTime = now - lastActivity;

    if (inactiveTime >= captureInfo.inactivityTimeout) {
      console.log(
        `NetworkCaptureV2: No activity for ${inactiveTime}ms, stopping capture for tab ${tabId}`,
      );
      this.stopCaptureByInactivity(tabId);
    } else {
      // If inactivity time hasn't been reached yet, continue checking
      const remainingTime = Math.max(0, captureInfo.inactivityTimeout - inactiveTime);
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), remainingTime),
      );
    }
  }

  /**
   * Stop capture due to inactivity
   */
  private async stopCaptureByInactivity(tabId: number): Promise<void> {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    console.log(`NetworkCaptureV2: Stopping capture due to inactivity for tab ${tabId}`);
    await this.stopCapture(tabId, 'inactivity_timeout');
  }

  /**
   * Clean up capture resources
   */
  private cleanupCapture(tabId: number): void {
    // Clear timers
    if (this.captureTimers.has(tabId)) {
      clearTimeout(this.captureTimers.get(tabId)!);
      this.captureTimers.delete(tabId);
    }

    if (this.inactivityTimers.has(tabId)) {
      clearTimeout(this.inactivityTimers.get(tabId)!);
      this.inactivityTimers.delete(tabId);
    }

    // Remove data
    this.lastActivityTime.delete(tabId);
    this.captureData.delete(tabId);
    this.requestCounters.delete(tabId);

    // On Firefox, release StreamFilter body capture resources
    if (import.meta.env.FIREFOX) firefoxNetworkBodyCapture.endSession(tabId);

    console.log(`NetworkCaptureV2: Cleaned up all resources for tab ${tabId}`);
  }

  /**
   * Set up request listeners
   */
  private setupListeners(): void {
    // Listeners are registered once (constructor); ignore any later call so we
    // never orphan function references that chrome.webRequest can no longer remove.
    if (this.listenersRegistered) return;

    // Before request is sent
    this.listeners.onBeforeRequest = (details: chrome.webRequest.WebRequestBodyDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo) return;

      if (shouldFilterRequest(details.url, captureInfo.includeStatic)) {
        return;
      }

      const currentCount = this.requestCounters.get(details.tabId) || 0;
      if (currentCount >= NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE) {
        console.log(
          `NetworkCaptureV2: Request limit (${NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE}) reached for tab ${details.tabId}, ignoring new request: ${details.url}`,
        );
        captureInfo.limitReached = true;
        return;
      }

      this.updateLastActivityTime(details.tabId);

      // Only count and store genuinely new requests; redirects reuse the requestId
      // and would otherwise inflate the counter and trip the limit early.
      if (!captureInfo.requests[details.requestId]) {
        this.requestCounters.set(details.tabId, currentCount + 1);

        captureInfo.requests[details.requestId] = {
          requestId: details.requestId,
          url: details.url,
          method: details.method,
          type: details.type,
          requestTime: details.timeStamp,
        };

        if (details.requestBody) {
          const requestBody = this.processRequestBody(details.requestBody);
          if (requestBody) {
            captureInfo.requests[details.requestId].requestBody = requestBody;
          }
        }

        console.log(
          `NetworkCaptureV2: Captured request ${currentCount + 1}/${NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE} for tab ${details.tabId}: ${details.method} ${details.url}`,
        );
      }
    };

    // Send request headers
    this.listeners.onSendHeaders = (details: chrome.webRequest.WebRequestHeadersDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;

      if (details.requestHeaders) {
        const headers: Record<string, string> = {};
        details.requestHeaders.forEach((header) => {
          headers[header.name] = header.value || '';
        });
        captureInfo.requests[details.requestId].requestHeaders = headers;
      }
    };

    // Receive response headers
    this.listeners.onHeadersReceived = (details: chrome.webRequest.WebResponseHeadersDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;

      const requestInfo = captureInfo.requests[details.requestId];

      requestInfo.status = details.statusCode;
      requestInfo.statusText = details.statusLine;
      requestInfo.responseTime = details.timeStamp;
      requestInfo.mimeType = details.responseHeaders?.find(
        (h) => h.name.toLowerCase() === 'content-type',
      )?.value;

      // Secondary filtering based on MIME type
      if (
        requestInfo.mimeType &&
        shouldFilterByMimeType(requestInfo.mimeType, captureInfo.includeStatic)
      ) {
        delete captureInfo.requests[details.requestId];

        const currentCount = this.requestCounters.get(details.tabId) || 0;
        if (currentCount > 0) {
          this.requestCounters.set(details.tabId, currentCount - 1);
        }

        console.log(
          `NetworkCaptureV2: Filtered request by MIME type (${requestInfo.mimeType}): ${requestInfo.url}`,
        );
        return;
      }

      if (details.responseHeaders) {
        const headers: Record<string, string> = {};
        details.responseHeaders.forEach((header) => {
          headers[header.name] = header.value || '';
        });
        requestInfo.responseHeaders = headers;
      }

      this.updateLastActivityTime(details.tabId);
    };

    // Request completed
    this.listeners.onCompleted = (details: chrome.webRequest.WebResponseCacheDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;

      const requestInfo = captureInfo.requests[details.requestId];
      if ('responseSize' in details) {
        requestInfo.responseSize = details.fromCache ? 0 : (details as any).responseSize;
      }

      this.updateLastActivityTime(details.tabId);
    };

    // Request failed
    this.listeners.onErrorOccurred = (details: chrome.webRequest.WebResponseErrorDetails) => {
      const captureInfo = this.captureData.get(details.tabId);
      if (!captureInfo || !captureInfo.requests[details.requestId]) return;

      const requestInfo = captureInfo.requests[details.requestId];
      requestInfo.errorText = details.error;

      this.updateLastActivityTime(details.tabId);
    };

    // Register all listeners
    chrome.webRequest.onBeforeRequest.addListener(
      this.listeners.onBeforeRequest,
      { urls: ['<all_urls>'] },
      ['requestBody'],
    );

    chrome.webRequest.onSendHeaders.addListener(
      this.listeners.onSendHeaders,
      { urls: ['<all_urls>'] },
      ['requestHeaders'],
    );

    chrome.webRequest.onHeadersReceived.addListener(
      this.listeners.onHeadersReceived,
      { urls: ['<all_urls>'] },
      ['responseHeaders'],
    );

    chrome.webRequest.onCompleted.addListener(this.listeners.onCompleted, { urls: ['<all_urls>'] });

    chrome.webRequest.onErrorOccurred.addListener(this.listeners.onErrorOccurred, {
      urls: ['<all_urls>'],
    });

    this.listenersRegistered = true;
  }

  /**
   * Process request body data
   */
  private processRequestBody(requestBody: chrome.webRequest.WebRequestBody): string | undefined {
    if (requestBody.raw && requestBody.raw.length > 0) {
      // Chrome delivers JSON/text POST bodies as raw byte arrays. Decode as UTF-8
      // (fatal mode) so real text/JSON bodies are captured; fall back to
      // '[Binary data]' only when the bytes are not valid UTF-8.
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const parts: string[] = [];
        for (const entry of requestBody.raw) {
          if (entry && entry.bytes) {
            parts.push(decoder.decode(entry.bytes));
          }
        }
        return parts.join('');
      } catch (e) {
        return '[Binary data]';
      }
    } else if (requestBody.formData) {
      return JSON.stringify(requestBody.formData);
    }
    return undefined;
  }

  /**
   * Start network request capture for specified tab
   * @param tabId Tab ID
   * @param options Capture options
   */
  private async startCaptureForTab(
    tabId: number,
    options: {
      maxCaptureTime: number;
      inactivityTimeout: number;
      includeStatic: boolean;
    },
  ): Promise<void> {
    const { maxCaptureTime, inactivityTimeout, includeStatic } = options;

    // If already capturing, stop first
    if (this.captureData.has(tabId)) {
      console.log(
        `NetworkCaptureV2: Already capturing on tab ${tabId}. Stopping previous session.`,
      );
      await this.stopCapture(tabId);
    }

    try {
      // Get tab information
      const tab = await chrome.tabs.get(tabId);

      // Initialize capture data
      this.captureData.set(tabId, {
        tabId: tabId,
        tabUrl: tab.url || '',
        tabTitle: tab.title || '',
        startTime: Date.now(),
        requests: {},
        maxCaptureTime,
        inactivityTimeout,
        includeStatic,
        limitReached: false,
      });

      // Initialize request counter
      this.requestCounters.set(tabId, 0);

      // On Firefox, buffer response bodies via StreamFilter for this session
      if (import.meta.env.FIREFOX) firefoxNetworkBodyCapture.startSession(tabId, includeStatic);

      // Update last activity time
      this.updateLastActivityTime(tabId);

      console.log(
        `NetworkCaptureV2: Started capture for tab ${tabId} (${tab.url}). Max requests: ${NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE}, Max time: ${maxCaptureTime}ms, Inactivity: ${inactivityTimeout}ms.`,
      );

      // Set maximum capture time
      if (maxCaptureTime > 0) {
        this.captureTimers.set(
          tabId,
          setTimeout(async () => {
            console.log(
              `NetworkCaptureV2: Max capture time (${maxCaptureTime}ms) reached for tab ${tabId}.`,
            );
            await this.stopCapture(tabId, 'max_capture_time');
          }, maxCaptureTime),
        );
      }
    } catch (error: any) {
      console.error(`NetworkCaptureV2: Error starting capture for tab ${tabId}:`, error);

      // Clean up resources
      if (this.captureData.has(tabId)) {
        this.cleanupCapture(tabId);
      }

      throw error;
    }
  }

  /**
   * Stop capture
   * @param tabId Tab ID
   * @param stopReason Explicit cause of the stop, surfaced as `stoppedBy` in the result
   */
  activeCaptureTabIds(): number[] {
    return Array.from(this.captureData.keys());
  }

  hasCapture(tabId: number): boolean {
    return this.captureData.has(tabId);
  }

  public async stopCapture(
    tabId: number,
    stopReason: StopReason = 'user_request',
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) {
      console.log(`NetworkCaptureV2: No capture in progress for tab ${tabId}`);
      return { success: false, message: `No capture in progress for tab ${tabId}` };
    }

    try {
      // Record end time
      captureInfo.endTime = Date.now();

      // On Firefox, merge buffered response bodies before result processing
      if (import.meta.env.FIREFOX) firefoxNetworkBodyCapture.attachBodies(tabId, captureInfo.requests);

      // Extract common request and response headers
      const requestsArray = Object.values(captureInfo.requests);
      const commonRequestHeaders = analyzeCommonHeaders(requestsArray, 'requestHeaders');
      const commonResponseHeaders = analyzeCommonHeaders(requestsArray, 'responseHeaders');

      // Process request data, remove common headers
      const processedRequests = requestsArray.map((req) => {
        const finalReq: NetworkRequestInfo = { ...req };

        if (finalReq.requestHeaders) {
          finalReq.specificRequestHeaders = filterOutCommonHeaders(
            finalReq.requestHeaders,
            commonRequestHeaders,
          );
          delete finalReq.requestHeaders;
        } else {
          finalReq.specificRequestHeaders = {};
        }

        if (finalReq.responseHeaders) {
          finalReq.specificResponseHeaders = filterOutCommonHeaders(
            finalReq.responseHeaders,
            commonResponseHeaders,
          );
          delete finalReq.responseHeaders;
        } else {
          finalReq.specificResponseHeaders = {};
        }

        return finalReq;
      });

      // Sort by time
      processedRequests.sort((a, b) => (a.requestTime || 0) - (b.requestTime || 0));

      // Prepare result data
      const resultData = {
        captureStartTime: captureInfo.startTime,
        captureEndTime: captureInfo.endTime,
        totalDurationMs: captureInfo.endTime - captureInfo.startTime,
        settingsUsed: {
          maxCaptureTime: captureInfo.maxCaptureTime,
          inactivityTimeout: captureInfo.inactivityTimeout,
          includeStatic: captureInfo.includeStatic,
          maxRequests: NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE,
        },
        commonRequestHeaders,
        commonResponseHeaders,
        requests: processedRequests,
        requestCount: processedRequests.length,
        totalRequestsReceived: this.requestCounters.get(tabId) || 0,
        requestLimitReached: captureInfo.limitReached || false,
        stoppedBy: stopReason,
        tabUrl: captureInfo.tabUrl,
        tabTitle: captureInfo.tabTitle,
      };

      // Clean up resources
      this.cleanupCapture(tabId);

      return {
        success: true,
        message: `Capture stopped. ${resultData.requestCount} requests.`,
        data: resultData,
      };
    } catch (error: any) {
      console.error(`NetworkCaptureV2: Error stopping capture for tab ${tabId}:`, error);

      // Ensure resources are cleaned up
      this.cleanupCapture(tabId);

      return {
        success: false,
        message: `Error stopping capture: ${error.message || String(error)}`,
      };
    }
  }

  async execute(args: NetworkCaptureStartToolParams): Promise<ToolResult> {
    const {
      url: targetUrl,
      maxCaptureTime = 3 * 60 * 1000, // Default 3 minutes
      inactivityTimeout = 60 * 1000, // Default 1 minute of inactivity before auto-stop
      includeStatic = false, // Default: don't include static resources
      tabId: explicitTabId,
    } = args;

    console.log(`NetworkCaptureStartTool: Executing with args:`, args);

    try {
      // Get current tab or create new tab
      let tabToOperateOn: chrome.tabs.Tab;

      if (explicitTabId != null) {
        // Direct tabId: skip URL query / active-tab lookup entirely.
        tabToOperateOn = await chrome.tabs.get(explicitTabId);
      } else if (targetUrl) {
        // Find tabs matching the URL
        const matchingTabs = await chrome.tabs.query({ url: targetUrl });

        if (matchingTabs.length > 0) {
          // Use existing tab
          tabToOperateOn = matchingTabs[0];
          console.log(`NetworkCaptureV2: Found existing tab with URL: ${targetUrl}`);
        } else {
          // Create new tab
          console.log(`NetworkCaptureV2: Creating new tab with URL: ${targetUrl}`);
          tabToOperateOn = await chrome.tabs.create({ url: targetUrl, active: true });

          // Wait for page to load
          await waitForDelay(1000);
        }
      } else {
        // Use current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          return createErrorResponse('No active tab found');
        }
        tabToOperateOn = tabs[0];
      }

      if (!tabToOperateOn?.id) {
        return createErrorResponse('Failed to identify or create a tab');
      }

      // Use startCaptureForTab method to start capture
      try {
        await this.startCaptureForTab(tabToOperateOn.id, {
          maxCaptureTime,
          inactivityTimeout,
          includeStatic,
        });
      } catch (error: any) {
        return createErrorResponse(
          `Failed to start capture for tab ${tabToOperateOn.id}: ${error.message || String(error)}`,
        );
      }

      return createJsonResponse({
        success: true,
        message: 'Network capture V2 started successfully, waiting for stop command.',
        tabId: tabToOperateOn.id,
        url: tabToOperateOn.url,
        maxCaptureTime,
        inactivityTimeout,
        includeStatic,
        maxRequests: NetworkCaptureStartTool.MAX_REQUESTS_PER_CAPTURE,
      });
    } catch (error: any) {
      console.error('NetworkCaptureStartTool: Critical error:', error);
      return createErrorResponse(
        `Error in NetworkCaptureStartTool: ${error.message || String(error)}`,
      );
    }
  }
}

export const networkCaptureStartTool = new NetworkCaptureStartTool();
export const networkCaptureStopTool = new NetworkCaptureStopExecutor({
  name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE_STOP,
  label: 'NetworkCaptureStopTool',
  controller: () => NetworkCaptureStartTool.instance,
});
