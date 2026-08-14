import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { delay as waitForDelay } from '@/utils/async';
import {
  STATIC_MIME_TYPES_TO_FILTER,
  API_MIME_TYPES,
  StopReason,
  shouldFilterRequest,
  shouldFilterByMimeType,
  analyzeCommonHeaders,
  filterOutCommonHeaders,
} from './network-capture-utils';

interface NetworkDebuggerStartToolParams {
  url?: string; // URL to navigate to or focus. If not provided, uses active tab.
  maxCaptureTime?: number;
  inactivityTimeout?: number; // Inactivity timeout (milliseconds)
  includeStatic?: boolean; // if include static resources
  tabId?: number; // Specific tab to capture; bypasses URL query / active-tab lookup.
}

// Network request object interface
interface NetworkRequestInfo {
  requestId: string;
  url: string;
  method: string;
  requestHeaders?: Record<string, string>; // Will be removed after common headers extraction
  responseHeaders?: Record<string, string>; // Will be removed after common headers extraction
  requestTime?: number; // Timestamp of the request
  responseTime?: number; // Timestamp of the response
  type: string; // Resource type (e.g., Document, XHR, Fetch, Script, Stylesheet)
  status: string; // 'pending', 'complete', 'error'
  statusCode?: number;
  statusText?: string;
  requestBody?: string;
  responseBody?: string;
  base64Encoded?: boolean; // For responseBody
  encodedDataLength?: number; // Actual bytes received
  errorText?: string; // If loading failed
  canceled?: boolean; // If loading was canceled
  mimeType?: string;
  specificRequestHeaders?: Record<string, string>; // Headers unique to this request
  specificResponseHeaders?: Record<string, string>; // Headers unique to this response
  [key: string]: any; // Allow other properties from debugger events
}

const DEBUGGER_PROTOCOL_VERSION = '1.3';
const MAX_RESPONSE_BODY_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const DEFAULT_MAX_CAPTURE_TIME_MS = 3 * 60 * 1000; // 3 minutes
const DEFAULT_INACTIVITY_TIMEOUT_MS = 60 * 1000; // 1 minute
const FIREFOX_UNSUPPORTED_MESSAGE =
  'This tool relies on the Chrome debugger (CDP) API, which does not exist on Firefox. ' +
  'Use chrome_network_capture_start / chrome_network_capture_stop (or chrome_network_capture) instead: ' +
  'on Firefox they capture response bodies via webRequest stream filters.';

/**
 * Network capture start tool - uses Chrome Debugger API to start capturing network requests
 */
class NetworkDebuggerStartTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_START;
  private captureData: Map<number, any> = new Map(); // tabId -> capture data
  private captureTimers: Map<number, NodeJS.Timeout> = new Map(); // tabId -> max capture timer
  private inactivityTimers: Map<number, NodeJS.Timeout> = new Map(); // tabId -> inactivity timer
  private lastActivityTime: Map<number, number> = new Map(); // tabId -> timestamp of last network activity
  private pendingResponseBodies: Map<string, Promise<any>> = new Map(); // requestId -> promise for getResponseBody
  private requestCounters: Map<number, number> = new Map(); // tabId -> count of captured requests (after filtering)
  private static MAX_REQUESTS_PER_CAPTURE = 100; // Max requests to store to prevent memory issues
  public static instance: NetworkDebuggerStartTool | null = null;

  constructor() {
    super();
    if (NetworkDebuggerStartTool.instance) {
      return NetworkDebuggerStartTool.instance;
    }
    NetworkDebuggerStartTool.instance = this;

    // chrome.debugger does not exist on Firefox; execute() reports the alternative tool there.
    if (import.meta.env.FIREFOX) return;

    chrome.debugger.onEvent.addListener(this.handleDebuggerEvent.bind(this));
    chrome.debugger.onDetach.addListener(this.handleDebuggerDetach.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
  }

  private handleTabRemoved(tabId: number) {
    if (this.captureData.has(tabId)) {
      console.log(`NetworkDebuggerStartTool: Tab ${tabId} was closed, cleaning up resources.`);
      this.cleanupCapture(tabId);
    }
  }

  /**
   * Handle tab creation events
   * If a new tab is opened from a tab that is currently capturing, automatically start capturing the new tab's requests
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
        `NetworkDebuggerStartTool: New tab ${newTabId} created from capturing tab ${openerTabId}, will extend capture to it.`,
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

      console.log(`NetworkDebuggerStartTool: Successfully extended capture to new tab ${newTabId}`);
    } catch (error) {
      console.error(`NetworkDebuggerStartTool: Error extending capture to new tab:`, error);
    }
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
        `NetworkDebuggerStartTool: Already capturing on tab ${tabId}. Stopping previous session.`,
      );
      await this.stopCapture(tabId);
    }

    try {
      // Get tab information
      const tab = await chrome.tabs.get(tabId);

      // Check if debugger is already attached
      const targets = await chrome.debugger.getTargets();
      const existingTarget = targets.find(
        (t) => t.tabId === tabId && t.attached && t.type === 'page',
      );
      if (existingTarget && !existingTarget.extensionId) {
        throw new Error(
          `Debugger is already attached to tab ${tabId} by another tool (e.g., DevTools).`,
        );
      }

      // Attach debugger
      try {
        await chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION);
      } catch (error: any) {
        if (error.message?.includes('Cannot attach to the target with an attached client')) {
          throw new Error(
            `Debugger is already attached to tab ${tabId}. This might be DevTools or another extension.`,
          );
        }
        throw error;
      }

      // Enable network tracking
      try {
        await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
      } catch (error: any) {
        await chrome.debugger
          .detach({ tabId })
          .catch((e) => console.warn('Error detaching after failed enable:', e));
        throw error;
      }

      // Initialize capture data
      this.captureData.set(tabId, {
        startTime: Date.now(),
        tabUrl: tab.url,
        tabTitle: tab.title,
        maxCaptureTime,
        inactivityTimeout,
        includeStatic,
        requests: {},
        limitReached: false,
        detachedExternally: false,
      });

      // Initialize request counter
      this.requestCounters.set(tabId, 0);

      // Update last activity time
      this.updateLastActivityTime(tabId);

      console.log(
        `NetworkDebuggerStartTool: Started capture for tab ${tabId} (${tab.url}). Max requests: ${NetworkDebuggerStartTool.MAX_REQUESTS_PER_CAPTURE}, Max time: ${maxCaptureTime}ms, Inactivity: ${inactivityTimeout}ms.`,
      );

      // Set maximum capture time
      if (maxCaptureTime > 0) {
        this.captureTimers.set(
          tabId,
          setTimeout(async () => {
            console.log(
              `NetworkDebuggerStartTool: Max capture time (${maxCaptureTime}ms) reached for tab ${tabId}.`,
            );
            await this.stopCapture(tabId, 'max_capture_time');
          }, maxCaptureTime),
        );
      }
    } catch (error: any) {
      console.error(`NetworkDebuggerStartTool: Error starting capture for tab ${tabId}:`, error);

      // Clean up resources
      if (this.captureData.has(tabId)) {
        await chrome.debugger
          .detach({ tabId })
          .catch((e) => console.warn('Cleanup detach error:', e));
        this.cleanupCapture(tabId);
      }

      throw error;
    }
  }

  private handleDebuggerEvent(source: chrome.debugger.Debuggee, method: string, params?: any) {
    if (!source.tabId) return;

    const tabId = source.tabId;
    const captureInfo = this.captureData.get(tabId);

    if (!captureInfo) return; // Not capturing for this tab

    // NOTE: last-activity is updated inside each handler only after the
    // URL/MIME filter checks pass, so filtered background requests (ads,
    // analytics, static) do not reset the inactivity timeout. This mirrors the
    // webRequest capture path's structure.
    switch (method) {
      case 'Network.requestWillBeSent':
        this.handleRequestWillBeSent(tabId, params);
        break;
      case 'Network.responseReceived':
        this.handleResponseReceived(tabId, params);
        break;
      case 'Network.loadingFinished':
        this.handleLoadingFinished(tabId, params);
        break;
      case 'Network.loadingFailed':
        this.handleLoadingFailed(tabId, params);
        break;
    }
  }

  private handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: string) {
    if (source.tabId && this.captureData.has(source.tabId)) {
      console.log(
        `NetworkDebuggerStartTool: Debugger detached from tab ${source.tabId}, reason: ${reason}. Preserving captured data.`,
      );
      // Clear timers (no more events will arrive) but keep captureData so
      // stopCapture can still return the requests collected before the detach.
      if (this.captureTimers.has(source.tabId)) {
        clearTimeout(this.captureTimers.get(source.tabId)!);
        this.captureTimers.delete(source.tabId);
      }
      if (this.inactivityTimers.has(source.tabId)) {
        clearTimeout(this.inactivityTimers.get(source.tabId)!);
        this.inactivityTimers.delete(source.tabId);
      }
      // Mark the capture info so stopCapture knows the debugger is already gone
      // and skips the Network.disable / detach calls.
      const captureInfo = this.captureData.get(source.tabId);
      if (captureInfo) {
        captureInfo.detachedExternally = true;
      }
    }
  }

  private updateLastActivityTime(tabId: number) {
    this.lastActivityTime.set(tabId, Date.now());
    const captureInfo = this.captureData.get(tabId);

    if (captureInfo && captureInfo.inactivityTimeout > 0) {
      if (this.inactivityTimers.has(tabId)) {
        clearTimeout(this.inactivityTimers.get(tabId)!);
      }
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), captureInfo.inactivityTimeout),
      );
    }
  }

  private checkInactivity(tabId: number) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const lastActivity = this.lastActivityTime.get(tabId) || captureInfo.startTime; // Use startTime if no activity yet
    const now = Date.now();
    const inactiveTime = now - lastActivity;

    if (inactiveTime >= captureInfo.inactivityTimeout) {
      console.log(
        `NetworkDebuggerStartTool: No activity for ${inactiveTime}ms (threshold: ${captureInfo.inactivityTimeout}ms), stopping capture for tab ${tabId}`,
      );
      this.stopCaptureByInactivity(tabId);
    } else {
      // Reschedule check for the remaining time, this handles system sleep or other interruptions
      const remainingTime = Math.max(0, captureInfo.inactivityTimeout - inactiveTime);
      this.inactivityTimers.set(
        tabId,
        setTimeout(() => this.checkInactivity(tabId), remainingTime),
      );
    }
  }

  private async stopCaptureByInactivity(tabId: number) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    console.log(`NetworkDebuggerStartTool: Stopping capture due to inactivity for tab ${tabId}.`);
    // Potentially, we might want to notify the client/user that this happened.
    // For now, just stop and make the results available if StopTool is called.
    await this.stopCapture(tabId, 'inactivity_timeout');
  }

  private handleRequestWillBeSent(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, request, timestamp, type, loaderId, frameId } = params;

    // Initial filtering by URL (ads, analytics) and extension (if !includeStatic)
    if (
      shouldFilterRequest(request.url, captureInfo.includeStatic)
    ) {
      return;
    }

    const currentCount = this.requestCounters.get(tabId) || 0;
    if (currentCount >= NetworkDebuggerStartTool.MAX_REQUESTS_PER_CAPTURE) {
      // console.log(`NetworkDebuggerStartTool: Request limit (${NetworkDebuggerStartTool.MAX_REQUESTS_PER_CAPTURE}) reached for tab ${tabId}. Ignoring: ${request.url}`);
      captureInfo.limitReached = true; // Mark that limit was hit
      return;
    }

    // Non-filtered request: counts as real activity (mirrors webRequest path).
    this.updateLastActivityTime(tabId);

    // Store initial request info
    // Ensure we don't overwrite if a redirect (same requestId) occurred, though usually loaderId changes
    if (!captureInfo.requests[requestId]) {
      // Or check based on loaderId as well if needed
      captureInfo.requests[requestId] = {
        requestId,
        url: request.url,
        method: request.method,
        requestHeaders: request.headers, // Temporary, will be processed
        requestTime: timestamp * 1000, // Convert seconds to milliseconds
        type: type || 'Other',
        status: 'pending', // Initial status
        loaderId, // Useful for tracking redirects
        frameId, // Useful for context
      };

      if (request.postData) {
        captureInfo.requests[requestId].requestBody = request.postData;
      }
      // console.log(`NetworkDebuggerStartTool: Captured request for tab ${tabId}: ${request.method} ${request.url}`);
    } else {
      // This could be a redirect. Update URL and other relevant fields.
      // Chrome often issues a new `requestWillBeSent` for redirects with the same `requestId` but a new `loaderId`.
      // console.log(`NetworkDebuggerStartTool: Request ${requestId} updated (likely redirect) for tab ${tabId} to URL: ${request.url}`);
      const existingRequest = captureInfo.requests[requestId];
      existingRequest.url = request.url; // Update URL due to redirect
      existingRequest.requestTime = timestamp * 1000; // Update time for the redirected request
      if (request.headers) existingRequest.requestHeaders = request.headers;
      if (request.postData) existingRequest.requestBody = request.postData;
      else delete existingRequest.requestBody;
    }
  }

  private handleResponseReceived(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, response, timestamp, type } = params; // type here is resource type
    const requestInfo: NetworkRequestInfo = captureInfo.requests[requestId];

    if (!requestInfo) {
      // console.warn(`NetworkDebuggerStartTool: Received response for unknown requestId ${requestId} on tab ${tabId}`);
      return;
    }

    // Secondary filtering based on MIME type, now that we have it
    if (shouldFilterByMimeType(response.mimeType, captureInfo.includeStatic)) {
      // console.log(`NetworkDebuggerStartTool: Filtering request by MIME type (${response.mimeType}): ${requestInfo.url}`);
      delete captureInfo.requests[requestId]; // Remove from captured data
      // Note: We don't decrement requestCounter here as it's meant to track how many *potential* requests were processed up to MAX_REQUESTS.
      // Or, if MAX_REQUESTS is strictly for *stored* requests, then decrement. For now, let's assume it's for stored.
      // const currentCount = this.requestCounters.get(tabId) || 0;
      // if (currentCount > 0) this.requestCounters.set(tabId, currentCount -1);
      return;
    }

    // Non-filtered response: counts as real activity (mirrors webRequest path).
    this.updateLastActivityTime(tabId);

    // If not filtered by MIME, then increment actual stored request counter
    const currentStoredCount = Object.keys(captureInfo.requests).length; // A bit inefficient but accurate
    this.requestCounters.set(tabId, currentStoredCount);

    requestInfo.status = response.status === 0 ? 'pending' : 'complete'; // status 0 can mean pending or blocked
    requestInfo.statusCode = response.status;
    requestInfo.statusText = response.statusText;
    requestInfo.responseHeaders = response.headers; // Temporary
    requestInfo.mimeType = response.mimeType;
    requestInfo.responseTime = timestamp * 1000; // Convert seconds to milliseconds
    if (type) requestInfo.type = type; // Update resource type if provided by this event

    // console.log(`NetworkDebuggerStartTool: Received response for ${requestId} on tab ${tabId}: ${response.status}`);
  }

  private async handleLoadingFinished(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, encodedDataLength } = params;
    const requestInfo: NetworkRequestInfo = captureInfo.requests[requestId];

    if (!requestInfo) {
      // console.warn(`NetworkDebuggerStartTool: LoadingFinished for unknown requestId ${requestId} on tab ${tabId}`);
      return;
    }

    // Non-filtered request finished loading: counts as real activity.
    this.updateLastActivityTime(tabId);

    requestInfo.encodedDataLength = encodedDataLength;
    if (requestInfo.status === 'pending') requestInfo.status = 'complete'; // Mark as complete if not already
    // requestInfo.responseTime is usually set by responseReceived, but this timestamp is later.
    // timestamp here is when the resource finished loading. Could be useful for duration calculation.

    if (this.shouldCaptureResponseBody(requestInfo)) {
      try {
        // console.log(`NetworkDebuggerStartTool: Attempting to get response body for ${requestId} (${requestInfo.url})`);
        const responseBodyData = await this.getResponseBody(tabId, requestId);
        if (responseBodyData) {
          if (
            responseBodyData.body &&
            responseBodyData.body.length > MAX_RESPONSE_BODY_SIZE_BYTES
          ) {
            requestInfo.responseBody =
              responseBodyData.body.substring(0, MAX_RESPONSE_BODY_SIZE_BYTES) +
              `\n\n... [Response truncated, total size: ${responseBodyData.body.length} bytes] ...`;
          } else {
            requestInfo.responseBody = responseBodyData.body;
          }
          requestInfo.base64Encoded = responseBodyData.base64Encoded;
          // console.log(`NetworkDebuggerStartTool: Successfully got response body for ${requestId}, size: ${requestInfo.responseBody?.length || 0} bytes`);
        }
      } catch (error) {
        // console.warn(`NetworkDebuggerStartTool: Failed to get response body for ${requestId}:`, error);
        requestInfo.errorText =
          (requestInfo.errorText || '') +
          ` Failed to get body: ${toErrorMessage(error)}`;
      }
    }
  }

  private shouldCaptureResponseBody(requestInfo: NetworkRequestInfo): boolean {
    const mimeType = requestInfo.mimeType || '';

    // Prioritize API MIME types for body capture
    if (API_MIME_TYPES.some((type) => mimeType.startsWith(type))) {
      return true;
    }

    // Heuristics for other potential API calls not perfectly matching MIME types
    const url = requestInfo.url.toLowerCase();
    if (
      /\/(api|service|rest|graphql|query|data|rpc|v[0-9]+)\//i.test(url) ||
      url.includes('.json') ||
      url.includes('json=') ||
      url.includes('format=json')
    ) {
      // If it looks like an API call by URL structure, try to get body,
      // unless it's a known non-API MIME type that slipped through (e.g. a script from a /api/ path)
      if (
        mimeType &&
        STATIC_MIME_TYPES_TO_FILTER.some((staticMime) => mimeType.startsWith(staticMime))
      ) {
        return false; // e.g. a CSS file served from an /api/ path
      }
      return true;
    }

    return false;
  }

  private handleLoadingFailed(tabId: number, params: any) {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) return;

    const { requestId, errorText, canceled, type } = params;
    const requestInfo: NetworkRequestInfo = captureInfo.requests[requestId];

    if (!requestInfo) {
      // console.warn(`NetworkDebuggerStartTool: LoadingFailed for unknown requestId ${requestId} on tab ${tabId}`);
      return;
    }

    // Non-filtered request failed: counts as real activity.
    this.updateLastActivityTime(tabId);

    requestInfo.status = 'error';
    requestInfo.errorText = errorText;
    requestInfo.canceled = canceled;
    if (type) requestInfo.type = type;
    // timestamp here is when loading failed.
    // console.log(`NetworkDebuggerStartTool: Loading failed for ${requestId} on tab ${tabId}: ${errorText}`);
  }

  private async getResponseBody(
    tabId: number,
    requestId: string,
  ): Promise<{ body: string; base64Encoded: boolean } | null> {
    const pendingKey = `${tabId}_${requestId}`;
    if (this.pendingResponseBodies.has(pendingKey)) {
      return this.pendingResponseBodies.get(pendingKey)!; // Return existing promise
    }

    const responseBodyPromise = (async () => {
      try {
        // Check if debugger is still attached to this tabId
        const attachedTabs = await chrome.debugger.getTargets();
        if (!attachedTabs.some((target) => target.tabId === tabId && target.attached)) {
          // console.warn(`NetworkDebuggerStartTool: Debugger not attached to tab ${tabId} when trying to get response body for ${requestId}.`);
          throw new Error(`Debugger not attached to tab ${tabId}`);
        }

        const result = (await chrome.debugger.sendCommand({ tabId }, 'Network.getResponseBody', {
          requestId,
        })) as { body: string; base64Encoded: boolean };
        return result;
      } finally {
        this.pendingResponseBodies.delete(pendingKey); // Clean up after promise resolves or rejects
      }
    })();

    this.pendingResponseBodies.set(pendingKey, responseBodyPromise);
    return responseBodyPromise;
  }

  private cleanupCapture(tabId: number) {
    if (this.captureTimers.has(tabId)) {
      clearTimeout(this.captureTimers.get(tabId)!);
      this.captureTimers.delete(tabId);
    }
    if (this.inactivityTimers.has(tabId)) {
      clearTimeout(this.inactivityTimers.get(tabId)!);
      this.inactivityTimers.delete(tabId);
    }

    this.lastActivityTime.delete(tabId);
    this.captureData.delete(tabId);
    this.requestCounters.delete(tabId);

    // Abort pending getResponseBody calls for this tab
    // Note: Promises themselves cannot be "aborted" externally in a standard way once created.
    // We can delete them from the map, so new calls won't use them,
    // and the original promise will eventually resolve or reject.
    const keysToDelete: string[] = [];
    this.pendingResponseBodies.forEach((_, key) => {
      if (key.startsWith(`${tabId}_`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.pendingResponseBodies.delete(key));

    console.log(`NetworkDebuggerStartTool: Cleaned up resources for tab ${tabId}.`);
  }

  // stopReason is the explicit cause of the stop, surfaced as `stoppedBy` in the result.
  async stopCapture(tabId: number, stopReason: StopReason = 'user_request'): Promise<any> {
    const captureInfo = this.captureData.get(tabId);
    if (!captureInfo) {
      return { success: false, message: 'No capture in progress for this tab.' };
    }

    console.log(
      `NetworkDebuggerStartTool: Stopping capture for tab ${tabId}. Reason: ${stopReason}`,
    );

    // If the debugger was externally detached (e.g. DevTools opened), skip the
    // disable/detach calls — they would fail and the data was already preserved
    // by handleDebuggerDetach.
    if (!captureInfo.detachedExternally) {
      try {
        // Detach debugger first to prevent further events.
        // Check if debugger is attached before trying to send commands or detach
        const attachedTargets = await chrome.debugger.getTargets();
        const isAttached = attachedTargets.some(
          (target) => target.tabId === tabId && target.attached,
        );

        if (isAttached) {
          try {
            await chrome.debugger.sendCommand({ tabId }, 'Network.disable');
          } catch (e) {
            console.warn(
              `NetworkDebuggerStartTool: Error disabling network for tab ${tabId} (possibly already detached):`,
              e,
            );
          }
          try {
            await chrome.debugger.detach({ tabId });
          } catch (e) {
            console.warn(
              `NetworkDebuggerStartTool: Error detaching debugger for tab ${tabId} (possibly already detached):`,
              e,
            );
          }
        } else {
          console.log(
            `NetworkDebuggerStartTool: Debugger was not attached to tab ${tabId} at stopCapture.`,
          );
        }
      } catch (error: any) {
        // Catch errors from getTargets or general logic
        console.error(
          'NetworkDebuggerStartTool: Error during debugger interaction in stopCapture:',
          error,
        );
        // Proceed to cleanup and data formatting
      }
    }

    // Process data even if detach/disable failed, as some data might have been captured.
    const allRequests = Object.values(captureInfo.requests) as NetworkRequestInfo[];
    const commonRequestHeaders = analyzeCommonHeaders(allRequests, 'requestHeaders');
    const commonResponseHeaders = analyzeCommonHeaders(allRequests, 'responseHeaders');

    const processedRequests = allRequests.map((req) => {
      const finalReq: Partial<NetworkRequestInfo> &
        Pick<NetworkRequestInfo, 'requestId' | 'url' | 'method' | 'type' | 'status'> = { ...req };

      if (finalReq.requestHeaders) {
        finalReq.specificRequestHeaders = filterOutCommonHeaders(
          finalReq.requestHeaders,
          commonRequestHeaders,
        );
        delete finalReq.requestHeaders; // Remove original full headers
      } else {
        finalReq.specificRequestHeaders = {};
      }

      if (finalReq.responseHeaders) {
        finalReq.specificResponseHeaders = filterOutCommonHeaders(
          finalReq.responseHeaders,
          commonResponseHeaders,
        );
        delete finalReq.responseHeaders; // Remove original full headers
      } else {
        finalReq.specificResponseHeaders = {};
      }
      return finalReq as NetworkRequestInfo; // Cast back to full type
    });

    // Sort requests by requestTime
    processedRequests.sort((a, b) => (a.requestTime || 0) - (b.requestTime || 0));

    const resultData = {
      captureStartTime: captureInfo.startTime,
      captureEndTime: Date.now(),
      totalDurationMs: Date.now() - captureInfo.startTime,
      commonRequestHeaders,
      commonResponseHeaders,
      requests: processedRequests,
      requestCount: processedRequests.length, // Actual stored requests
      totalRequestsReceivedBeforeLimit: captureInfo.limitReached
        ? NetworkDebuggerStartTool.MAX_REQUESTS_PER_CAPTURE
        : processedRequests.length,
      requestLimitReached: !!captureInfo.limitReached,
      stoppedBy: stopReason,
      tabUrl: captureInfo.tabUrl,
      tabTitle: captureInfo.tabTitle,
    };

    console.log(
      `NetworkDebuggerStartTool: Capture stopped for tab ${tabId}. ${resultData.requestCount} requests processed. Limit reached: ${resultData.requestLimitReached}. Stopped by: ${resultData.stoppedBy}`,
    );

    this.cleanupCapture(tabId); // Final cleanup of all internal states for this tab

    return {
      success: true,
      message: `Capture stopped. ${resultData.requestCount} requests.`,
      data: resultData,
    };
  }

  async execute(args: NetworkDebuggerStartToolParams): Promise<ToolResult> {
    if (import.meta.env.FIREFOX) {
      return createErrorResponse(FIREFOX_UNSUPPORTED_MESSAGE);
    }

    const {
      url: targetUrl,
      maxCaptureTime = DEFAULT_MAX_CAPTURE_TIME_MS,
      inactivityTimeout = DEFAULT_INACTIVITY_TIMEOUT_MS,
      includeStatic = false,
      tabId: explicitTabId,
    } = args;

    console.log(
      `NetworkDebuggerStartTool: Executing with args: url=${targetUrl}, tabId=${explicitTabId}, maxTime=${maxCaptureTime}, inactivityTime=${inactivityTimeout}, includeStatic=${includeStatic}`,
    );

    let tabToOperateOn: chrome.tabs.Tab | undefined;

    try {
      if (explicitTabId != null) {
        // Direct tabId: skip URL query / active-tab lookup entirely.
        tabToOperateOn = await chrome.tabs.get(explicitTabId);
      } else if (targetUrl) {
        const existingTabs = await chrome.tabs.query({
          url: targetUrl.startsWith('http') ? targetUrl : `*://*/*${targetUrl}*`,
        }); // More specific query
        if (existingTabs.length > 0 && existingTabs[0]?.id) {
          tabToOperateOn = existingTabs[0];
          // Ensure window gets focus and tab is truly activated
          await chrome.windows.update(tabToOperateOn.windowId, { focused: true });
          await chrome.tabs.update(tabToOperateOn.id!, { active: true });
        } else {
          tabToOperateOn = await chrome.tabs.create({ url: targetUrl, active: true });
          // Wait for tab to be somewhat ready. A better way is to listen to tabs.onUpdated status='complete'
          // but for debugger attachment, it just needs the tabId.
          await waitForDelay(500);
        }
      } else {
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabs.length > 0 && activeTabs[0]?.id) {
          tabToOperateOn = activeTabs[0];
        } else {
          return createErrorResponse('No active tab found and no URL provided.');
        }
      }

      if (!tabToOperateOn?.id) {
        return createErrorResponse('Failed to identify or create a target tab.');
      }
      const tabId = tabToOperateOn.id;

      // Use startCaptureForTab method to start capture
      try {
        await this.startCaptureForTab(tabId, {
          maxCaptureTime,
          inactivityTimeout,
          includeStatic,
        });
      } catch (error: any) {
        return createErrorResponse(
          `Failed to start capture for tab ${tabId}: ${error.message || String(error)}`,
        );
      }

      return createJsonResponse({
        success: true,
        message: `Network capture started on tab ${tabId}. Waiting for stop command or timeout.`,
        tabId,
        url: tabToOperateOn.url,
        maxCaptureTime,
        inactivityTimeout,
        includeStatic,
        maxRequests: NetworkDebuggerStartTool.MAX_REQUESTS_PER_CAPTURE,
      });
    } catch (error: any) {
      console.error('NetworkDebuggerStartTool: Critical error during execute:', error);
      // If a tabId was involved and debugger might be attached, try to clean up.
      const tabIdToClean = tabToOperateOn?.id;
      if (tabIdToClean && this.captureData.has(tabIdToClean)) {
        await chrome.debugger
          .detach({ tabId: tabIdToClean })
          .catch((e) => console.warn('Cleanup detach error:', e));
        this.cleanupCapture(tabIdToClean);
      }
      return createErrorResponse(
        `Error in NetworkDebuggerStartTool: ${error.message || String(error)}`,
      );
    }
  }
}

/**
 * Network capture stop tool - stops capture and returns results for the active tab
 */
class NetworkDebuggerStopTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_STOP;
  public static instance: NetworkDebuggerStopTool | null = null;

  constructor() {
    super();
    if (NetworkDebuggerStopTool.instance) {
      return NetworkDebuggerStopTool.instance;
    }
    NetworkDebuggerStopTool.instance = this;
  }

  async execute(args?: { tabId?: number }): Promise<ToolResult> {
    if (import.meta.env.FIREFOX) {
      return createErrorResponse(FIREFOX_UNSUPPORTED_MESSAGE);
    }

    const explicitTabId = args?.tabId;
    console.log(`NetworkDebuggerStopTool: Executing command. tabId=${explicitTabId}`);

    const startTool = NetworkDebuggerStartTool.instance;
    if (!startTool) {
      return createErrorResponse(
        'NetworkDebuggerStartTool instance not available. Cannot stop capture.',
      );
    }

    // Get all tabs currently capturing
    const ongoingCaptures = Array.from(startTool['captureData'].keys());
    console.log(
      `NetworkDebuggerStopTool: Found ${ongoingCaptures.length} ongoing captures: ${ongoingCaptures.join(', ')}`,
    );

    if (ongoingCaptures.length === 0) {
      return createErrorResponse('No active network captures found in any tab.');
    }

    // Determine the primary tab to stop
    let primaryTabId: number;

    if (explicitTabId != null && startTool['captureData'].has(explicitTabId)) {
      // Explicit tabId from the unified tool takes highest priority
      primaryTabId = explicitTabId;
      console.log(
        `NetworkDebuggerStopTool: Explicit tabId ${explicitTabId} is capturing, stopping it.`,
      );
    } else if (explicitTabId != null) {
      // Explicit tabId provided but not currently capturing
      return createErrorResponse(
        `No active network capture found for tab ${explicitTabId}. Active captures: ${ongoingCaptures.join(', ')}`,
      );
    } else {
      // No explicit tabId: fall back to active tab or first capture
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTabId = activeTabs[0]?.id;

      if (activeTabId && startTool['captureData'].has(activeTabId)) {
        // If current active tab is capturing, prioritize stopping it
        primaryTabId = activeTabId;
        console.log(
          `NetworkDebuggerStopTool: Active tab ${activeTabId} is capturing, will stop it first.`,
        );
      } else if (ongoingCaptures.length === 1) {
        // If only one tab is capturing, stop it
        primaryTabId = ongoingCaptures[0];
        console.log(
          `NetworkDebuggerStopTool: Only one tab ${primaryTabId} is capturing, stopping it.`,
        );
      } else {
        // If multiple tabs are capturing but current active tab is not among them, stop the first one
        primaryTabId = ongoingCaptures[0];
        console.log(
          `NetworkDebuggerStopTool: Multiple tabs capturing, active tab not among them. Stopping tab ${primaryTabId} first.`,
        );
      }
    }

    // Stop capture for the primary tab
    const result = await this.performStop(startTool, primaryTabId);

    // If multiple tabs are capturing, stop other tabs
    if (ongoingCaptures.length > 1) {
      const otherTabIds = ongoingCaptures.filter((id) => id !== primaryTabId);
      console.log(
        `NetworkDebuggerStopTool: Stopping ${otherTabIds.length} additional captures: ${otherTabIds.join(', ')}`,
      );

      for (const tabId of otherTabIds) {
        try {
          await startTool.stopCapture(tabId);
        } catch (error) {
          console.error(`NetworkDebuggerStopTool: Error stopping capture on tab ${tabId}:`, error);
        }
      }
    }

    return result;
  }

  private async performStop(
    startTool: NetworkDebuggerStartTool,
    tabId: number,
  ): Promise<ToolResult> {
    console.log(`NetworkDebuggerStopTool: Attempting to stop capture for tab ${tabId}.`);
    const stopResult = await startTool.stopCapture(tabId);

    if (!stopResult?.success) {
      return createErrorResponse(
        stopResult?.message ||
          `Failed to stop network capture for tab ${tabId}. It might not have been capturing.`,
      );
    }

    const resultData = stopResult.data || {};

    // Get all tabs still capturing (there might be other tabs still capturing after stopping)
    const remainingCaptures = Array.from(startTool['captureData'].keys());

    // Sort requests by time
    if (resultData.requests && Array.isArray(resultData.requests)) {
      resultData.requests.sort(
        (a: NetworkRequestInfo, b: NetworkRequestInfo) =>
          (a.requestTime || 0) - (b.requestTime || 0),
      );
    }

    return createJsonResponse({
      success: true,
      message: `Capture for tab ${tabId} (${resultData.tabUrl || 'N/A'}) stopped. ${resultData.requestCount || 0} requests captured.`,
      tabId,
      tabUrl: resultData.tabUrl || 'N/A',
      tabTitle: resultData.tabTitle || 'Unknown Tab',
      requestCount: resultData.requestCount || 0,
      commonRequestHeaders: resultData.commonRequestHeaders || {},
      commonResponseHeaders: resultData.commonResponseHeaders || {},
      requests: resultData.requests || [],
      captureStartTime: resultData.captureStartTime,
      captureEndTime: resultData.captureEndTime,
      totalDurationMs: resultData.totalDurationMs,
      settingsUsed: resultData.settingsUsed || {},
      remainingCaptures,
      totalRequestsReceived: resultData.totalRequestsReceived || resultData.requestCount || 0,
      requestLimitReached: resultData.requestLimitReached || false,
      stoppedBy: resultData.stoppedBy || 'user_request',
    });
  }
}

export const networkDebuggerStartTool = new NetworkDebuggerStartTool();
export const networkDebuggerStopTool = new NetworkDebuggerStopTool();
