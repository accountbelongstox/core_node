<?php

namespace App\Services;

/**
 * @deprecated This class is deprecated. Use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TranslationService instead.
 * All translation functionality has been moved to AppQyV1 with database-backed caching.
 * 
 * Migration Path:
 * - Old: App\Services\TranslationService
 * - New: App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TranslationService
 * 
 * Old API endpoints: /translation/*
 * New API endpoints: /app_qy_v1/ai_tools/translation/*
 */
class TranslationService
{
    private $openrouterClient;
    private $deepseekClient;
    private $geminiClient;
    
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
<task>Translate the following text to multiple languages.

Original text: "{text}"

Please output in the following format (strictly keep the headers, do not add other content):
{format_instructions}
</task>
XML,
    ];
    
    const LANGUAGE_PROMPT_TEMPLATES = [
        'af' => ['translation' => 'Afrikaanse vertaling: {vertaling}', 'words' => 'Afrikaanse woorde: {woord} [{uitspraak}]'],
        'am' => ['translation' => 'የአማርኛ ትርጉም: {ትርጉም}', 'words' => 'የአማርኛ ቃላት: {ቃል} [{አጠራር}]'],
        'ar' => ['translation' => 'الترجمة العربية: {الترجمة}', 'words' => 'الكلمات العربية: {كلمة} [{نطق}]'],
        'as' => ['translation' => 'অসমীয়া অনুবাদ: {অনুবাদ}', 'words' => 'অসমীয়া শব্দ: {শব্দ} [{উচ্চাৰণ}]'],
        'az' => ['translation' => 'Azərbaycan tərcüməsi: {tərcümə}', 'words' => 'Azərbaycan sözləri: {söz} [{tələffüz}]'],
        'bg' => ['translation' => 'Български превод: {превод}', 'words' => 'Български думи: {дума} [{произношение}]'],
        'bn' => ['translation' => 'বাংলা অনুবাদ: {অনুবাদ}', 'words' => 'বাংলা শব্দ: {শব্দ} [{উচ্চারণ}]'],
        'bs' => ['translation' => 'Bosanski prijevod: {prijevod}', 'words' => 'Bosanske riječi: {riječ} [{izgovor}]'],
        'ca' => ['translation' => 'Traducció catalana: {traducció}', 'words' => 'Paraules catalanes: {paraula} [{pronunciació}]'],
        'cs' => ['translation' => 'Český překlad: {překlad}', 'words' => 'Česká slova: {slovo} [{výslovnost}]'],
        'cy' => ['translation' => 'Cyfieithiad Cymraeg: {cyfieithiad}', 'words' => 'Geiriau Cymraeg: {gair} [{ynganiad}]'],
        'da' => ['translation' => 'Dansk oversættelse: {oversættelse}', 'words' => 'Danske ord: {ord} [{udtale}]'],
        'de' => ['translation' => 'Deutsche Übersetzung: {Übersetzung}', 'words' => 'Deutsche Wörter: {Wort} [{Aussprache}]'],
        'el' => ['translation' => 'Ελληνική μετάφραση: {μετάφραση}', 'words' => 'Ελληνικές λέξεις: {λέξη} [{προφορά}]'],
        'en' => ['translation' => 'English Translation: {translation}', 'words' => 'English Words: {word} [{phonetic}]'],
        'es' => ['translation' => 'Traducción al español: {traducción}', 'words' => 'Palabras en español: {palabra} [{fonética}]'],
        'et' => ['translation' => 'Eestikeelne tõlge: {tõlge}', 'words' => 'Eesti sõnad: {sõna} [{hääldus}]'],
        'eu' => ['translation' => 'Euskarazko itzulpena: {itzulpena}', 'words' => 'Euskal hitzak: {hitza} [{ahoskera}]'],
        'fa' => ['translation' => 'ترجمه فارسی: {ترجمه}', 'words' => 'کلمات فارسی: {کلمه} [{تلفظ}]'],
        'fi' => ['translation' => 'Suomenkielinen käännös: {käännös}', 'words' => 'Suomen sanat: {sana} [{ääntäminen}]'],
        'fil' => ['translation' => 'Pagsasalin sa Filipino: {pagsasalin}', 'words' => 'Mga salitang Filipino: {salita} [{bigkas}]'],
        'fr' => ['translation' => 'Traduction française: {traduction}', 'words' => 'Mots français: {mot} [{phonétique}]'],
        'ga' => ['translation' => 'Aistriúchán Gaeilge: {aistriúchán}', 'words' => 'Focail Ghaeilge: {focal} [{fuaimniú}]'],
        'gl' => ['translation' => 'Tradución galega: {tradución}', 'words' => 'Palabras galegas: {palabra} [{pronuncia}]'],
        'gu' => ['translation' => 'ગુજરાતી અનુવાદ: {અનુવાદ}', 'words' => 'ગુજરાતી શબ્દો: {શબ્દ} [{ઉચ્ચાર}]'],
        'he' => ['translation' => 'תרגום לעברית: {תרגום}', 'words' => 'מילים בעברית: {מילה} [{ביטוי}]'],
        'hi' => ['translation' => 'हिंदी अनुवाद: {अनुवाद}', 'words' => 'हिंदी शब्द: {शब्द} [{उच्चारण}]'],
        'hr' => ['translation' => 'Hrvatski prijevod: {prijevod}', 'words' => 'Hrvatske riječi: {riječ} [{izgovor}]'],
        'hu' => ['translation' => 'Magyar fordítás: {fordítás}', 'words' => 'Magyar szavak: {szó} [{kiejtés}]'],
        'hy' => ['translation' => 'Հայերեն թարգմանություն: {թարգմանություն}', 'words' => 'Հայերեն բառեր: {բառ} [{արտասանություն}]'],
        'id' => ['translation' => 'Terjemahan Bahasa Indonesia: {terjemahan}', 'words' => 'Kata-kata Indonesia: {kata} [{pelafalan}]'],
        'is' => ['translation' => 'Íslensk þýðing: {þýðing}', 'words' => 'Íslensk orð: {orð} [{framburður}]'],
        'it' => ['translation' => 'Traduzione italiana: {traduzione}', 'words' => 'Parole italiane: {parola} [{pronuncia}]'],
        'ja' => ['translation' => '日本語訳：{翻訳}', 'words' => '日本語単語：{単語} [{読み方}]'],
        'jv' => ['translation' => 'Terjemahan Jawa: {terjemahan}', 'words' => 'Tembung Jawa: {tembung} [{lafal}]'],
        'ka' => ['translation' => 'ქართული თარგმანი: {თარგმანი}', 'words' => 'ქართული სიტყვები: {სიტყვა} [{გამოთქმა}]'],
        'kk' => ['translation' => 'Қазақша аударма: {аударма}', 'words' => 'Қазақ сөздері: {сөз} [{айту}]'],
        'km' => ['translation' => 'ការបកប្រែខ្មែរ: {ការបកប្រែ}', 'words' => 'ពាក្យខ្មែរ: {ពាក្យ} [{ការបញ្ចេញសំឡេង}]'],
        'kn' => ['translation' => 'ಕನ್ನಡ ಅನುವಾದ: {ಅನುವಾದ}', 'words' => 'ಕನ್ನಡ ಪದಗಳು: {ಪದ} [{ಉಚ್ಚಾರಣೆ}]'],
        'ko' => ['translation' => '한국어 번역: {번역}', 'words' => '한국어 단어: {단어} [{발음}]'],
        'lo' => ['translation' => 'ການແປພາສາລາວ: {ການແປ}', 'words' => 'ຄຳສັບລາວ: {ຄຳ} [{ການອອກສຽງ}]'],
        'lt' => ['translation' => 'Lietuviškas vertimas: {vertimas}', 'words' => 'Lietuviški žodžiai: {žodis} [{tarimas}]'],
        'lv' => ['translation' => 'Latviskais tulkojums: {tulkojums}', 'words' => 'Latviešu vārdi: {vārds} [{izruna}]'],
        'mk' => ['translation' => 'Македонски превод: {превод}', 'words' => 'Македонски зборови: {збор} [{изговор}]'],
        'ml' => ['translation' => 'മലയാളം വിവർത്തനം: {വിവർത്തനം}', 'words' => 'മലയാളം വാക്കുകൾ: {വാക്ക്} [{ഉച്ചാരണം}]'],
        'mn' => ['translation' => 'Монгол орчуулга: {орчуулга}', 'words' => 'Монгол үгс: {үг} [{дуудлага}]'],
        'mr' => ['translation' => 'मराठी भाषांतर: {भाषांतर}', 'words' => 'मराठी शब्द: {शब्द} [{उच्चार}]'],
        'ms' => ['translation' => 'Terjemahan Melayu: {terjemahan}', 'words' => 'Perkataan Melayu: {perkataan} [{sebutan}]'],
        'mt' => ['translation' => 'Traduzzjoni Maltija: {traduzzjoni}', 'words' => 'Kliem Malti: {kelma} [{pronunzja}]'],
        'my' => ['translation' => 'မြန်မာဘာသာပြန်: {ဘာသာပြန်}', 'words' => 'မြန်မာစကားလုံးများ: {စကားလုံး} [{အသံထွက်}]'],
        'nb' => ['translation' => 'Norsk oversettelse: {oversettelse}', 'words' => 'Norske ord: {ord} [{uttale}]'],
        'ne' => ['translation' => 'नेपाली अनुवाद: {अनुवाद}', 'words' => 'नेपाली शब्दहरू: {शब्द} [{उच्चारण}]'],
        'nl' => ['translation' => 'Nederlandse vertaling: {vertaling}', 'words' => 'Nederlandse woorden: {woord} [{uitspraak}]'],
        'or' => ['translation' => 'ଓଡ଼ିଆ ଅନୁବାଦ: {ଅନୁବାଦ}', 'words' => 'ଓଡ଼ିଆ ଶବ୍ଦଗୁଡିକ: {ଶବ୍ଦ} [{ଉଚ୍ଚାରଣ}]'],
        'pa' => ['translation' => 'ਪੰਜਾਬੀ ਅਨੁਵਾਦ: {ਅਨੁਵਾਦ}', 'words' => 'ਪੰਜਾਬੀ ਸ਼ਬਦ: {ਸ਼ਬਦ} [{ਉਚਾਰਨ}]'],
        'pl' => ['translation' => 'Polskie tłumaczenie: {tłumaczenie}', 'words' => 'Polskie słowa: {słowo} [{wymowa}]'],
        'ps' => ['translation' => 'پښتو ژباړه: {ژباړه}', 'words' => 'پښتو ټکي: {ټکی} [{تلفظ}]'],
        'pt' => ['translation' => 'Tradução em português: {tradução}', 'words' => 'Palavras em português: {palavra} [{fonética}]'],
        'ro' => ['translation' => 'Traducere în română: {traducere}', 'words' => 'Cuvinte românești: {cuvânt} [{pronunție}]'],
        'ru' => ['translation' => 'Русский перевод: {перевод}', 'words' => 'Русские слова: {слово} [{произношение}]'],
        'si' => ['translation' => 'සිංහල පරිවර්තනය: {පරිවර්තනය}', 'words' => 'සිංහල වචන: {වචනය} [{උච්චාරණය}]'],
        'sk' => ['translation' => 'Slovenský preklad: {preklad}', 'words' => 'Slovenské slová: {slovo} [{výslovnosť}]'],
        'sl' => ['translation' => 'Slovenski prevod: {prevod}', 'words' => 'Slovenske besede: {beseda} [{izgovorjava}]'],
        'so' => ['translation' => 'Turjumaada Soomaaliga: {turjumaada}', 'words' => 'Erayada Soomaaliga: {eray} [{ku dhawaaqid}]'],
        'sq' => ['translation' => 'Përkthimi shqip: {përkthim}', 'words' => 'Fjalët shqipe: {fjalë} [{shqiptim}]'],
        'sr' => ['translation' => 'Српски превод: {превод}', 'words' => 'Српске речи: {реч} [{изговор}]'],
        'su' => ['translation' => 'Tarjamahan Sunda: {tarjamahan}', 'words' => 'Kecap Sunda: {kecap} [{lafal}]'],
        'sv' => ['translation' => 'Svensk översättning: {översättning}', 'words' => 'Svenska ord: {ord} [{uttal}]'],
        'sw' => ['translation' => 'Tafsiri ya Kiswahili: {tafsiri}', 'words' => 'Maneno ya Kiswahili: {neno} [{matamshi}]'],
        'ta' => ['translation' => 'தமிழ் மொழிபெயர்ப்பு: {மொழிபெயர்ப்பு}', 'words' => 'தமிழ் சொற்கள்: {சொல்} [{உச்சரிப்பு}]'],
        'te' => ['translation' => 'తెలుగు అనువాదం: {అనువాదం}', 'words' => 'తెలుగు పదాలు: {పదం} [{ఉచ్చారణ}]'],
        'th' => ['translation' => 'การแปลภาษาไทย: {คำแปล}', 'words' => 'คำศัพท์ไทย: {คำ} [{การออกเสียง}]'],
        'tr' => ['translation' => 'Türkçe çeviri: {çeviri}', 'words' => 'Türkçe kelimeler: {kelime} [{telaffuz}]'],
        'uk' => ['translation' => 'Український переклад: {переклад}', 'words' => 'Українські слова: {слово} [{вимова}]'],
        'ur' => ['translation' => 'اردو ترجمہ: {ترجمہ}', 'words' => 'اردو الفاظ: {لفظ} [{تلفظ}]'],
        'uz' => ['translation' => 'Oʻzbek tarjimasi: {tarjima}', 'words' => 'Oʻzbek soʻzlari: {soʻz} [{talaffuz}]'],
        'vi' => ['translation' => 'Bản dịch tiếng Việt: {bản dịch}', 'words' => 'Từ vựng tiếng Việt: {từ} [{phiên âm}]'],
        'wuu' => ['translation' => '吴语翻译：{翻译}', 'words' => '吴语词汇：{词} [{读音}]'],
        'yue' => ['translation' => '粵語翻譯：{翻譯}', 'words' => '粵語詞彙：{詞} [{讀音}]'],
        'zh' => ['translation' => '中文翻译：{翻译内容}', 'words' => '中文词汇：{词语} [{拼音}]'],
        'zu' => ['translation' => 'Ukuhunyushwa kwesiZulu: {ukuhunyushwa}', 'words' => 'Amagama esiZulu: {igama} [{ukuphimisa}]'],
    ];
    
    const LANGUAGES = [
        'af' => 'Afrikaans', 'am' => 'Amharic', 'ar' => 'Arabic', 'as' => 'Assamese', 'az' => 'Azerbaijani',
        'bg' => 'Bulgarian', 'bn' => 'Bengali', 'bs' => 'Bosnian', 'ca' => 'Catalan', 'cs' => 'Czech',
        'cy' => 'Welsh', 'da' => 'Danish', 'de' => 'German', 'el' => 'Greek', 'en' => 'English',
        'es' => 'Spanish', 'et' => 'Estonian', 'eu' => 'Basque', 'fa' => 'Persian', 'fi' => 'Finnish',
        'fil' => 'Filipino', 'fr' => 'French', 'ga' => 'Irish', 'gl' => 'Galician', 'gu' => 'Gujarati',
        'he' => 'Hebrew', 'hi' => 'Hindi', 'hr' => 'Croatian', 'hu' => 'Hungarian', 'hy' => 'Armenian',
        'id' => 'Indonesian', 'is' => 'Icelandic', 'it' => 'Italian', 'ja' => 'Japanese', 'jv' => 'Javanese',
        'ka' => 'Georgian', 'kk' => 'Kazakh', 'km' => 'Khmer', 'kn' => 'Kannada', 'ko' => 'Korean',
        'lo' => 'Lao', 'lt' => 'Lithuanian', 'lv' => 'Latvian', 'mk' => 'Macedonian', 'ml' => 'Malayalam',
        'mn' => 'Mongolian', 'mr' => 'Marathi', 'ms' => 'Malay', 'mt' => 'Maltese', 'my' => 'Burmese',
        'nb' => 'Norwegian', 'ne' => 'Nepali', 'nl' => 'Dutch', 'or' => 'Odia', 'pa' => 'Punjabi',
        'pl' => 'Polish', 'ps' => 'Pashto', 'pt' => 'Portuguese', 'ro' => 'Romanian', 'ru' => 'Russian',
        'si' => 'Sinhala', 'sk' => 'Slovak', 'sl' => 'Slovenian', 'so' => 'Somali', 'sq' => 'Albanian',
        'sr' => 'Serbian', 'su' => 'Sundanese', 'sv' => 'Swedish', 'sw' => 'Swahili', 'ta' => 'Tamil',
        'te' => 'Telugu', 'th' => 'Thai', 'tr' => 'Turkish', 'uk' => 'Ukrainian', 'ur' => 'Urdu',
        'uz' => 'Uzbek', 'vi' => 'Vietnamese', 'wuu' => 'Wu Chinese', 'yue' => 'Cantonese', 'zh' => 'Chinese (Mandarin)',
        'zu' => 'Zulu',
    ];
    
    public function __construct(?OpenRouterClient $openrouterClient = null, ?DeepSeekClient $deepseekClient = null, ?GeminiClient $geminiClient = null)
    {
        $this->openrouterClient = $openrouterClient ?? new OpenRouterClient();
        $this->deepseekClient = $deepseekClient ?? new DeepSeekClient();
        $this->geminiClient = $geminiClient ?? new GeminiClient();
    }
    
    public function translate(
        string $text,
        string $targetLanguage,
        string $type = 'general',
        ?string $model = null,
        string $provider = 'openrouter',
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
        
        $client = match($provider) {
            'deepseek' => $this->deepseekClient,
            'gemini' => $this->geminiClient,
            default => $this->openrouterClient,
        };
        
        $defaultModel = match($provider) {
            'deepseek' => 'deepseek-chat',
            'gemini' => 'gemini-2.5-flash',
            default => 'free',
        };
        
        $result = $client->chat(
            prompt: $prompt,
            model: $model ?? $defaultModel,
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
        ?string $model = null,
        string $provider = 'openrouter'
    ): array {
        $results = [];
        
        foreach ($texts as $index => $text) {
            $results[$index] = $this->translate($text, $targetLanguage, $type, $model, $provider);
        }
        
        return $results;
    }
    
    public function detectAndTranslate(
        string $text,
        string $targetLanguage,
        ?string $model = null,
        string $provider = 'openrouter'
    ): array {
        return $this->translate($text, $targetLanguage, 'multilingual_detect', $model, $provider);
    }
    
    public function getAvailableLanguages(): array
    {
        return self::LANGUAGES;
    }
    
    public function getAvailableTypes(): array
    {
        return array_keys(self::TRANSLATION_PROMPTS);
    }
    
    public function getLanguageTemplates(): array
    {
        $templates = [];
        
        foreach (self::LANGUAGE_PROMPT_TEMPLATES as $langCode => $template) {
            $templates[$langCode] = [
                'name' => self::LANGUAGES[$langCode] ?? $langCode,
                'translation' => $template['translation'],
                'words' => $template['words'],
            ];
        }
        
        return $templates;
    }
    
    public function buildPrompt(
        string $text,
        string $targetLanguage,
        array $options = []
    ): string {
        return $this->buildMultiLanguagePrompt($text, [$targetLanguage], $options);
    }
    
    public function buildMultiLanguagePrompt(
        string $text,
        array $targetLanguages,
        array $options = []
    ): string {
        $formatInstructions = [];
        
        foreach ($targetLanguages as $langCode) {
            $template = self::LANGUAGE_PROMPT_TEMPLATES[$langCode] ?? null;
            
            if ($template) {
                $formatInstructions[] = $template['translation'];
                $formatInstructions[] = $template['words'];
            } else {
                $languageName = self::LANGUAGES[$langCode] ?? $langCode;
                $formatInstructions[] = "{$languageName} Translation: {translation}";
                $formatInstructions[] = "{$languageName} Words: {word} [{phonetic}], {word} [{phonetic}]";
            }
            
            $formatInstructions[] = '';
        }
        
        $prompt = str_replace(
            ['{text}', '{format_instructions}'],
            [$text, implode("\n", $formatInstructions)],
            self::TRANSLATION_PROMPTS['learning']
        );
        
        return $prompt;
    }
    
    public function translateForLearning(
        string $text,
        array $targetLanguages,
        array $options = [],
        ?string $model = null,
        string $provider = 'openrouter',
        bool $generateAudio = false,
        string $translationMethod = 'ai',
        int $timeout = 300
    ): array {
        if ($translationMethod === 'google') {
            return $this->translateForLearningWithGoogle($text, $targetLanguages, $generateAudio);
        }
        
        $prompt = $this->buildMultiLanguagePrompt($text, $targetLanguages, $options);
        
        $client = match($provider) {
            'deepseek' => $this->deepseekClient,
            'gemini' => $this->geminiClient,
            default => $this->openrouterClient,
        };
        
        $defaultModel = match($provider) {
            'deepseek' => 'deepseek-chat',
            'gemini' => 'gemini-2.5-flash',
            default => 'free',
        };
        
        $actualModel = $model ?? $defaultModel;
        
        $result = $client->chat(
            prompt: $prompt,
            model: $actualModel,
            timeout: $timeout
        );
        
        if (str_starts_with($result, 'Error:')) {
            return [
                'success' => false,
                'error' => $result,
                'model_requested' => $actualModel,
                'source_text' => $text,
            ];
        }
        
        $allTranslations = [];
        
        foreach ($targetLanguages as $langCode) {
            $allTranslations[] = [
                'language' => self::LANGUAGES[$langCode] ?? $langCode,
                'lang_code' => $langCode,
                'model_requested' => $actualModel,
            ];
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
            'raw_response' => $result,
            'model_used' => $actualModel,
            'audio_generation' => $generateAudio,
            'prompt_used' => $prompt,
        ];
    }
    
    private function parseMultiLanguageResult(string $result, array $targetLanguages): array
    {
        $translations = [];
        $lines = explode("\n", trim($result));
        
        $langPatterns = [];
        foreach ($targetLanguages as $langCode) {
            $template = self::LANGUAGE_PROMPT_TEMPLATES[$langCode] ?? null;
            if ($template) {
                $transLabel = preg_replace('/[:：]\s*\{.*\}$/u', '', $template['translation']);
                $transLabel = trim($transLabel);
                
                $wordsLabel = preg_replace('/[:：]\s*\{.*\}$/u', '', $template['words']);
                $wordsLabel = trim($wordsLabel);
                
                $langPatterns[$langCode] = [
                    'translation_pattern' => '/^' . preg_quote($transLabel, '/') . '[:：]\s*(.*)$/u',
                    'words_pattern' => '/^' . preg_quote($wordsLabel, '/') . '[:：]\s*(.*)$/u',
                    'translation_label' => $transLabel,
                    'words_label' => $wordsLabel,
                ];
            } else {
                $languageName = self::LANGUAGES[$langCode] ?? $langCode;
                $langPatterns[$langCode] = [
                    'translation_pattern' => '/^' . preg_quote($languageName, '/') . '\s*Translation[:：]\s*(.*)$/iu',
                    'words_pattern' => '/^' . preg_quote($languageName, '/') . '\s*Words[:：]\s*(.*)$/iu',
                    'translation_label' => $languageName . ' Translation',
                    'words_label' => $languageName . ' Words',
                ];
            }
        }
        
        $currentData = [];
        foreach ($targetLanguages as $langCode) {
            $currentData[$langCode] = [
                'language' => self::LANGUAGES[$langCode] ?? $langCode,
                'lang_code' => $langCode,
            ];
        }
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;
            
            $matched = false;
            foreach ($targetLanguages as $langCode) {
                $patterns = $langPatterns[$langCode];
                
                if (preg_match($patterns['translation_pattern'], $line, $m)) {
                    $currentData[$langCode]['translation'] = trim($m[1]);
                    $matched = true;
                    break;
                }
                
                if (preg_match($patterns['words_pattern'], $line, $m)) {
                    $wordsStr = trim($m[1]);
                    $currentData[$langCode]['words_raw'] = $wordsStr;
                    $currentData[$langCode]['words'] = $this->parseWordsString($wordsStr);
                    $matched = true;
                    break;
                }
            }
            
            if (!$matched && !empty($line)) {
                \Log::debug('[TranslationService] Unmatched line: ' . $line);
            }
        }
        
        foreach ($targetLanguages as $langCode) {
            $data = $currentData[$langCode];
            
            if (!isset($data['translation']) || empty($data['translation'])) {
                $data['parse_note'] = 'Translation text not found in response';
                $data['debug_patterns'] = [
                    'translation_label' => $langPatterns[$langCode]['translation_label'] ?? 'N/A',
                    'words_label' => $langPatterns[$langCode]['words_label'] ?? 'N/A',
                    'translation_pattern' => $langPatterns[$langCode]['translation_pattern'] ?? 'N/A',
                    'words_pattern' => $langPatterns[$langCode]['words_pattern'] ?? 'N/A',
                ];
                
                \Log::warning('[TranslationService] Failed to parse language: ' . $langCode, [
                    'patterns' => $data['debug_patterns'],
                    'has_words_raw' => isset($data['words_raw']),
                    'lines_count' => count($lines),
                ]);
            }
            
            $translations[] = $data;
        }
        
        return $translations;
    }
    
    private function parseWordsString(string $wordsStr): array
    {
        $words = [];
        $parts = preg_split('/[,，、;；]+/u', $wordsStr);
        
        foreach ($parts as $part) {
            $part = trim($part);
            if (empty($part)) continue;
            
            if (preg_match('/^(.+?)\s*[\[\(（「『【〔]\s*(.+?)\s*[\]\)）」』】〕]\s*$/u', $part, $m)) {
                $words[] = [
                    'word' => trim($m[1]),
                    'phonetic' => trim($m[2]),
                ];
            } else {
                $words[] = [
                    'word' => $part,
                    'phonetic' => '',
                ];
            }
        }
        
        return $words;
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
            } elseif ($currentSection === 'words' && preg_match('/^(.+?)[:：]\s*(.+)$/u', $line, $m)) {
                $wordsList[] = ['word' => trim($m[1]), 'phonetic' => trim($m[2])];
            } elseif ($currentSection === 'letters' && preg_match('/^(.+?)[:：]\s*(.+)$/u', $line, $m)) {
                $lettersList[] = ['letter' => trim($m[1]), 'phonetic' => trim($m[2])];
            } elseif (!isset($translation['translation']) && !preg_match('/^' . preg_quote($languageName, '/') . '/iu', $line)) {
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
