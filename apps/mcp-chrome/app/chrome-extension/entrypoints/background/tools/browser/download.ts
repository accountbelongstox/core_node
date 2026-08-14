import { createErrorResponse, createJsonResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

interface HandleDownloadParams {
  filenameContains?: string;
  timeoutMs?: number; // default 60000
  waitForComplete?: boolean; // default true
}

/**
 * Tool: wait for a download and return info
 */
class HandleDownloadTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.HANDLE_DOWNLOAD;

  async execute(args: HandleDownloadParams): Promise<ToolResult> {
    const filenameContains = String(args?.filenameContains || '').trim();
    const waitForComplete = args?.waitForComplete !== false;
    const timeoutMs = Math.max(1000, Math.min(Number(args?.timeoutMs ?? 60000), 300000));

    try {
      const result = await waitForDownload({ filenameContains, waitForComplete, timeoutMs });
      return createJsonResponse({ success: true, download: result });
    } catch (e: any) {
      return createErrorResponse(`Handle download failed: ${e?.message || String(e)}`);
    }
  }
}

async function waitForDownload(opts: {
  filenameContains?: string;
  waitForComplete: boolean;
  timeoutMs: number;
}) {
  const { filenameContains, waitForComplete, timeoutMs } = opts;
  return new Promise<any>((resolve, reject) => {
    let timer: any = null;
    const onError = (err: any) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    const cleanup = () => {
      try {
        if (timer) clearTimeout(timer);
      } catch {}
      try {
        chrome.downloads.onCreated.removeListener(onCreated);
      } catch {}
      try {
        chrome.downloads.onChanged.removeListener(onChanged);
      } catch {}
    };
    const matches = (item: chrome.downloads.DownloadItem) => {
      if (!filenameContains) return true;
      const name = (item.filename || '').split(/[/\\]/).pop() || '';
      return name.includes(filenameContains) || (item.url || '').includes(filenameContains);
    };
    const fulfill = async (item: chrome.downloads.DownloadItem) => {
      // try to fill more details via downloads.search
      try {
        const [found] = await chrome.downloads.search({ id: item.id });
        const out = found || item;
        cleanup();
        resolve({
          id: out.id,
          filename: out.filename,
          url: out.url,
          mime: (out as any).mime || undefined,
          fileSize: out.fileSize ?? out.totalBytes ?? undefined,
          state: out.state,
          danger: out.danger,
          startTime: out.startTime,
          endTime: (out as any).endTime || undefined,
          exists: (out as any).exists,
        });
        return;
      } catch {
        cleanup();
        resolve({ id: item.id, filename: item.filename, url: item.url, state: item.state });
      }
    };
    const onCreated = (item: chrome.downloads.DownloadItem) => {
      try {
        if (!matches(item)) return;
        if (!waitForComplete) {
          fulfill(item);
        }
      } catch {}
    };
    const onChanged = (delta: chrome.downloads.DownloadDelta) => {
      try {
        if (!delta || typeof delta.id !== 'number') return;
        // pull item and check
        chrome.downloads
          .search({ id: delta.id })
          .then((arr) => {
            const item = arr && arr[0];
            if (!item) return;
            if (!matches(item)) return;
            if (waitForComplete && item.state === 'complete') {
              fulfill(item);
            } else if (item.state === 'interrupted') {
              // Server drop / user cancel / network error: fail immediately
              // instead of leaving the promise pending until the timeout.
              onError(
                new Error(
                  `Download interrupted${
                    (item as any).error ? `: ${(item as any).error}` : ''
                  }`,
                ),
              );
            }
          })
          .catch(() => {});
      } catch {}
    };
    chrome.downloads.onCreated.addListener(onCreated);
    chrome.downloads.onChanged.addListener(onChanged);
    timer = setTimeout(() => onError(new Error('Download wait timed out')), timeoutMs);
    // Try to find an already-running or recently-completed matching download.
    // Search without a state filter so completed downloads are also found;
    // otherwise a download that finished before the listeners were registered
    // would never surface and the tool would time out. Scope to downloads
    // started within the timeout window (with a generous buffer) so stale
    // historical matches are not returned.
    const startedAfter = new Date(Date.now() - timeoutMs * 2).toISOString();
    chrome.downloads
      .search({ startedAfter, orderBy: ['-startTime'] })
      .then((arr) => {
        const hit = (arr || []).find((d) => matches(d));
        if (!hit) return;
        if (!waitForComplete) {
          fulfill(hit);
        } else if (hit.state === 'complete') {
          fulfill(hit);
        } else if (hit.state === 'interrupted') {
          onError(
            new Error(
              `Download interrupted${
                (hit as any).error ? `: ${(hit as any).error}` : ''
              }`,
            ),
          );
        }
        // in_progress + waitForComplete: let onChanged handle completion
      })
      .catch(() => {});
  });
}

export const handleDownloadTool = new HandleDownloadTool();
