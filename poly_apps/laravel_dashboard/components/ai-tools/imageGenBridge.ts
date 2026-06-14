/**
 * imageGenBridge — tiny module-level handoff so the Image History tool can push
 * a prompt into the Image Gen tool when the user clicks "reuse prompt", even
 * though the two live on separate left-nav tools (state is unmounted between
 * switches). Framework-free pub/sub, mirroring core/logs/logStore.
 */

let pendingPrompt: string | null = null;
const listeners = new Set<(prompt: string) => void>();

/** Queue a prompt for the Image Gen tool and notify any mounted listener. */
export function reusePrompt(prompt: string): void {
  pendingPrompt = prompt;
  listeners.forEach((l) => l(prompt));
}

/** Consume (and clear) a queued prompt, e.g. when the Image Gen tool mounts. */
export function takePendingPrompt(): string | null {
  const p = pendingPrompt;
  pendingPrompt = null;
  return p;
}

/** Subscribe to live "reuse prompt" pushes. Returns an unsubscribe fn. */
export function subscribeReusePrompt(listener: (prompt: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
