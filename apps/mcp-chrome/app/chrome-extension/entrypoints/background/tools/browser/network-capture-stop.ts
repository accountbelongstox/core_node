import { createErrorResponse, createJsonResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';

export interface NetworkCaptureController {
  activeCaptureTabIds(): number[];
  hasCapture(tabId: number): boolean;
  stopCapture(tabId: number): Promise<any>;
}

interface NetworkCaptureStopOptions {
  name: string;
  label: string;
  controller: () => NetworkCaptureController | null;
  unsupportedMessage?: string;
}

export class NetworkCaptureStopExecutor extends BaseBrowserToolExecutor {
  name: string;
  private readonly options: NetworkCaptureStopOptions;

  constructor(options: NetworkCaptureStopOptions) {
    super();
    this.name = options.name;
    this.options = options;
  }

  async execute(args?: { tabId?: number }): Promise<ToolResult> {
    const explicitTabId = args?.tabId;
    const controller = this.options.controller();
    const ongoingCaptures = controller?.activeCaptureTabIds() ?? [];
    let primaryTabId: number;

    if (this.options.unsupportedMessage && import.meta.env.FIREFOX) {
      return createErrorResponse(this.options.unsupportedMessage);
    }
    if (!controller) {
      return createErrorResponse(`${this.options.label} start tool instance not available`);
    }
    if (ongoingCaptures.length === 0) {
      return createErrorResponse('No active network captures found in any tab.');
    }
    if (explicitTabId != null) {
      if (!controller.hasCapture(explicitTabId)) {
        return createErrorResponse(
          `No active network capture found for tab ${explicitTabId}. Active captures: ${ongoingCaptures.join(', ')}`,
        );
      }
      primaryTabId = explicitTabId;
    } else {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTabId = activeTabs[0]?.id;
      primaryTabId = activeTabId && controller.hasCapture(activeTabId)
        ? activeTabId
        : ongoingCaptures[0];
    }

    try {
      const stopResult = await controller.stopCapture(primaryTabId);
      if (!stopResult?.success) {
        return createErrorResponse(
          stopResult?.message || `Failed to stop network capture for tab ${primaryTabId}`,
        );
      }
      for (const tabId of ongoingCaptures) {
        if (tabId === primaryTabId) continue;
        try {
          await controller.stopCapture(tabId);
        } catch (error) {
          console.error(`${this.options.label}: Error stopping capture on tab ${tabId}:`, error);
        }
      }
      const data = stopResult.data ?? {};
      if (Array.isArray(data.requests)) {
        data.requests.sort((first: any, second: any) => (
          (first.requestTime || 0) - (second.requestTime || 0)
        ));
      }
      return createJsonResponse({
        success: true,
        message: `Capture complete. ${data.requestCount || 0} requests captured.`,
        tabId: primaryTabId,
        tabUrl: data.tabUrl || 'N/A',
        tabTitle: data.tabTitle || 'Unknown Tab',
        requestCount: data.requestCount || 0,
        commonRequestHeaders: data.commonRequestHeaders || {},
        commonResponseHeaders: data.commonResponseHeaders || {},
        requests: data.requests || [],
        captureStartTime: data.captureStartTime,
        captureEndTime: data.captureEndTime,
        totalDurationMs: data.totalDurationMs,
        settingsUsed: data.settingsUsed || {},
        totalRequestsReceived: data.totalRequestsReceived || data.requestCount || 0,
        requestLimitReached: data.requestLimitReached || false,
        stoppedBy: data.stoppedBy || 'user_request',
        remainingCaptures: controller.activeCaptureTabIds(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Error in ${this.options.label}: ${message}`);
    }
  }
}
