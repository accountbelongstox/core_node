/** One pronunciation source exposed by the Laravel and Pycore backends. */
export interface WordAudioSource {
  key: string;
  label: string;
  available: boolean;
  requires_key: boolean;
  note: string;
}

/** Shared pronunciation-source capability status. */
export interface WordAudioStatus {
  backend: string;
  sources: WordAudioSource[];
  forvo_key_present: boolean;
  streamelements_key_present?: boolean;
  tts_fallback: boolean;
}
