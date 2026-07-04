import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import {
  collectReducedPerformanceSummary,
  traceSubcommandUnsupportedOnFirefox,
} from './performance-firefox';

type OwnerTag = 'performance';

interface StartTraceParams {
  reload?: boolean;
  autoStop?: boolean;
  durationMs?: number;
  tabId?: number;
}

interface StopTraceParams {
  saveToDownloads?: boolean;
  filenamePrefix?: string;
  tabId?: number;
}

interface AnalyzeInsightParams {
  insightName?: string;
  timeoutMs?: number;
  tabId?: number;
}

type DebuggeeEvent = (source: chrome.debugger.Debuggee, method: string, params?: any) => void;

interface TraceSessionState {
  recording: boolean;
  events: any[];
  startedAt: number;
  pageUrl?: string;
  listener: DebuggeeEvent;
  stopResolver?: (value: { completed: boolean }) => void;
  stopPromise?: Promise<{ completed: boolean }>;
}

const sessions = new Map<number, TraceSessionState>();
const LAST_RESULTS = new Map<
  number,
  {
    events: any[];
    startedAt: number;
    endedAt: number;
    tabUrl: string;
    saved?: { downloadId?: number; filename?: string; fullPath?: string };
    metrics?: Record<string, number>;
  }
>();

function tracingCategories(): string[] {
  return [
    '-*',
    'blink.console',
    'blink.user_timing',
    'devtools.timeline',
    'disabled-by-default-devtools.screenshot',
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.invalidationTracking',
    'disabled-by-default-devtools.timeline.frame',
    'disabled-by-default-devtools.timeline.stack',
    'disabled-by-default-v8.cpu_profiler',
    'disabled-by-default-v8.cpu_profiler.hires',
    'latencyInfo',
    'loading',
    'disabled-by-default-lighthouse',
    'v8.execute',
    'v8',
  ];
}

async function enablePerformanceMetrics(tabId: number): Promise<Record<string, number>> {
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Performance.enable');
    const result = (await chrome.debugger.sendCommand({ tabId }, 'Performance.getMetrics')) as {
      metrics: Array<{ name: string; value: number }>;
    };
    await chrome.debugger.sendCommand({ tabId }, 'Performance.disable');
    const map: Record<string, number> = {};
    for (const m of result.metrics || []) map[m.name] = m.value;
    return map;
  } catch (e) {
    return {};
  }
}

async function saveTraceToDownloads(
  json: string,
  filenamePrefix = 'performance_trace',
): Promise<{ downloadId?: number; filename?: string; fullPath?: string }> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${filenamePrefix}_${timestamp}.json`;
    const dataUrl = `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
    const downloadId = await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
    try {
      await new Promise((r) => setTimeout(r, 120));
      const [item] = await chrome.downloads.search({ id: downloadId });
      return { downloadId, filename, fullPath: item?.filename };
    } catch {
      return { downloadId, filename };
    }
  } catch {
    return {};
  }
}

function getOrCreateStopPromise(session: TraceSessionState): Promise<{ completed: boolean }> {
  if (session.stopPromise) return session.stopPromise;
  session.stopPromise = new Promise((resolve) => {
    session.stopResolver = resolve;
  });
  return session.stopPromise;
}

/**
 * Start performance trace
 */
class PerformanceStartTraceTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.PERFORMANCE_START_TRACE;

  async execute(args: StartTraceParams): Promise<ToolResult> {
    const { reload = false, autoStop = false, durationMs = 5000, tabId } = args || {};

    if (import.meta.env.FIREFOX) {
      return traceSubcommandUnsupportedOnFirefox(this.name);
    }

    try {
      let targetTab: chrome.tabs.Tab | undefined;
      if (tabId) {
        targetTab = await this.tryGetTab(tabId);
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTab = activeTab;
      }

      if (!targetTab?.id) {
        return createErrorResponse('No active tab found');
      }

      const finalTabId = targetTab.id;
      const existed = sessions.get(finalTabId);
      if (existed?.recording) {
        return {
          content: [{ type: 'text', text: 'Error: a performance trace is already running.' }],
          isError: false,
        };
      }

      try {
        await chrome.debugger.attach({ tabId: finalTabId }, '1.3');
      } catch (error: any) {
        if (!error?.message?.includes('Another debugger')) {
          throw error;
        }
      }

      const state: TraceSessionState = {
        recording: true,
        events: [],
        startedAt: Date.now(),
        pageUrl: targetTab.url || '',
        listener: (source, method, params) => {
          if (source.tabId !== finalTabId) return;
          if (method === 'Tracing.dataCollected' && params?.value) {
            try {
              state.events.push(...(params.value as any[]));
            } catch {
              // ignore
            }
          } else if (method === 'Tracing.tracingComplete') {
            state.recording = false;
            state.stopResolver?.({ completed: true });
          }
        },
      };
      chrome.debugger.onEvent.addListener(state.listener);
      sessions.set(finalTabId, state);

      // Start tracing with categories
      const cats = tracingCategories().join(',');
      await chrome.debugger.sendCommand({ tabId: finalTabId }, 'Tracing.start', {
        categories: cats,
        options: 'record-as-much-as-possible',
        transferMode: 'ReportEvents',
      });

      if (reload) {
        try {
          await chrome.debugger.sendCommand({ tabId: finalTabId }, 'Page.reload', {
            ignoreCache: true,
          });
        } catch {
          // best effort
        }
      }

      if (autoStop) {
        setTimeout(
          async () => {
            try {
              await chrome.debugger.sendCommand({ tabId: finalTabId }, 'Tracing.end');
            } catch {
              // ignore
            }
          },
          Math.max(1000, Math.min(durationMs, 60000)),
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Performance trace is recording. Use performance_stop_trace to stop it.',
              reload,
              autoStop,
            }),
          },
        ],
        isError: false,
      };
    } catch (e: any) {
      return createErrorResponse(`Failed to start performance trace: ${e?.message || e}`);
    }
  }
}

/**
 * Stop performance trace
 */
class PerformanceStopTraceTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.PERFORMANCE_STOP_TRACE;

  async execute(args: StopTraceParams): Promise<ToolResult> {
    const { saveToDownloads = true, filenamePrefix, tabId } = args || {};

    if (import.meta.env.FIREFOX) {
      return traceSubcommandUnsupportedOnFirefox(this.name);
    }

    try {
      let targetTab: chrome.tabs.Tab | undefined;
      if (tabId) {
        targetTab = await this.tryGetTab(tabId);
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTab = activeTab;
      }

      if (!targetTab?.id) return createErrorResponse('No active tab found');
      const finalTabId = targetTab.id;
      const session = sessions.get(finalTabId);
      if (!session) {
        return {
          content: [
            { type: 'text', text: 'No performance trace session found for the current tab.' },
          ],
          isError: false,
        };
      }

      let stopResult: { completed: boolean } = { completed: false };
      if (session.recording) {
        await chrome.debugger.sendCommand({ tabId: finalTabId }, 'Tracing.end');
        await getOrCreateStopPromise(session);
        stopResult = await session.stopPromise!;
      } else {
        stopResult = { completed: true };
      }

      const metrics = await enablePerformanceMetrics(finalTabId);

      try {
        chrome.debugger.onEvent.removeListener(session.listener);
      } catch {
        // ignore
      }
      try {
        await chrome.debugger.detach({ tabId: finalTabId });
      } catch {
        // ignore
      }

      const endedAt = Date.now();
      const trace = { traceEvents: session.events };
      const json = JSON.stringify(trace);

      let saved: { downloadId?: number; filename?: string; fullPath?: string } | undefined;
      if (saveToDownloads) {
        saved = await saveTraceToDownloads(json, filenamePrefix || 'performance_trace');
      }

      LAST_RESULTS.set(finalTabId, {
        events: session.events,
        startedAt: session.startedAt,
        endedAt,
        tabUrl: session.pageUrl || '',
        saved,
        metrics,
      });

      sessions.delete(finalTabId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'The performance trace has been stopped.',
              eventCount: session.events.length,
              saved,
              metrics,
              startedAt: session.startedAt,
              endedAt,
              durationMs: endedAt - session.startedAt,
              url: session.pageUrl || '',
              tracingCompleted: stopResult?.completed === true,
            }),
          },
        ],
        isError: false,
      };
    } catch (e: any) {
      return createErrorResponse(`Failed to stop performance trace: ${e?.message || e}`);
    }
  }
}

/**
 * Analyze last trace (lightweight)
 */
class PerformanceAnalyzeInsightTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.PERFORMANCE_ANALYZE_INSIGHT;

  async execute(args: AnalyzeInsightParams & { timeoutMs?: number }): Promise<ToolResult> {
    const { insightName, tabId } = args || {};

    if (import.meta.env.FIREFOX) {
      // Reduced mode: live Performance Timeline snapshot instead of CDP trace analysis.
      return collectReducedPerformanceSummary(tabId, insightName);
    }

    try {
      let targetTab: chrome.tabs.Tab | undefined;
      if (tabId) {
        targetTab = await this.tryGetTab(tabId);
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTab = activeTab;
      }

      if (!targetTab?.id) return createErrorResponse('No active tab found');
      const finalTabId = targetTab.id;
      const result = LAST_RESULTS.get(finalTabId);
      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: 'No recorded traces found. Start and stop a performance trace first.',
            },
          ],
          isError: false,
        };
      }

      // Lightweight analysis
      const counts = new Map<string, number>();
      for (const ev of result.events.slice(0, 100000)) {
        const n = typeof (ev as any)?.name === 'string' ? (ev as any).name : 'unknown';
        counts.set(n, (counts.get(n) || 0) + 1);
      }
      const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({ name, count }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              info: 'Lightweight analysis',
              requestedInsight: insightName || null,
              url: result.tabUrl,
              startedAt: result.startedAt,
              endedAt: result.endedAt,
              durationMs: result.endedAt - result.startedAt,
              metrics: result.metrics || {},
              topEventNames: top,
              saved: result.saved,
            }),
          },
        ],
        isError: false,
      };
    } catch (e: any) {
      return createErrorResponse(`Failed to analyze trace: ${e?.message || e}`);
    }
  }
}

export const performanceStartTraceTool = new PerformanceStartTraceTool();
export const performanceStopTraceTool = new PerformanceStopTraceTool();
export const performanceAnalyzeInsightTool = new PerformanceAnalyzeInsightTool();
