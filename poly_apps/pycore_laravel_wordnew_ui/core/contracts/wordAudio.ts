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
  /** False: this API only looks up existing recordings. */
  tts_fallback: boolean;
  tts_engines?: string[];
  batch_engine: string;
  batch_profile: string;
  batch_device: string;
  batch_size: number;
}
