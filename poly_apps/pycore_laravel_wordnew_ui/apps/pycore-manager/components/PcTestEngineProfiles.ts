/**
 * Per-engine test popup profiles — hints, wait expectations, accent overrides,
 * AND per-engine form field definitions for the dynamic form renderer.
 *
 * Kind-level chrome lives in PcTestPopup; this file differentiates each target
 * by declaring what form fields it needs, what options they have, and what the
 * engine's status display should include (quota, server state, model loaded, etc.).
 *
 * Engine hints must reflect each engine's class (qwen3tts is a class-C isolated-venv
 * HTTP server, not an in-process model). Copy only — no lifecycle rules restated here.
 * Ref: apps/pycore-manager/docs/TTS_STT_ENGINE_LIFECYCLE.md §2/§3 and
 * development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.
 */
import type { PcTestKind } from './PcTestPopup';

// ---- shared form field type -----------------------------------------------

export interface PcTestFormField {
  /** Parameter key sent to the HTTP controller. */
  key: string;
  /** UI label (i18n key or literal). */
  label: string;
  /** Form control type. */
  type: 'text' | 'textarea' | 'select' | 'number';
  defaultValue?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Rows for textarea. */
  rows?: number;
  hint?: string;
  /** When true, this field is not required for the test to run. */
  optional?: boolean;
  /** Min/max/step for number inputs. */
  min?: number;
  max?: number;
  step?: number;
}

// ---- shared language options -----------------------------------------------

const LANG_OPTS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
];

const STT_LANG_OPTS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

// ---- per-engine form field definitions ------------------------------------

const TTS_FORM_FIELDS: Record<string, PcTestFormField[]> = {
  // -- inline / cloud engines --
  edge: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'rate', label: 'Rate', type: 'text', placeholder: '-20%', hint: 'e.g. -20% or +10% (SSML prosody rate)', optional: true },
    { key: 'gender', label: 'Gender', type: 'select', options: [{ value: '', label: 'Default' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }], optional: true },
  ],
  streamelements: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'This is a test of the StreamElements text to speech engine.' },
    { key: 'language', label: 'Language', type: 'select', options: [{ value: 'en', label: 'English' }], defaultValue: 'en' },
    { key: 'accent', label: 'Accent', type: 'select', options: [{ value: 'us', label: 'US (Joanna)' }, { value: 'uk', label: 'UK (Amy)' }], defaultValue: 'us' },
  ],
  gtts_web: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 2, defaultValue: 'Hello, this is a Google Translate TTS test.', hint: 'Max ~200 characters' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
  ],
  azure: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'This is an Azure Speech synthesis test.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'rate', label: 'Rate', type: 'text', placeholder: '1.0', hint: 'SSML prosody rate', optional: true },
  ],

  // -- managed model engines --
  sherpa: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'speed', label: 'Speed', type: 'number', defaultValue: '1.0', min: 0.5, max: 2.0, step: 0.1, optional: true },
  ],
  kokoro: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'speed', label: 'Speed', type: 'number', defaultValue: '1.0', min: 0.5, max: 2.0, step: 0.1, optional: true },
  ],

  // -- engines with unique per-engine params --
  qwen3tts: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'Hello, this is a test of the Qwen text to speech engine.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'speaker', label: 'Speaker', type: 'text', placeholder: 'Ryan', hint: 'Ryan (en) / Vivian (zh) / Ono_Anna (ja) / Sohee (ko)', optional: true },
    { key: 'instruct', label: 'Voice Instruction', type: 'text', placeholder: 'cheerful and energetic', hint: 'Style / emotion for the voice (env QWEN3TTS_INSTRUCT)', optional: true },
  ],
  bark: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'Hello, this is a Bark text to speech test.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en', hint: 'Bark ignores language — shown for reference' },
  ],
  parler: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'This is a Parler TTS test with a natural voice description.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en', hint: 'Parler ignores language' },
    { key: 'description', label: 'Voice Description', type: 'text', placeholder: 'A clear, close recording with a neutral tone at moderate speed.', hint: 'Natural-language voice description (env PARLER_DESCRIPTION)', optional: true },
  ],
  voxcpm2: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'This is a VoxCPM2 synthesis test.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en', hint: 'VoxCPM2 ignores language' },
    { key: 'cfg_value', label: 'CFG Strength', type: 'number', defaultValue: '2.0', min: 1.0, max: 10.0, step: 0.5, hint: 'Classifier-free guidance (higher = more controlled)', optional: true },
    { key: 'timesteps', label: 'Timesteps', type: 'number', defaultValue: '10', min: 1, max: 50, step: 1, hint: 'Inference steps (fewer = faster, more = quality)', optional: true },
  ],

  // -- managed server engines --
  melotts: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'This is a MeloTTS synthesis test.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'speed', label: 'Speed', type: 'number', defaultValue: '1.0', min: 0.5, max: 2.0, step: 0.1, optional: true },
  ],
  chattts: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'Hello, this is a ChatTTS dialogue test [oral_2][laugh_0].' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'speed', label: 'Speed', type: 'number', defaultValue: '1.0', min: 0.5, max: 2.0, step: 0.1, optional: true },
    { key: 'voice', label: 'Voice', type: 'text', placeholder: 'alloy', hint: 'OpenAI-compatible voice name', optional: true },
  ],
  cosyvoice: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: '你好，这是一个CosyVoice语音合成测试。' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'zh' },
    { key: 'speed', label: 'Speed', type: 'number', defaultValue: '1.0', min: 0.5, max: 2.0, step: 0.1, optional: true },
    { key: 'speaker_id', label: 'Speaker ID', type: 'text', placeholder: '中文女', hint: 'For sft/instruct mode (env COSYVOICE_SPK_ID)', optional: true },
    { key: 'instruct', label: 'Instruction', type: 'text', placeholder: '用温柔的语气说话', hint: 'For instruct/instruct2 mode (env COSYVOICE_INSTRUCT)', optional: true },
  ],
  gptsovits: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: '这是一个GPT-SoVITS语音克隆测试。' },
    { key: 'language', label: 'Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }, { value: 'ko', label: '한국어' }, { value: 'yue', label: '粤语' }], defaultValue: 'zh' },
    { key: 'speed', label: 'Speed', type: 'number', defaultValue: '1.0', min: 0.5, max: 2.0, step: 0.1, optional: true },
    { key: 'prompt_text', label: 'Prompt Text', type: 'text', placeholder: '参考音频的文本内容', hint: 'Transcript of reference clip (env GPTSOVITS_PROMPT_TEXT)', optional: true },
    { key: 'prompt_lang', label: 'Prompt Language', type: 'select', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }, { value: 'ko', label: '한국어' }], defaultValue: 'zh', optional: true },
  ],
  f5tts: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'This is an F5-TTS flow matching synthesis test.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
    { key: 'speed', label: 'Speed', type: 'number', defaultValue: '1.0', min: 0.5, max: 2.0, step: 0.1, hint: 'F5-TTS ignores speed', optional: true },
  ],
  fishspeech: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'This is a Fish Speech synthesis test.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en', hint: 'Fish Speech ignores language/speed' },
  ],
};

const STT_FORM_FIELDS: Record<string, PcTestFormField[]> = {
  'faster-whisper': [
    { key: 'text', label: 'Phrase', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.', hint: 'Synthesized (TTS) then recognized — round-trip' },
    { key: 'language', label: 'Language', type: 'select', options: STT_LANG_OPTS, defaultValue: 'en' },
    { key: 'model', label: 'Model', type: 'select', options: [{ value: 'large-v3', label: 'large-v3' }, { value: 'medium', label: 'medium' }, { value: 'small', label: 'small' }, { value: 'tiny', label: 'tiny' }], defaultValue: 'large-v3', optional: true },
  ],
  whisper: [
    { key: 'text', label: 'Phrase', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.', hint: 'Synthesized (TTS) then recognized — round-trip' },
    { key: 'language', label: 'Language', type: 'select', options: STT_LANG_OPTS, defaultValue: 'en' },
    { key: 'model', label: 'Model', type: 'select', options: [{ value: 'large-v3', label: 'large-v3' }, { value: 'medium', label: 'medium' }, { value: 'small', label: 'small' }, { value: 'tiny', label: 'tiny' }], defaultValue: 'large-v3', optional: true },
  ],
  vosk: [
    { key: 'text', label: 'Phrase', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.', hint: 'Synthesized (TTS) as WAV then recognized — round-trip' },
    { key: 'language', label: 'Language', type: 'select', options: STT_LANG_OPTS, defaultValue: 'en' },
  ],
  azure: [
    { key: 'text', label: 'Phrase', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.', hint: 'Synthesized as WAV then recognized by Azure Speech' },
    { key: 'language', label: 'Language', type: 'select', options: STT_LANG_OPTS, defaultValue: 'en' },
  ],
};

const OCR_FORM_FIELDS: Record<string, PcTestFormField[]> = {
  windows_ocr: [
    { key: 'ocrText', label: 'Sample Text', type: 'textarea', rows: 3, defaultValue: 'Hello OCR 123\n你好世界', hint: 'Rendered to image for OCR recognition' },
    { key: 'lang', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
  ],
  easyocr: [
    { key: 'ocrText', label: 'Sample Text', type: 'textarea', rows: 3, defaultValue: 'Hello OCR 123\n你好世界', hint: 'Rendered to image for OCR recognition' },
    { key: 'lang', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en', hint: 'Default uses ch_sim+en regardless' },
  ],
  cnocr: [
    { key: 'ocrText', label: 'Sample Text', type: 'textarea', rows: 3, defaultValue: 'Hello OCR 123\n你好世界', hint: 'Rendered to image for OCR recognition' },
    { key: 'lang', label: 'Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'zh', label: '中文 (general)' }, { value: 'cht', label: '繁體中文' }, { value: 'ja', label: '日本語' }, { value: 'ko', label: '한국어' }], defaultValue: 'zh' },
    { key: 'model_type', label: 'Model Type', type: 'select', options: [
      { value: 'general', label: 'General (densenet_lite_136-gru)' },
      { value: 'scene', label: 'Scene' },
      { value: 'doc', label: 'Document' },
      { value: 'number', label: 'Number' },
      { value: 'english', label: 'English (PP-OCRv3)' },
      { value: 'chinese_traditional', label: 'Traditional Chinese (PP-OCRv3)' },
    ], defaultValue: 'general', hint: 'Detection + recognition model pair', optional: true },
  ],
};

const AI_FORM_FIELDS: Record<string, PcTestFormField[]> = {
  auto: [
    { key: 'message', label: 'Prompt', type: 'textarea', rows: 4, defaultValue: 'Reply with one short sentence introducing yourself.' },
    { key: 'model', label: 'Model', type: 'text', placeholder: 'default', optional: true },
  ],
  // Per-provider fields default to the same; specific providers can override.
};

const AI_DEFAULT_FORM_FIELDS: PcTestFormField[] = [
  { key: 'message', label: 'Prompt', type: 'textarea', rows: 4, defaultValue: 'Reply with one short sentence introducing yourself.' },
  { key: 'model', label: 'Model', type: 'text', placeholder: 'default', optional: true },
];

// ---- profile interface ----------------------------------------------------

export interface PcTestEngineProfile {
  hint: string;
  /** Show extended "model may load for minutes" copy while running. */
  longWait?: boolean;
  /** Optional accent tailwind tokens overriding the kind default. */
  accent?: string;
  accentBg?: string;
  border?: string;
  headerGrad?: string;
  btn?: string;
  ring?: string;
  /** Per-engine form field definitions for the dynamic form renderer. */
  form?: PcTestFormField[];
  /** Quota / status badges shown in the popup header. */
  quotaLabel?: string;
  quotaBlocked?: boolean;
}

// ---- per-engine profiles (hints + themes + form) --------------------------

const TTS_PROFILES: Record<string, PcTestEngineProfile> = {
  qwen3tts: {
    hint: 'Qwen3-TTS isolated venv HTTP server. First start builds the venv and loads the model (can take minutes) before audio returns.',
    longWait: true,
    accent: 'text-orange-500',
    accentBg: 'bg-orange-500/10',
    border: 'border-orange-500/25',
    headerGrad: 'from-orange-500/12 via-amber-500/6 to-transparent',
    btn: 'bg-orange-500 hover:bg-orange-600',
    ring: 'focus:ring-orange-500/30 focus:border-orange-400/50',
    form: TTS_FORM_FIELDS.qwen3tts,
  },
  bark: {
    hint: 'Bark (suno/bark) loads a transformers model on first synth — expect a long first run.',
    longWait: true,
    accent: 'text-amber-500',
    accentBg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    headerGrad: 'from-amber-500/12 via-yellow-500/6 to-transparent',
    btn: 'bg-amber-500 hover:bg-amber-600',
    ring: 'focus:ring-amber-500/30 focus:border-amber-400/50',
    form: TTS_FORM_FIELDS.bark,
  },
  parler: {
    hint: 'Parler-TTS in-process. PARLER_DESCRIPTION env styles the voice.',
    longWait: true,
    form: TTS_FORM_FIELDS.parler,
  },
  voxcpm2: {
    hint: 'VoxCPM2 in-process (OpenBMB). GPU strongly recommended; first load can take minutes.',
    longWait: true,
    form: TTS_FORM_FIELDS.voxcpm2,
  },
  sherpa: {
    hint: 'Sherpa-ONNX Kokoro offline — fast CPU synth once the onnx model is loaded.',
    form: TTS_FORM_FIELDS.sherpa,
  },
  kokoro: {
    hint: 'Kokoro-82M via sherpa-onnx. Set KOKORO_TTS_MODEL_DIR if weights are non-default.',
    form: TTS_FORM_FIELDS.kokoro,
  },
  edge: {
    hint: 'Microsoft Edge TTS (online). Rate-limited — 403/cooldown falls back to offline engines.',
    accent: 'text-blue-500',
    accentBg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    headerGrad: 'from-blue-500/12 via-cyan-500/6 to-transparent',
    btn: 'bg-blue-500 hover:bg-blue-600',
    ring: 'focus:ring-blue-500/30 focus:border-blue-400/50',
    form: TTS_FORM_FIELDS.edge,
  },
  chattts: {
    hint: 'ChatTTS local HTTP API. Server auto-started on first use; first synth may download HF weights.',
    longWait: true,
    form: TTS_FORM_FIELDS.chattts,
  },
  cosyvoice: {
    hint: 'CosyVoice local API — needs COSYVOICE_SPK_ID or COSYVOICE_REF_AUDIO + prompt text.',
    longWait: true,
    form: TTS_FORM_FIELDS.cosyvoice,
  },
  fishspeech: {
    hint: 'Fish Speech / Fish Audio — local server or FISH_API_KEY cloud SDK.',
    form: TTS_FORM_FIELDS.fishspeech,
  },
  gptsovits: {
    hint: 'GPT-SoVITS voice clone — set GPTSOVITS_REF_AUDIO to a reference clip.',
    form: TTS_FORM_FIELDS.gptsovits,
  },
  f5tts: {
    hint: 'F5-TTS flow-matching clone — set F5TTS_REF_AUDIO to a reference clip.',
    form: TTS_FORM_FIELDS.f5tts,
  },
  azure: {
    hint: 'Azure Speech cloud (free F0 tier). Uses configured speech key/region.',
    quotaLabel: 'free F0',
    form: TTS_FORM_FIELDS.azure,
  },
  melotts: {
    hint: 'MeloTTS class-C isolated-venv HTTP server. First start builds the venv and loads the model (can take minutes) before audio returns.',
    longWait: true,
    form: TTS_FORM_FIELDS.melotts,
  },
  gtts_web: {
    hint: 'Google Translate web TTS (online, keyless). ~200 char cap, accent not selectable.',
    form: TTS_FORM_FIELDS.gtts_web,
  },
  streamelements: {
    hint: 'StreamElements speech (online, needs STREAMELEMENTS_API_KEY). English only, us/uk voices.',
    form: TTS_FORM_FIELDS.streamelements,
  },
};

const STT_PROFILES: Record<string, PcTestEngineProfile> = {
  'faster-whisper': {
    hint: 'Round-trip: edge TTS sample → faster-whisper recognize. large-v3 first load can take a minute.',
    longWait: true,
    form: STT_FORM_FIELDS['faster-whisper'],
  },
  whisper: {
    hint: 'OpenAI whisper.cpp / whisper — round-trip phrase test.',
    longWait: true,
    form: STT_FORM_FIELDS.whisper,
  },
  vosk: {
    hint: 'Vosk offline — small models, fast once loaded.',
    form: STT_FORM_FIELDS.vosk,
  },
  azure: {
    hint: 'Azure Speech STT (free F0). Round-trip uses TTS sample audio.',
    quotaLabel: 'free F0',
    form: STT_FORM_FIELDS.azure,
  },
};

const OCR_PROFILES: Record<string, PcTestEngineProfile> = {
  easyocr: {
    hint: 'EasyOCR — GPU speeds up detection; first run may download detection/recognition weights.',
    longWait: true,
    accent: 'text-violet-500',
    accentBg: 'bg-violet-500/10',
    border: 'border-violet-500/25',
    headerGrad: 'from-violet-500/12 via-purple-500/6 to-transparent',
    btn: 'bg-violet-500 hover:bg-violet-600',
    ring: 'focus:ring-violet-500/30 focus:border-violet-400/50',
    form: OCR_FORM_FIELDS.easyocr,
  },
  cnocr: {
    hint: 'CnOCR — lightweight Chinese/English OCR; good for printed text.',
    accent: 'text-red-500',
    accentBg: 'bg-red-500/10',
    border: 'border-red-500/25',
    headerGrad: 'from-red-500/12 via-rose-500/6 to-transparent',
    btn: 'bg-red-500 hover:bg-red-600',
    ring: 'focus:ring-red-500/30 focus:border-red-400/50',
    form: OCR_FORM_FIELDS.cnocr,
  },
  windows_ocr: {
    hint: 'Windows.Media.Ocr (WinRT) — built-in Windows 10+ OCR, no extra model download.',
    accent: 'text-cyan-500',
    accentBg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    headerGrad: 'from-cyan-500/12 via-sky-500/6 to-transparent',
    btn: 'bg-cyan-500 hover:bg-cyan-600',
    ring: 'focus:ring-cyan-500/30 focus:border-cyan-400/50',
    form: OCR_FORM_FIELDS.windows_ocr,
  },
};

const AI_PROFILES: Record<string, PcTestEngineProfile> = {
  openai: { hint: 'One chat turn via OpenAI-compatible API.', form: AI_DEFAULT_FORM_FIELDS },
  anthropic: { hint: 'One chat turn via Anthropic API.', form: AI_DEFAULT_FORM_FIELDS },
  gemini: { hint: 'One chat turn via Google Gemini API.', form: AI_DEFAULT_FORM_FIELDS },
  ollama: { hint: 'Local Ollama — model must be pulled and server running.', form: AI_DEFAULT_FORM_FIELDS },
  auto: { hint: 'Gateway picks the best configured provider for this prompt.', form: AI_FORM_FIELDS.auto },
};

const BY_KIND: Record<PcTestKind, Record<string, PcTestEngineProfile>> = {
  tts: TTS_PROFILES,
  stt: STT_PROFILES,
  ocr: OCR_PROFILES,
  ai: AI_PROFILES,
};

/** Default form fields for a kind when no engine-specific profile exists. */
const KIND_DEFAULT_FORM: Record<PcTestKind, PcTestFormField[]> = {
  tts: [
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.' },
    { key: 'language', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
  ],
  stt: [
    { key: 'text', label: 'Phrase', type: 'textarea', rows: 3, defaultValue: 'The quick brown fox jumps over the lazy dog.' },
    { key: 'language', label: 'Language', type: 'select', options: STT_LANG_OPTS, defaultValue: 'en' },
  ],
  ocr: [
    { key: 'ocrText', label: 'Sample Text', type: 'textarea', rows: 3, defaultValue: 'Hello OCR 123\n你好世界' },
    { key: 'lang', label: 'Language', type: 'select', options: LANG_OPTS, defaultValue: 'en' },
  ],
  ai: AI_DEFAULT_FORM_FIELDS,
};

export function getTestEngineProfile(kind: PcTestKind, target: string): PcTestEngineProfile | null {
  const key = (target || '').trim().toLowerCase();
  const profile = BY_KIND[kind]?.[key] ?? null;
  // Merge default form fields when the profile doesn't define its own.
  if (profile && !profile.form) {
    profile.form = KIND_DEFAULT_FORM[kind];
  }
  return profile;
}

/** Get just the form fields for a kind+target, with defaults. */
export function getTestFormFields(kind: PcTestKind, target: string): PcTestFormField[] {
  const profile = getTestEngineProfile(kind, target);
  if (profile?.form && profile.form.length > 0) return profile.form;
  return KIND_DEFAULT_FORM[kind] ?? [];
}
