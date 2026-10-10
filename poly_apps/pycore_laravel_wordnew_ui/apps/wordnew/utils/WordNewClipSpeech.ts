import { awaitPlayableClip, type WordNewClipRef } from '../runtime-store/WfNewAudioCache';
import { CLIP_RESOLVE_WAIT_MS } from '../constants/uiTiming';
import { cancelSpeech, speakText, type SpeakTextOptions } from './WordNewSpeech';

export interface ClipSpeechOptions extends SpeakTextOptions {
  /** The clip this utterance is: played from the device store / transfers / payload file when any has it. */
  clip: WordNewClipRef;
  /** The file the payload named for the clip, if any. */
  url?: string | null;
  /** Called when no clip exists and browser speech takes over (the caller asks the queue to generate it). */
  onMissing?: () => void;
}

export interface ClipSpeechHandle {
  cancel: () => void;
}

/**
 * Play a clip once, device store first (WfNewAudioCache.awaitPlayableClip: the device store, the schedule's
 * transfers, then the payload file); `fallback` runs when nothing has the clip or it does not play.
 */
export function playClipOr(clip: WordNewClipRef, url: string | null | undefined, fallback: () => void): void {
  let fellBack = false;
  const fall = (): void => {
    if (fellBack) return;
    fellBack = true;
    fallback();
  };
  void awaitPlayableClip(clip, url, CLIP_RESOLVE_WAIT_MS)
    .then((src) => {
      if (!src) {
        fall();
        return;
      }
      void new Audio(src).play().catch(fall);
    })
    .catch(fall);
}

/**
 * One utterance, clip-first: the clip by identity (WfNewAudioCache.awaitPlayableClip), then browser speech of the
 * same text as the last tier. Rate, start / end / error callbacks behave the same on both tiers.
 */
export function playClipOrSpeak(text: string, options: ClipSpeechOptions): ClipSpeechHandle {
  let cancelled = false;
  let spoken = false;
  let audio: HTMLAudioElement | null = null;
  const speak = (): void => {
    if (cancelled || spoken) return;
    spoken = true;
    options.onMissing?.();
    if (!speakText(text, options)) options.onError?.();
  };
  void awaitPlayableClip(options.clip, options.url, CLIP_RESOLVE_WAIT_MS)
    .then((src) => {
      if (cancelled) return;
      if (!src) {
        speak();
        return;
      }
      const element = new Audio(src);
      audio = element;
      if (options.rate !== undefined) element.playbackRate = options.rate;
      element.onplay = () => options.onStart?.();
      element.onended = () => options.onEnd?.();
      element.onerror = speak;
      element.play().catch(speak);
    })
    .catch(speak);
  return {
    cancel: () => {
      cancelled = true;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      }
      cancelSpeech();
    },
  };
}
