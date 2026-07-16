/**
 * wordnew re-export of the shared Puter.js word-audio helper.
 *
 * The implementation lives in core/utils/puterAudio.ts so pycore-manager's
 * Queue Center batch bar and wordnew's library auto-batch share ONE Puter
 * loader + synth path. Wordnew-only type alias preserved for back-compat.
 */
import type { WfNewWordAccent } from '../api';
export {
  ensurePuterLoaded,
  langNameToCode,
  puterSynthesizeWord,
  blobToBase64,
} from '../../../core/utils/puterAudio';
import type { PuterSynthResult as SharedPuterSynthResult, WordAccent } from '../../../core/utils/puterAudio';

export type PuterSynthResult = SharedPuterSynthResult;
export type { WordAccent };
/** wordnew-compatible alias (us|uk|null). */
export type WfPuterAccent = WfNewWordAccent;
