export interface WaitForTabCompleteOptions {
  timeoutMs: number;
  settleDelayMs?: number;
  statusProbeDelayMs?: number;
  rejectOnTabClose?: boolean;
}

export function waitForTabComplete(
  tabId: number,
  config: WaitForTabCompleteOptions | number = 30_000,
): Promise<void> {
  const options: WaitForTabCompleteOptions = typeof config === 'number'
    ? { timeoutMs: config, rejectOnTabClose: true }
    : config;
  const settleDelayMs = options.settleDelayMs ?? 0;
  const statusProbeDelayMs = options.statusProbeDelayMs ?? 0;

  return new Promise((resolve, reject) => {
    let settled = false;
    let probeTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      try {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
      } catch {
        // Listener cleanup is best-effort during browser shutdown.
      }
      clearTimeout(timeout);
      if (probeTimer) clearTimeout(probeTimer);
      if (error) {
        reject(error);
        return;
      }
      if (settleDelayMs > 0) {
        setTimeout(resolve, settleDelayMs);
      } else {
        resolve();
      }
    };
    const onUpdated = (updatedTabId: number, info: chrome.tabs.TabChangeInfo): void => {
      if (updatedTabId === tabId && info.status === 'complete') {
        finish();
      }
    };
    const onRemoved = (removedTabId: number): void => {
      if (removedTabId === tabId && options.rejectOnTabClose) {
        finish(new Error(`Tab ${tabId} was closed while loading`));
      }
    };
    const probeStatus = (): void => {
      chrome.tabs.get(tabId).then(
        (tab) => {
          if (tab.status === 'complete') finish();
        },
        () => {
          if (options.rejectOnTabClose) {
            finish(new Error(`Tab ${tabId} was closed while loading`));
          } else {
            finish();
          }
        },
      );
    };
    const timeout = setTimeout(finish, options.timeoutMs);

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    if (statusProbeDelayMs > 0) {
      probeTimer = setTimeout(probeStatus, statusProbeDelayMs);
    } else {
      probeStatus();
    }
  });
}
