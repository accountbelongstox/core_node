import {
  createErrorResponse,
  createJsonResponse,
  createTextResponse,
  ToolResult,
} from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { delay as waitForDelay, withTimeoutFallback } from '@/utils/async';
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
  autoStopTimer?: ReturnType<typeof setTimeout>;
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
      await waitForDelay(120);
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

const STOP_TRACE_TIMEOUT_MS = 15000;

/**
 * Race session.stopPromise (resolved by the Tracing.tracingComplete CDP event)
 * against a timeout so stop_trace cannot hang forever if the event never
 * arrives (tab crash, navigation to a chrome:// page, stalled buffer flush).
 */
function raceStopPromiseWithTimeout(
  session: TraceSessionState,
): Promise<{ completed: boolean; timedOut?: boolean }> {
  return withTimeoutFallback(
    session.stopPromise!,
    STOP_TRACE_TIMEOUT_MS,
    () => ({ completed: false, timedOut: true }),
  );
}

/**
 * Release every resource a trace session holds: the autoStop timer, the
 * onEvent listener, the session map entry, and the debugger attachment. Used
 * on both the success and error paths of start/stop so a throwing CDP command
 * can never leak the listener, session, or debugger (which would otherwise
 * hang a later stop_trace or block all future starts).
 */
async function teardownSession(tabId: number, state: TraceSessionState): Promise<void> {
  if (state.autoStopTimer) {
    clearTimeout(state.autoStopTimer);
    state.autoStopTimer = undefined;
  }
  try {
    chrome.debugger.onEvent.removeListener(state.listener);
  } catch {
    // ignore
  }
  sessions.delete(tabId);
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // ignore
  }
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
      let targetTab: chrome.tabs.Tab | null | undefined;
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
        return createErrorResponse('a performance trace is already running');
      }
      // A prior auto-stopped trace that was never explicitly stopped leaves a
      // stale session (recording=false) with its onEvent listener still
      // registered and its debugger still attached. Tear it down before
      // creating a new session so the old listener does not leak.
      if (existed) {
        await teardownSession(finalTabId, existed);
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

      // Start tracing with categories. If Tracing.start (or any subsequent
      // setup) throws, tear down the session we just registered so the
      // listener, session map entry, autoStop timer, and debugger attachment
      // do not leak - a leak here would hang a later stop_trace on stopPromise
      // (tracingComplete never fires) and block all future starts.
      try {
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
          state.autoStopTimer = setTimeout(
            async () => {
              // Only end if this exact session is still the active recording
              // session for the tab; an orphaned timer from a prior (manually
              // stopped) trace must never end a newer trace on the same tab.
              const current = sessions.get(finalTabId);
              if (current !== state || !current.recording) return;
              try {
                await chrome.debugger.sendCommand({ tabId: finalTabId }, 'Tracing.end');
              } catch {
                // ignore
              }
            },
            Math.max(1000, Math.min(durationMs, 60000)),
          );
        }
      } catch (startError) {
        await teardownSession(finalTabId, state);
        throw startError;
      }

      return createJsonResponse({
        success: true,
        message: 'Performance trace is recording. Use performance_stop_trace to stop it.',
        reload,
        autoStop,
      });
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
      let targetTab: chrome.tabs.Tab | null | undefined;
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
        return createTextResponse('No performance trace session found for the current tab.');
      }

      let stopResult: { completed: boolean; timedOut?: boolean } = { completed: false };
      let metrics: Record<string, number> = {};
      try {
        if (session.recording) {
          await chrome.debugger.sendCommand({ tabId: finalTabId }, 'Tracing.end');
          // Race the tracingComplete event against a timeout so stop_trace
          // cannot block forever if the event is never delivered. Do NOT
          // await the bare promise first — that would hang indefinitely when
          // the event never arrives and prevent the timeout from firing.
          getOrCreateStopPromise(session);
          stopResult = await raceStopPromiseWithTimeout(session);
        } else {
          stopResult = { completed: true };
        }

        metrics = await enablePerformanceMetrics(finalTabId);
      } finally {
        // Always release the listener, session, autoStop timer, and debugger
        // attachment - even if Tracing.end or the metrics call threw - so a
        // failure cannot leak resources or block a later start/stop.
        await teardownSession(finalTabId, session);
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

      return createJsonResponse({
        success: true,
        message: stopResult?.timedOut
          ? 'The performance trace was stopped after the tracingComplete event timed out; the trace may be incomplete.'
          : 'The performance trace has been stopped.',
        eventCount: session.events.length,
        saved,
        metrics,
        startedAt: session.startedAt,
        endedAt,
        durationMs: endedAt - session.startedAt,
        url: session.pageUrl || '',
        tracingCompleted: stopResult?.completed === true,
        timedOut: stopResult?.timedOut === true,
      });
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
      let targetTab: chrome.tabs.Tab | null | undefined;
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
        return createTextResponse(
          'No recorded traces found. Start and stop a performance trace first.',
        );
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

      return createJsonResponse({
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
      });
    } catch (e: any) {
      return createErrorResponse(`Failed to analyze trace: ${e?.message || e}`);
    }
  }
}

export const performanceStartTraceTool = new PerformanceStartTraceTool();
export const performanceStopTraceTool = new PerformanceStopTraceTool();
export const performanceAnalyzeInsightTool = new PerformanceAnalyzeInsightTool();
