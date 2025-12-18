<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Multi-language Word Dictionary Model
 * Uses sys:init table structure (app_qy_v1_words_*)
 *
 * Table structure:
 * - English: word, word_id, us_phonetic, uk_phonetic, translation(JSON), sample_images
 * - Others: word, word_id, pronunciation, meaning_en, meaning_zh
 * - All: ai_reviewed, tts_generated, created_at, updated_at
 */
class AppQyV1MultiLangDictionaryModel extends Model
{
    use HasFactory;

    protected $connection = 'AppQyV1';
    protected $table;
    protected $langCode;

    protected $fillable = [
        'word_id',
        'word',
        'pronunciation',
        'us_phonetic',
        'uk_phonetic',
        'translation',
        'meaning_en',
        'meaning_zh',
        'sample_images',
        'ai_reviewed',
        'tts_generated',
    ];

    protected $casts = [
        'translation' => 'json',
        'sample_images' => 'json',
        'ai_reviewed' => 'boolean',
        'tts_generated' => 'boolean',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        if (isset($attributes['lang_code'])) {
            $this->setLanguage($attributes['lang_code']);
        }
    }

    public function setLanguage(string $langCode): self
    {
        $this->langCode = strtolower($langCode);

        try {
            $this->table = AppQyV1TableMaps::getWordTableName($this->langCode);
        } catch (\InvalidArgumentException $e) {
            throw new \InvalidArgumentException("Language code '{$this->langCode}' does not have word table");
        }

        return $this;
    }

    public function getLanguage(): ?string
    {
        return $this->langCode;
    }

    public static function forLanguage(string $langCode): self
    {
        $instance = new self();
        $instance->setLanguage($langCode);
        return $instance;
    }

    public static function countAll(string $langCode): int
    {
        return self::forLanguage($langCode)->count();
    }

    /**
     * Count words with translation/meaning
     * English: checks translation field (JSON not null)
     * Others: checks meaning_en field (not null)
     */
    public static function countByTranslation(string $langCode): int
    {
        $isEnglish = in_array(strtolower($langCode), ['en', 'english']);

        if ($isEnglish) {
            return self::forLanguage($langCode)
                ->whereNotNull('translation')
                ->where('translation', '!=', '')
                ->where('translation', '!=', '[]')
                ->count();
        } else {
            return self::forLanguage($langCode)
                ->whereNotNull('meaning_en')
                ->where('meaning_en', '!=', '')
                ->count();
        }
    }

    /**
     * Find word by exact match (case insensitive)
     */
    public static function findByWord(string $langCode, string $word)
    {
        return self::forLanguage($langCode)
            ->whereRaw('LOWER(word) = ?', [strtolower($word)])
            ->first();
    }

    /**
     * Legacy method for compatibility
     * @deprecated Use findByWord instead
     */
    public static function findByContent(string $langCode, string $content)
    {
        return self::findByWord($langCode, $content);
    }

    /**
     * Legacy method for compatibility
     * @deprecated Use findByWord instead
     */
    public static function findByMd5(string $langCode, string $md5)
    {
        return null;
    }

    /**
     * Find missing words in table
     */
    public static function findMissingEntries(string $langCode, array $wordArray): array
    {
        $existing = self::forLanguage($langCode)
            ->whereIn(DB::raw('LOWER(word)'), array_map('strtolower', $wordArray))
            ->pluck('word')
            ->map(function($w) { return strtolower($w); })
            ->toArray();

        $lowercaseWords = array_map('strtolower', $wordArray);
        $missing = array_diff($lowercaseWords, $existing);

        $result = [];
        foreach ($wordArray as $word) {
            if (in_array(strtolower($word), $missing)) {
                $result[] = $word;
            }
        }
        return $result;
    }

    /**
     * Create or update word entry
     */
    public static function createOrUpdate(string $langCode, array $data): self
    {
        if (!isset($data['word'])) {
            throw new \InvalidArgumentException("Word field is required");
        }

        $existing = self::findByWord($langCode, $data['word']);

        if ($existing) {
            $existing->update($data);
            return $existing;
        }

        $isEnglish = in_array(strtolower($langCode), ['en', 'english']);

        if ($isEnglish) {
            if (!isset($data['translation'])) {
                $data['translation'] = null;
            }
        } else {
            if (!isset($data['meaning_en'])) {
                $data['meaning_en'] = null;
            }
            if (!isset($data['meaning_zh'])) {
                $data['meaning_zh'] = null;
            }
        }

        if (!isset($data['ai_reviewed'])) {
            $data['ai_reviewed'] = false;
        }
        if (!isset($data['tts_generated'])) {
            $data['tts_generated'] = false;
        }

        $nextWordId = self::forLanguage($langCode)->max('word_id') + 1;
        if (!isset($data['word_id'])) {
            $data['word_id'] = $nextWordId;
        }

        $instance = self::forLanguage($langCode);
        $instance->fill($data);
        $instance->save();

        return $instance;
    }

    /**
     * Batch create or update words
     */
    public static function batchCreateOrUpdate(string $langCode, array $items): array
    {
        $results = [];
        foreach ($items as $item) {
            try {
                $results[] = self::createOrUpdate($langCode, $item);
            } catch (\Exception $e) {
                continue;
            }
        }
        return $results;
    }

    /**
     * Get words needing translation
     * English: translation is null or empty
     * Others: meaning_en is null or empty
     */
    public static function getWordsNeedingTranslation(string $langCode, int $limit = 100): \Illuminate\Database\Eloquent\Collection
    {
        $isEnglish = in_array(strtolower($langCode), ['en', 'english']);

        if ($isEnglish) {
            return self::forLanguage($langCode)
                ->where(function($query) {
                    $query->whereNull('translation')
                        ->orWhere('translation', '')
                        ->orWhere('translation', '[]');
                })
                ->inRandomOrder()
                ->limit($limit)
                ->get();
        } else {
            return self::forLanguage($langCode)
                ->where(function($query) {
                    $query->whereNull('meaning_en')
                        ->orWhere('meaning_en', '');
                })
                ->inRandomOrder()
                ->limit($limit)
                ->get();
        }
    }

    /**
     * Get words needing TTS
     */
    public static function getWordsNeedingTTS(string $langCode, int $limit = 100): \Illuminate\Database\Eloquent\Collection
    {
        return self::forLanguage($langCode)
            ->where('tts_generated', false)
            ->limit($limit)
            ->get();
    }

    /**
     * Check if word has translation
     */
    public function hasTranslation(): bool
    {
        $isEnglish = in_array(strtolower($this->langCode), ['en', 'english']);

        if ($isEnglish) {
            return !empty($this->translation) && $this->translation !== '[]';
        } else {
            return !empty($this->meaning_en);
        }
    }
}
