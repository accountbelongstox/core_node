import type { Task, WorkerCapability, ProcessorType } from '../../api/WorkerApiClient';
import { AssistPollingWorkerBase } from './AssistPollingWorkerBase';

export abstract class AssistOnlyWorkerBase<TAssistStats extends object>
  extends AssistPollingWorkerBase<TAssistStats> {
  protected get globalTaskPollingEnabled(): boolean {
    return false;
  }

  protected get capabilities(): WorkerCapability[] {
    return [];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [];
  }

  protected get pullTaskTypes(): string[] {
    return [];
  }

  protected handlesTaskType(_taskType: string): boolean {
    return false;
  }

  protected async executeTask(_task: Task): Promise<void> {
    throw new Error('Assist-only workers do not execute global tasks');
  }
}
