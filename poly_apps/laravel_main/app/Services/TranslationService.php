<?php

namespace App\Services;

class TranslationService
{
    private $client;
    
    const TRANSLATION_PROMPTS = [
        'general' => <<<'XML'
<task>Translate the following text to {target_language}. Provide only the translation without any explanations.</task>
<text>{text}</text>
XML,
        
        'professional' => <<<'XML'
<task>Translate the following text to {target_language} in a professional and formal tone. Provide only the translation.</task>
<text>{text}</text>
XML,
        
        'casual' => <<<'XML'
<task>Translate the following text to {target_language} in a casual and friendly tone. Provide only the translation.</task>
<text>{text}</text>
XML,
        
        'technical' => <<<'XML'
<task>Translate the following technical documentation to {target_language}. Preserve all technical terms, code snippets, and formatting. Provide only the translation.</task>
<text>{text}</text>
XML,
        
        'literary' => <<<'XML'
<task>Translate the following text to {target_language} while preserving the literary style, tone, and emotional nuances. Provide only the translation.</task>
<text>{text}</text>
XML,
        
        'multilingual_detect' => <<<'XML'
<task>First detect the language of the text, then translate it to {target_language}. Format your response as:
Source Language: [detected language]
Translation: [translated text]
</task>
<text>{text}</text>
XML,
        
        'learning' => <<<'XML'
<task>Translate the following text to {language_name}.

Original text: "{text}"

Please output in the following format (strictly keep the headers, do not add other content):
{format_instructions}
</task>
XML,
    ];
    
    const LANGUAGES = [
        'en' => 'English',
        'zh' => 'Chinese (Simplified)',
        'zh-TW' => 'Chinese (Traditional)',
        'ja' => 'Japanese',
        'ko' => 'Korean',
        'es' => 'Spanish',
        'fr' => 'French',
        'de' => 'German',
        'ru' => 'Russian',
        'ar' => 'Arabic',
        'pt' => 'Portuguese',
        'it' => 'Italian',
        'nl' => 'Dutch',
        'pl' => 'Polish',
        'tr' => 'Turkish',
        'vi' => 'Vietnamese',
        'th' => 'Thai',
        'id' => 'Indonesian',
        'lo' => 'Lao',
    ];
    
    public function __construct(?OpenRouterClient $client = null)
    {
        $this->client = $client ?? new OpenRouterClient();
    }
    
    public function translate(
        string $text,
        string $targetLanguage,
        string $type = 'general',
        ?string $model = null,
        int $timeout = 300
    ): array {
        if (!isset(self::TRANSLATION_PROMPTS[$type])) {
            return [
                'success' => false,
                'error' => 'Invalid translation type: ' . $type,
            ];
        }
        
        $languageName = self::LANGUAGES[$targetLanguage] ?? $targetLanguage;
        
        $prompt = str_replace(
            ['{target_language}', '{text}'],
            [$languageName, $text],
            self::TRANSLATION_PROMPTS[$type]
        );
        
        $result = $this->client->chat(
            prompt: $prompt,
            model: $model ?? 'free',
            timeout: $timeout
        );
        
        if (str_starts_with($result, 'Error:')) {
            return [
                'success' => false,
                'error' => $result,
            ];
        }
        
        return [
            'success' => true,
            'source_text' => $text,
            'target_language' => $languageName,
            'translation_type' => $type,
            'translated_text' => trim($result),
            'model_used' => $model ?? 'free',
        ];
    }
    
    public function batchTranslate(
        array $texts,
        string $targetLanguage,
        string $type = 'general',
        ?string $model = null
    ): array {
        $results = [];
        
        foreach ($texts as $index => $text) {
            $results[$index] = $this->translate($text, $targetLanguage, $type, $model);
        }
        
        return $results;
    }
    
    public function detectAndTranslate(
        string $text,
        string $targetLanguage,
        ?string $model = null
    ): array {
        return $this->translate($text, $targetLanguage, 'multilingual_detect', $model);
    }
    
    public function getAvailableLanguages(): array
    {
        return self::LANGUAGES;
    }
    
    public function getAvailableTypes(): array
    {
        return array_keys(self::TRANSLATION_PROMPTS);
    }
    
    public function buildPrompt(
        string $text,
        string $targetLanguage,
        array $options = []
    ): string {
        $languageName = self::LANGUAGES[$targetLanguage] ?? $targetLanguage;
        
        $formatInstructions = [];
        $formatInstructions[] = "{$languageName} Translation:";
        
        if ($options['show_phonetics'] ?? false) {
            $formatInstructions[] = "{$languageName} Phonetics:";
        }
        
        if ($options['show_words'] ?? false) {
            $formatInstructions[] = "{$languageName} Words Breakdown (word: phonetic):";
        }
        
        if ($options['show_letters'] ?? false) {
            $formatInstructions[] = "{$languageName} Letters (letter: phonetic):";
        }
        
        if ($options['show_ambiguity'] ?? false) {
            $formatInstructions[] = "{$languageName} Ambiguous Sentence (modify one word to create ambiguity):";
            $formatInstructions[] = "{$languageName} Ambiguity Explanation:";
        }
        
        $prompt = str_replace(
            ['{text}', '{language_name}', '{format_instructions}'],
            [$text, $languageName, implode("\n", $formatInstructions)],
            self::TRANSLATION_PROMPTS['learning']
        );
        
        return $prompt;
    }
    
    public function translateForLearning(
        string $text,
        array $targetLanguages,
        array $options = [],
        ?string $model = null,
        bool $generateAudio = false,
        string $translationMethod = 'ai',
        int $timeout = 300
    ): array {
        if ($translationMethod === 'google') {
            return $this->translateForLearningWithGoogle($text, $targetLanguages, $generateAudio);
        }
        
        $allTranslations = [];
        $allRawResponses = [];
        
        foreach ($targetLanguages as $targetLang) {
            $languageName = self::LANGUAGES[$targetLang] ?? $targetLang;
            
            $prompt = $this->buildPrompt($text, $targetLang, $options);
            
            $actualModel = $model ?? 'free';
            
            $result = $this->client->chat(
                prompt: $prompt,
                model: $actualModel,
                timeout: $timeout
            );
            
            if (str_starts_with($result, 'Error:')) {
                $allTranslations[] = [
                    'language' => $languageName,
                    'error' => $result,
                    'model_requested' => $actualModel,
                ];
                continue;
            }
            
            $allRawResponses[$languageName] = $result;
            
            $parsed = $this->parseLineLearningResult($result, $languageName, $options);
            $parsed['model_requested'] = $actualModel;
            $allTranslations[] = $parsed;
        }
        
        if ($generateAudio) {
            $this->initiateTTSGeneration($text, $allTranslations, $targetLanguages);
        }
        
        return [
            'success' => true,
            'source_text' => $text,
            'target_languages' => array_map(fn($code) => self::LANGUAGES[$code] ?? $code, $targetLanguages),
            'options' => $options,
            'translations' => $allTranslations,
            'raw_responses' => $allRawResponses,
            'model_used' => $model ?? 'free',
            'audio_generation' => $generateAudio,
        ];
    }
    
    private function translateForLearningWithGoogle(
        string $text,
        array $targetLanguages,
        bool $generateAudio = false
    ): array {
        $translatorUtil = new \App\CallPycoreUtils\PycoreTranslatorUtil();
        
        $googleResults = $translatorUtil->translateBatch(
            [$text],
            'auto',
            $targetLanguages,
            true
        );
        
        if (isset($googleResults['error'])) {
            return [
                'success' => false,
                'error' => $googleResults['error'],
                'error_details' => $googleResults['details'] ?? null,
                'translation_method' => 'google',
            ];
        }
        
        if (!$googleResults || !is_array($googleResults)) {
            return [
                'success' => false,
                'error' => 'Google Translate returned invalid data format',
                'raw_response' => $googleResults,
                'translation_method' => 'google',
            ];
        }
        
        $translations = [];
        $errors = [];
        
        foreach ($googleResults as $index => $result) {
            if (isset($result['error'])) {
                $errors[] = [
                    'index' => $index,
                    'language' => $targetLanguages[$index] ?? 'unknown',
                    'error' => $result['error'],
                ];
                continue;
            }
            
            if (!isset($result['translated_text'])) {
                $errors[] = [
                    'index' => $index,
                    'language' => $targetLanguages[$index] ?? 'unknown',
                    'error' => 'Missing translated_text field',
                    'result' => $result,
                ];
                continue;
            }
            
            $langCode = $result['dest_lang'] ?? 'unknown';
            $translation = [
                'language' => self::LANGUAGES[$langCode] ?? $langCode,
                'translation' => $result['translated_text'],
            ];
            
            if (isset($result['pronunciation']) && !empty($result['pronunciation'])) {
                $translation['phonetics'] = $result['pronunciation'];
            }
            
            $translation['letters'] = $this->extractLetters($result['translated_text']);
            
            $translations[] = $translation;
        }
        
        if (empty($translations) && !empty($errors)) {
            return [
                'success' => false,
                'error' => 'All translations failed',
                'translation_errors' => $errors,
                'translation_method' => 'google',
            ];
        }
        
        if ($generateAudio) {
            $this->initiateTTSGeneration($text, $translations, $targetLanguages);
        }
        
        $result = [
            'success' => true,
            'source_text' => $text,
            'target_languages' => array_map(fn($code) => self::LANGUAGES[$code] ?? $code, $targetLanguages),
            'translations' => $translations,
            'translation_method' => 'google',
            'audio_generation' => $generateAudio,
        ];
        
        if (!empty($errors)) {
            $result['partial_errors'] = $errors;
        }
        
        return $result;
    }
    
    private function extractLetters(string $text): array
    {
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        $uniqueChars = array_unique($chars);
        
        $letters = [];
        foreach ($uniqueChars as $char) {
            if (trim($char) !== '' && !preg_match('/[\s\p{P}]/u', $char)) {
                $letters[] = [
                    'letter' => $char,
                    'phonetic' => ''
                ];
            }
        }
        
        return $letters;
    }
    
    private function initiateTTSGeneration(string $sourceText, array $translations, array $targetLangCodes): void
    {
        $ttsService = new \App\Services\EdgeTTS\EdgeTTSService();
        
        foreach ($translations as $idx => $trans) {
            $langCode = $targetLangCodes[$idx] ?? null;
            if (!$langCode) continue;
            
            if (isset($trans['translation'])) {
                $ttsService->generateAudio($trans['translation'], $langCode, 'sentence');
            }
            
            if (isset($trans['words']) && is_array($trans['words'])) {
                foreach ($trans['words'] as $wordData) {
                    if (isset($wordData['word'])) {
                        $ttsService->generateAudio($wordData['word'], $langCode, 'word');
                    }
                }
            }
            
            if (isset($trans['letters']) && is_array($trans['letters'])) {
                foreach ($trans['letters'] as $letterData) {
                    if (isset($letterData['letter'])) {
                        $ttsService->generateAudio($letterData['letter'], $langCode, 'letter');
                    }
                }
            }
        }
    }
    
    private function parseLearningResult(string $result): array
    {
        $result = trim($result);
        
        $jsonMatch = null;
        if (preg_match('/\{[\s\S]*"translations"[\s\S]*\}/U', $result, $jsonMatch)) {
            try {
                $decoded = json_decode($jsonMatch[0], true);
                if (isset($decoded['translations']) && is_array($decoded['translations'])) {
                    return $decoded['translations'];
                }
            } catch (\Exception $e) {
            }
        }
        
        $fallbackResult = [];
        $lines = explode("\n", $result);
        $currentLang = null;
        $currentItem = [];
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;
            
            if (preg_match('/^(Language|Langue|语言)[:\s]*(.+)$/i', $line, $m)) {
                if (!empty($currentItem)) {
                    $fallbackResult[] = $currentItem;
                }
                $currentItem = ['language' => trim($m[2])];
            } elseif (preg_match('/^(Translation|Traduction|翻译)[:\s]*(.+)$/i', $line, $m)) {
                $currentItem['translation'] = trim($m[2]);
            } elseif (preg_match('/^(Phonetics|Phonétique|音标)[:\s]*(.+)$/i', $line, $m)) {
                $currentItem['phonetics'] = trim($m[2]);
            } elseif (preg_match('/^(Words|Mots|词组)[:\s]*/i', $line)) {
                $currentItem['words'] = [];
            } elseif (preg_match('/^[-•*]\s*(.+?)\s*[:\[]\s*(.+?)[\]]?\s*$/', $line, $m)) {
                if (isset($currentItem['words'])) {
                    $currentItem['words'][] = ['word' => trim($m[1]), 'phonetic' => trim($m[2])];
                } elseif (isset($currentItem['letters'])) {
                    $currentItem['letters'][] = ['letter' => trim($m[1]), 'phonetic' => trim($m[2])];
                }
            } elseif (preg_match('/^(Letters|Lettres|字母)[:\s]*/i', $line)) {
                $currentItem['letters'] = [];
            } elseif (preg_match('/^(Ambiguous|Ambigu[ïi]té|歧义)[:\s]*(.+)$/i', $line, $m)) {
                $currentItem['ambiguous_sentence'] = trim($m[2]);
            } elseif (preg_match('/^(Explanation|Explication|解释)[:\s]*(.+)$/i', $line, $m)) {
                $currentItem['ambiguity_explanation'] = trim($m[2]);
            }
        }
        
        if (!empty($currentItem)) {
            $fallbackResult[] = $currentItem;
        }
        
        return !empty($fallbackResult) ? $fallbackResult : [
            ['language' => 'Unknown', 'translation' => $result]
        ];
    }
    
    private function parseLineLearningResult(string $result, string $languageName, array $options): array
    {
        $result = trim($result);
        $lines = explode("\n", $result);
        
        $translation = [
            'language' => $languageName,
        ];
        
        $currentSection = null;
        $wordsList = [];
        $lettersList = [];
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;
            
            if (preg_match('/^' . preg_quote($languageName, '/') . '\s+Translation[:\s]*(.*)$/i', $line, $m)) {
                $translation['translation'] = trim($m[1]);
                $currentSection = null;
            } elseif (preg_match('/^' . preg_quote($languageName, '/') . '\s+Phonetics[:\s]*(.*)$/i', $line, $m)) {
                $translation['phonetics'] = trim($m[1]);
                $currentSection = null;
            } elseif (preg_match('/^' . preg_quote($languageName, '/') . '\s+Words Breakdown/i', $line)) {
                $currentSection = 'words';
            } elseif (preg_match('/^' . preg_quote($languageName, '/') . '\s+Letters/i', $line)) {
                $currentSection = 'letters';
            } elseif (preg_match('/^' . preg_quote($languageName, '/') . '\s+Ambiguous Sentence[:\s]*(.*)$/i', $line, $m)) {
                $translation['ambiguous_sentence'] = trim($m[1]);
                $currentSection = null;
            } elseif (preg_match('/^' . preg_quote($languageName, '/') . '\s+Ambiguity Explanation[:\s]*(.*)$/i', $line, $m)) {
                $translation['ambiguity_explanation'] = trim($m[1]);
                $currentSection = null;
            } elseif ($currentSection === 'words' && preg_match('/^(.+?)[:\uff1a]\s*(.+)$/', $line, $m)) {
                $wordsList[] = ['word' => trim($m[1]), 'phonetic' => trim($m[2])];
            } elseif ($currentSection === 'letters' && preg_match('/^(.+?)[:\uff1a]\s*(.+)$/', $line, $m)) {
                $lettersList[] = ['letter' => trim($m[1]), 'phonetic' => trim($m[2])];
            } elseif (!isset($translation['translation']) && !preg_match('/^' . preg_quote($languageName, '/') . '/i', $line)) {
                $translation['translation'] = $line;
            }
        }
        
        if (!empty($wordsList)) {
            $translation['words'] = $wordsList;
        }
        
        if (!empty($lettersList)) {
            $translation['letters'] = $lettersList;
        }
        
        if (!isset($translation['translation'])) {
            $translation['translation'] = $result;
            $translation['parse_note'] = 'Failed to parse, showing raw output';
        }
        
        return $translation;
    }
}
