import fs from 'fs';

const BUILD_POLL_MS = 1000;
const BUILD_SETTLE_MS = 2000;

function readModifiedMs(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

// Calls onRebuilt once the running entry file has been replaced and stayed
// unchanged for BUILD_SETTLE_MS, so the host restarts only on a finished build.
export function watchOwnBuild(entryFile: string, onRebuilt: () => void): void {
  const loadedModifiedMs = readModifiedMs(entryFile);
  let candidateModifiedMs: number | null = null;
  let candidateSince = 0;

  const timer = setInterval(() => {
    const currentModifiedMs = readModifiedMs(entryFile);
    if (currentModifiedMs === null || currentModifiedMs === loadedModifiedMs) {
      candidateModifiedMs = null;
      return;
    }
    if (currentModifiedMs !== candidateModifiedMs) {
      candidateModifiedMs = currentModifiedMs;
      candidateSince = Date.now();
      return;
    }
    if (Date.now() - candidateSince >= BUILD_SETTLE_MS) {
      clearInterval(timer);
      onRebuilt();
    }
  }, BUILD_POLL_MS);
  timer.unref();
}
