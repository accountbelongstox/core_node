import { readQueueProgress, type QueueProgress } from '../../../../core/contracts/QueueProgress';
import { WfNewApiPaths } from '../WfNewApiPaths';
import { getFreshJSON } from '../WfNewApiTransport';

/** Contract progress_template of one language's sentence audio gap (one row page of 1 keeps the answer small). */
export async function readSentenceAudioGap(language: string): Promise<QueueProgress | null> {
  const data = await getFreshJSON<{ progress?: unknown } | null>(WfNewApiPaths.sentenceWithoutAudio(language));
  return readQueueProgress(data?.progress);
}
