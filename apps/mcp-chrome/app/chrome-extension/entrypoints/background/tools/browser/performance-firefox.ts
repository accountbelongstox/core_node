/**
 * Firefox reduced-mode performance collection.
 *
 * Firefox has no chrome.debugger / CDP, so the Chrome tracing path
 * (Tracing.start / Tracing.end / Performance.getMetrics) is impossible there.
 * Instead we take a single-shot, reduced-fidelity snapshot of the target tab
 * via scripting.executeScript using the standard Performance Timeline API
 * (performance.getEntriesByType): navigation timing, paint entries, resource
 * aggregates, long tasks when the browser exposes them, and JS heap only when
 * the non-standard performance.memory exists (it does not on Firefox).
 *
 * This module is only reached behind import.meta.env.FIREFOX guards; on
 * Chrome builds those branches are compile-time dead code and are tree-shaken,
 * so Chrome behavior is unchanged.
 */
import { createErrorResponse, ToolResult } from '@/common/tool-handler';

const SLOWEST_RESOURCE_LIMIT = 10;
const RESOURCE_NAME_MAX_LENGTH = 300;
const REDUCED_MODE_NOTE =
  'Reduced-fidelity summary: CDP performance tracing is unavailable on Firefox, so this data comes from the standard Performance Timeline API (performance.getEntriesByType) of the target tab instead of a trace recording.';

interface ReducedResourceInfo {
  name: string;
  initiatorType: string;
  durationMs: number;
  transferSize: number;
}

interface ReducedSnapshot {
  url: string;
  collectedAt: number;
  timeOrigin: number;
  navigation?: Record<string, number | string>;
  paint: Record<string, number>;
  resources: {
    count: number;
    totalTransferSize: number;
    totalEncodedBodySize: number;
    totalDecodedBodySize: number;
    totalDurationMs: number;
    byInitiatorType: Record<string, number>;
    slowest: ReducedResourceInfo[];
  };
  longTasks: { count: number; totalDurationMs: number; longestMs: number };
  jsHeap?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
}

/**
 * Runs INSIDE the target page (serialized by scripting.executeScript).
 * Must stay fully self-contained: no closures over module scope, values
 * arrive only through the args array.
 */
function collectSnapshotInPage(slowestLimit: number, nameMaxLength: number): any {
  const round = (v: any): number =>
    typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0;

  const snapshot: any = {
    url: String(location.href),
    collectedAt: Date.now(),
    timeOrigin: round(performance.timeOrigin),
    paint: {},
    resources: {
      count: 0,
      totalTransferSize: 0,
      totalEncodedBodySize: 0,
      totalDecodedBodySize: 0,
      totalDurationMs: 0,
      byInitiatorType: {},
      slowest: [],
    },
    longTasks: { count: 0, totalDurationMs: 0, longestMs: 0 },
  };

  // Navigation timing (PerformanceNavigationTiming)
  try {
    const nav = performance.getEntriesByType('navigation')[0] as any;
    if (nav) {
      snapshot.navigation = {
        type: String(nav.type || ''),
        redirectCount: round(nav.redirectCount),
        startTime: round(nav.startTime),
        durationMs: round(nav.duration),
        domainLookupMs: round(nav.domainLookupEnd - nav.domainLookupStart),
        connectMs: round(nav.connectEnd - nav.connectStart),
        requestStart: round(nav.requestStart),
        responseStart: round(nav.responseStart),
        responseEnd: round(nav.responseEnd),
        timeToFirstByteMs: round(nav.responseStart - nav.requestStart),
        domInteractive: round(nav.domInteractive),
        domContentLoadedEventEnd: round(nav.domContentLoadedEventEnd),
        loadEventEnd: round(nav.loadEventEnd),
        transferSize: round(nav.transferSize),
        encodedBodySize: round(nav.encodedBodySize),
        decodedBodySize: round(nav.decodedBodySize),
      };
    }
  } catch {
    // navigation timing unavailable on this document
  }

  // Paint entries (first-paint / first-contentful-paint)
  try {
    for (const p of performance.getEntriesByType('paint')) {
      snapshot.paint[p.name] = round(p.startTime);
    }
  } catch {
    // paint timing unavailable
  }

  // Resource aggregates
  try {
    const resources = performance.getEntriesByType('resource') as any[];
    snapshot.resources.count = resources.length;
    for (const res of resources) {
      snapshot.resources.totalTransferSize += round(res.transferSize);
      snapshot.resources.totalEncodedBodySize += round(res.encodedBodySize);
      snapshot.resources.totalDecodedBodySize += round(res.decodedBodySize);
      snapshot.resources.totalDurationMs += round(res.duration);
      const initiator = String(res.initiatorType || 'other');
      snapshot.resources.byInitiatorType[initiator] =
        (snapshot.resources.byInitiatorType[initiator] || 0) + 1;
    }
    snapshot.resources.totalDurationMs = round(snapshot.resources.totalDurationMs);
    snapshot.resources.slowest = resources
      .slice()
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, slowestLimit)
      .map((res) => ({
        name: String(res.name || '').slice(0, nameMaxLength),
        initiatorType: String(res.initiatorType || 'other'),
        durationMs: round(res.duration),
        transferSize: round(res.transferSize),
      }));
  } catch {
    // resource timing unavailable
  }

  // Long tasks: Chromium-only Performance Timeline entry type; absent on
  // Firefox today, kept here so the snapshot picks them up if support lands.
  try {
    const longTasks = performance.getEntriesByType('longtask' as any) as any[];
    for (const task of longTasks || []) {
      snapshot.longTasks.count += 1;
      snapshot.longTasks.totalDurationMs += round(task.duration);
      if (round(task.duration) > snapshot.longTasks.longestMs) {
        snapshot.longTasks.longestMs = round(task.duration);
      }
    }
    snapshot.longTasks.totalDurationMs = round(snapshot.longTasks.totalDurationMs);
  } catch {
    // longtask entry type not supported
  }

  // JS heap: non-standard performance.memory (Chromium-only). Firefox does
  // not expose it, so this block is skipped there — omitted gracefully.
  try {
    const memory = (performance as any).memory;
    if (memory && typeof memory.usedJSHeapSize === 'number') {
      snapshot.jsHeap = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }
  } catch {
    // memory info unavailable
  }

  return snapshot;
}

/** Flatten the snapshot into a metrics map shaped like the Chrome path's `metrics` field. */
function buildMetricsMap(snapshot: ReducedSnapshot): Record<string, number> {
  const metrics: Record<string, number> = {};
  const nav = snapshot.navigation;
  if (nav) {
    metrics.NavigationDurationMs = Number(nav.durationMs) || 0;
    metrics.TimeToFirstByteMs = Number(nav.timeToFirstByteMs) || 0;
    metrics.DomInteractiveMs = Number(nav.domInteractive) || 0;
    metrics.DomContentLoadedMs = Number(nav.domContentLoadedEventEnd) || 0;
    metrics.LoadEventEndMs = Number(nav.loadEventEnd) || 0;
    metrics.TransferSize = Number(nav.transferSize) || 0;
  }
  if (typeof snapshot.paint['first-paint'] === 'number') {
    metrics.FirstPaintMs = snapshot.paint['first-paint'];
  }
  if (typeof snapshot.paint['first-contentful-paint'] === 'number') {
    metrics.FirstContentfulPaintMs = snapshot.paint['first-contentful-paint'];
  }
  metrics.ResourceCount = snapshot.resources.count;
  metrics.ResourceTransferSize = snapshot.resources.totalTransferSize;
  metrics.ResourceTotalDurationMs = snapshot.resources.totalDurationMs;
  metrics.LongTaskCount = snapshot.longTasks.count;
  metrics.LongTaskTotalDurationMs = snapshot.longTasks.totalDurationMs;
  if (snapshot.jsHeap) {
    metrics.JSHeapUsedSize = snapshot.jsHeap.usedJSHeapSize;
    metrics.JSHeapTotalSize = snapshot.jsHeap.totalJSHeapSize;
  }
  return metrics;
}

/** Error response for CDP trace start/stop subcommands that have no Firefox equivalent. */
export function traceSubcommandUnsupportedOnFirefox(subcommand: string): ToolResult {
  return createErrorResponse(
    `${subcommand} is not supported on Firefox: CDP performance tracing (chrome.debugger) is unavailable there. Use performance_analyze_insight instead to get a reduced-fidelity Performance Timeline summary of the target tab.`,
  );
}

/**
 * Firefox replacement for the analyze tool: takes a live reduced-fidelity
 * snapshot of the target tab and returns it in a shape close to the Chrome
 * analyze result, explicitly flagged with reducedFidelity.
 */
export async function collectReducedPerformanceSummary(
  tabId?: number,
  requestedInsight?: string,
): Promise<ToolResult> {
  try {
    let targetTab: chrome.tabs.Tab | undefined;
    if (tabId) {
      try {
        targetTab = await chrome.tabs.get(tabId);
      } catch {
        targetTab = undefined;
      }
    } else {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTab = activeTab;
    }

    if (!targetTab?.id) return createErrorResponse('No active tab found');

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: collectSnapshotInPage,
      args: [SLOWEST_RESOURCE_LIMIT, RESOURCE_NAME_MAX_LENGTH],
    });

    const snapshot = injection?.result as ReducedSnapshot | undefined;
    if (!snapshot) {
      return createErrorResponse(
        'Failed to collect performance summary: no result returned from the target tab.',
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            info: 'Reduced-fidelity performance summary (Firefox)',
            reducedFidelity: true,
            note: REDUCED_MODE_NOTE,
            requestedInsight: requestedInsight || null,
            url: snapshot.url,
            collectedAt: snapshot.collectedAt,
            timeOrigin: snapshot.timeOrigin,
            metrics: buildMetricsMap(snapshot),
            navigation: snapshot.navigation || null,
            paint: snapshot.paint,
            resources: snapshot.resources,
            longTasks: snapshot.longTasks,
            ...(snapshot.jsHeap ? { jsHeap: snapshot.jsHeap } : {}),
          }),
        },
      ],
      isError: false,
    };
  } catch (e: any) {
    return createErrorResponse(
      `Failed to collect performance summary: ${e?.message || e}. The page may not allow script injection (e.g. about: or addons pages).`,
    );
  }
}
