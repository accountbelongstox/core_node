import { AUDIO_ORCH_TRANSFER } from '../../../core/contracts/AudioOrchestrationContract';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../core/integrations/laravel/LaravelRealtime';
import { orchClipIdentity } from '../../../shared/orchestration/orchClipIdentity';
import type { OrchResourceKind } from '../../../core/integrations/pycore';

/** Receives the ready resource ids, or null when the stream (re)connected and everything must be re-checked. */
type ClipReadyHandler = (ids: ReadonlySet<string> | null) => void;

/**
 * The `clip.ready` push (contract realtime.clip_ready): Laravel announces the resource ids of clips
 * whose audio just landed, so waiters re-check at once instead of polling. While the stream is down
 * the waiters keep their own poll interval; they only relax to a long safety re-check once the live
 * stream session has delivered a `clip.ready` (a server that never emits it keeps the old polling).
 */
class WordNewClipReadyClass {
  private readonly handlers = new Set<ClipReadyHandler>();
  private teardown: (() => void) | null = null;
  /** This stream session delivered a `clip.ready`: the server emits them, so polling may relax. */
  private pushSeen = false;

  idOf(kind: OrchResourceKind, language: string, text: string): string {
    return orchClipIdentity(kind, language, text).resourceId;
  }

  /** The stream is live and this session has already delivered a `clip.ready`. */
  isPushLive(): boolean {
    if (!laravelRealtime.isConnected()) this.pushSeen = false;
    return this.pushSeen;
  }

  /** Delay before a waiter's next timed check: its own interval unless the push is proven live. */
  pollDelayMs(pollMs: number): number {
    return this.isPushLive() ? Math.max(pollMs, AUDIO_ORCH_TRANSFER.readyPushSafetyMs) : pollMs;
  }

  subscribe(handler: ClipReadyHandler): () => void {
    this.handlers.add(handler);
    this.attach();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.detach();
    };
  }

  private attach(): void {
    if (this.teardown) return;
    const unsubscribeReady = laravelRealtime.subscribe(
      LARAVEL_REALTIME_EVENTS.clipReady,
      (event) => {
        this.pushSeen = true;
        this.dispatch(new Set(Array.isArray(event?.ids) ? event.ids : []));
      },
    );
    const unsubscribeConnected = laravelRealtime.onConnected(() => {
      this.pushSeen = false;
      this.dispatch(null);
    });
    laravelRealtime.start();
    this.teardown = () => {
      unsubscribeReady();
      unsubscribeConnected();
      laravelRealtime.stop();
    };
  }

  private detach(): void {
    this.teardown?.();
    this.teardown = null;
    this.pushSeen = false;
  }

  private dispatch(ids: ReadonlySet<string> | null): void {
    for (const handler of [...this.handlers]) handler(ids);
  }
}

export const wordNewClipReady = new WordNewClipReadyClass();
