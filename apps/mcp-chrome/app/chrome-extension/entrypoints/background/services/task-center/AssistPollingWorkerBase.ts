import { SimpleWorkerBase } from './SimpleWorkerBase';
import { IntervalController } from '@/utils/async';

export abstract class AssistPollingWorkerBase<TAssistStats extends object> extends SimpleWorkerBase {
  private readonly assistPolling = new IntervalController();
  private assistBusy = false;

  protected abstract readonly assistStats: TAssistStats;

  protected get assistPollIntervalMs(): number {
    return 30_000;
  }

  protected abstract executeAssistCycle(): Promise<void>;

  protected startAssistPolling(): void {
    if (this.assistPolling.isRunning) return;

    const tick = (): void => {
      if (!this.getStatus().isRunning || this.assistBusy) return;
      void this.runAssistCycle();
    };

    tick();
    this.assistPolling.start(tick, this.assistPollIntervalMs);
  }

  stop(): void {
    this.assistPolling.stop();
    super.stop();
  }

  getStatus() {
    const base = super.getStatus();
    return { ...base, stats: { ...base.stats, ...this.assistStats } };
  }

  private async runAssistCycle(): Promise<void> {
    if (!this.config?.apiUrl || this.assistBusy) return;

    this.assistBusy = true;
    try {
      await this.executeAssistCycle();
    } finally {
      this.assistBusy = false;
    }
  }
}
