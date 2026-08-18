export const FEATURE_DEFINITIONS = [
  {
    id: 'bing-dictionary',
    name: 'Bing Dictionary',
    description: 'Look up definitions, translations, and pronunciation.',
    icon: 'BD',
    accent: 'orange',
    defaultEnabled: true,
  },
  {
    id: 'notebooklm',
    name: 'NotebookLM',
    description: 'Automate questions and research in Google NotebookLM.',
    icon: 'NL',
    accent: 'sky',
    defaultEnabled: false,
  },
  {
    id: 'gemini-image',
    name: 'Gemini Image',
    description: 'Generate images with Gemini and capture the result.',
    icon: 'GI',
    accent: 'violet',
    defaultEnabled: false,
  },
  {
    id: 'article-study-guide',
    name: 'Article Guide',
    description: 'Build aligned reading, grammar, and phrase study guides.',
    icon: 'AG',
    accent: 'blue',
    defaultEnabled: false,
  },
  {
    id: 'book-study-generator',
    name: 'Book Studio',
    description: 'Generate multilingual study material from book segments.',
    icon: 'BS',
    accent: 'emerald',
    defaultEnabled: false,
  },
  {
    id: 'ai-translate-hub',
    name: 'Translate Hub',
    description: 'Translate with web AI providers and attach speech audio.',
    icon: 'TH',
    accent: 'purple',
    defaultEnabled: false,
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search web, image, and news sources in live browser tabs.',
    icon: 'WS',
    accent: 'amber',
    defaultEnabled: false,
  },
  {
    id: 'qwen-tts',
    name: 'Qwen TTS',
    description: 'Generate and download speech with Qwen3-TTS.',
    icon: 'QT',
    accent: 'indigo',
    defaultEnabled: false,
  },
  {
    id: 'word-validity',
    name: 'Word Validity',
    description: 'Test word validity classification with the shared web runtime.',
    icon: 'WV',
    accent: 'emerald',
    defaultEnabled: false,
  },
] as const;

export type FeatureDefinition = (typeof FEATURE_DEFINITIONS)[number];
export type FeatureId = FeatureDefinition['id'];

export interface FeatureState {
  id: FeatureId;
  enabled: boolean;
  config: Record<string, unknown>;
}

export type FeatureConfig = FeatureDefinition & FeatureState;

export const FEATURE_BY_ID = Object.fromEntries(
  FEATURE_DEFINITIONS.map((feature) => [feature.id, feature]),
) as Record<FeatureId, FeatureDefinition>;

const FEATURE_I18N_KEYS: Record<FeatureId, { name: string; description: string }> = {
  'bing-dictionary': { name: 'featureName_bingDictionary', description: 'featureDesc_bingDictionary' },
  notebooklm: { name: 'featureName_notebooklm', description: 'featureDesc_notebooklm' },
  'gemini-image': { name: 'featureName_geminiImage', description: 'featureDesc_geminiImage' },
  'article-study-guide': { name: 'featureName_articleStudyGuide', description: 'featureDesc_articleStudyGuide' },
  'book-study-generator': { name: 'featureName_bookStudyGenerator', description: 'featureDesc_bookStudyGenerator' },
  'ai-translate-hub': { name: 'featureName_aiTranslateHub', description: 'featureDesc_aiTranslateHub' },
  'web-search': { name: 'featureName_webSearch', description: 'featureDesc_webSearch' },
  'qwen-tts': { name: 'featureName_qwenTts', description: 'featureDesc_qwenTts' },
  'word-validity': { name: 'featureName_wordValidity', description: 'featureDesc_wordValidity' },
};

export function getLocalizedFeature(id: FeatureId, getMessage: (key: string) => string): { name: string; description: string } {
  const keys = FEATURE_I18N_KEYS[id];
  return {
    name: getMessage(keys.name),
    description: getMessage(keys.description),
  };
}
