<?php

namespace App\Services\Translation;

class TranslationConstants
{
    const LANGUAGES = [
        'af' => 'Afrikaans', 'am' => 'Amharic', 'ar' => 'Arabic', 'as' => 'Assamese',
        'az' => 'Azerbaijani', 'bg' => 'Bulgarian', 'bn' => 'Bengali', 'bs' => 'Bosnian',
        'ca' => 'Catalan', 'cs' => 'Czech', 'cy' => 'Welsh', 'da' => 'Danish',
        'de' => 'German', 'el' => 'Greek', 'en' => 'English', 'es' => 'Spanish',
        'et' => 'Estonian', 'eu' => 'Basque', 'fa' => 'Persian', 'fi' => 'Finnish',
        'fil' => 'Filipino', 'fr' => 'French', 'ga' => 'Irish', 'gl' => 'Galician',
        'gu' => 'Gujarati', 'he' => 'Hebrew', 'hi' => 'Hindi', 'hr' => 'Croatian',
        'hu' => 'Hungarian', 'hy' => 'Armenian', 'id' => 'Indonesian', 'is' => 'Icelandic',
        'it' => 'Italian', 'ja' => 'Japanese', 'jv' => 'Javanese', 'ka' => 'Georgian',
        'kk' => 'Kazakh', 'km' => 'Khmer', 'kn' => 'Kannada', 'ko' => 'Korean',
        'lo' => 'Lao', 'lt' => 'Lithuanian', 'lv' => 'Latvian', 'mk' => 'Macedonian',
        'ml' => 'Malayalam', 'mn' => 'Mongolian', 'mr' => 'Marathi', 'ms' => 'Malay',
        'mt' => 'Maltese', 'my' => 'Myanmar', 'nb' => 'Norwegian', 'ne' => 'Nepali',
        'nl' => 'Dutch', 'or' => 'Odia', 'pa' => 'Punjabi', 'pl' => 'Polish',
        'ps' => 'Pashto', 'pt' => 'Portuguese', 'ro' => 'Romanian', 'ru' => 'Russian',
        'si' => 'Sinhala', 'sk' => 'Slovak', 'sl' => 'Slovenian', 'so' => 'Somali',
        'sq' => 'Albanian', 'sr' => 'Serbian', 'su' => 'Sundanese', 'sv' => 'Swedish',
        'sw' => 'Swahili', 'ta' => 'Tamil', 'te' => 'Telugu', 'th' => 'Thai',
        'tr' => 'Turkish', 'uk' => 'Ukrainian', 'ur' => 'Urdu', 'uz' => 'Uzbek',
        'vi' => 'Vietnamese', 'wuu' => 'Wu Chinese', 'yue' => 'Cantonese', 'zh' => 'Chinese',
        'zu' => 'Zulu'
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
    
    public static function getLanguageTemplates(): array
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
}
