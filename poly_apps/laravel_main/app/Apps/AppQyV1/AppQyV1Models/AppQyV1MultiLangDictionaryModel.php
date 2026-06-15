<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * @deprecated Superseded by AppQyV1LangDictionaryModel. Retained as a thin
 * backward-compatibility SHIM over the single canonical multi-language table
 * {prefix}_tts_cache_{lang}. setLanguage() binds to that table; legacy column
 * names (word/word_id/translation/meaning_en/meaning_zh/sample_images/
 * tts_generated/ai_reviewed/pronunciation) are exposed as read accessors
 * mapped onto the unified schema (content/md5/translations/has_translation/
 * has_audio/image_files/phonetic). New code MUST use AppQyV1LangDictionaryModel.
 */
class AppQyV1MultiLangDictionaryModel extends Model
{
    use HasFactory;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;
    protected $langCode;

    // Unified canonical schema (tts_cache_{lang}); legacy keys are NOT fillable.
    protected $fillable = [
        'content',
        'md5',
        'translations',
        'has_translation',
        'translation_provider',
        'phonetic',
        'us_phonetic',
        'uk_phonetic',
        'tts_files',
        'tts_provider',
        'has_audio',
        'image_files',
        'image_provider',
        'word_details',
        'is_exist_local',
        'has_operations',
        'query_count',
        'last_modified',
        'last_query_time',
    ];

    protected $casts = [
        'translations' => 'json',
        'tts_files' => 'json',
        'image_files' => 'json',
        'word_details' => 'json',
        'has_translation' => 'boolean',
        'has_audio' => 'boolean',
        'is_exist_local' => 'boolean',
        'has_operations' => 'boolean',
        'query_count' => 'integer',
        'last_modified' => 'datetime',
        'last_query_time' => 'datetime',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);

        if (isset($attributes['lang_code'])) {
            $this->setLanguage($attributes['lang_code']);
        }
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function setLanguage(string $langCode): self
    {
        $this->langCode = strtolower($langCode);
        // getWordTableName() is now an alias resolving to the canonical
        // tts_cache_{lang} table (names normalized to codes).
        $this->table = AppQyV1TableMaps::getWordTableName($this->langCode);
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

    // ---- Backward-compatibility read accessors (legacy column names) -------

    public function getWordAttribute()
    {
        return $this->attributes['content'] ?? null;
    }

    public function getTranslationAttribute()
    {
        // Legacy English callers expected the decoded translation payload.
        return $this->translations;
    }

    public function getMeaningEnAttribute()
    {
        $t = $this->translations;
        if (is_array($t) && isset($t['en'])) {
            return $t['en'];
        }
        return null;
    }

    public function getMeaningZhAttribute()
    {
        $t = $this->translations;
        if (is_array($t) && isset($t['zh'])) {
            return $t['zh'];
        }
        return null;
    }

    public function getPronunciationAttribute()
    {
        return $this->attributes['phonetic'] ?? null;
    }

    public function getSampleImagesAttribute()
    {
        return $this->image_files;
    }

    public function getTtsGeneratedAttribute(): bool
    {
        return (bool) ($this->attributes['has_audio'] ?? false);
    }

    public function getAiReviewedAttribute(): bool
    {
        return (bool) ($this->attributes['has_translation'] ?? false);
    }

    // ---- Lookups (canonical md5(content) key) -----------------------------

    public static function findByWord(string $langCode, string $word)
    {
        return self::forLanguage($langCode)
            ->where('md5', md5($word))
            ->first();
    }

    public static function findByContent(string $langCode, string $content)
    {
        return self::findByWord($langCode, $content);
    }

    public static function findByMd5(string $langCode, string $md5)
    {
        return self::forLanguage($langCode)
            ->where('md5', $md5)
            ->first();
    }

    public static function countAll(string $langCode): int
    {
        return self::forLanguage($langCode)->count();
    }

    public static function countByTranslation(string $langCode): int
    {
        return self::forLanguage($langCode)
            ->where('has_translation', true)
            ->count();
    }

    /**
     * Words present in $wordArray but absent from the table (by md5(content)).
     * Returns the original-case words.
     */
    public static function findMissingEntries(string $langCode, array $wordArray): array
    {
        $byMd5 = [];
        foreach ($wordArray as $word) {
            $byMd5[md5($word)] = $word;
        }
        if (empty($byMd5)) {
            return [];
        }

        $existing = self::forLanguage($langCode)
            ->whereIn('md5', array_keys($byMd5))
            ->pluck('md5')
            ->all();

        $missing = [];
        foreach (array_diff(array_keys($byMd5), $existing) as $md5) {
            $missing[] = $byMd5[$md5];
        }
        return $missing;
    }

    /**
     * Create or enrich an entry on the unified table. Accepts legacy keys
     * ('word','translation','meaning_en','meaning_zh','tts_generated',
     * 'ai_reviewed') and maps them onto the unified schema.
     */
    public static function createOrUpdate(string $langCode, array $data): self
    {
        $normalized = self::normalizeCreateOrUpdateData($data);
        $content = $normalized['content'];
        $md5 = $normalized['md5'];
        $payload = $normalized['payload'];

        $existing = self::forLanguage($langCode)->where('md5', $md5)->first();

        if ($existing) {
            if (!empty($payload)) {
                $existing->fill($payload);
                $existing->save();
            }
            return $existing;
        }

        $instance = self::forLanguage($langCode);
        $instance->content = $content;
        $instance->md5 = $md5;
        if (!isset($payload['has_translation'])) {
            $instance->has_translation = false;
        }
        if (!isset($payload['has_audio'])) {
            $instance->has_audio = false;
        }
        $instance->query_count = 0;
        $instance->fill($payload);
        $instance->save();

        return $instance;
    }

    /**
     * Map one (possibly legacy-keyed) input row onto the unified schema, exactly
     * as createOrUpdate() does. Returns the resolved content, its md5 and the
     * partial $payload of provided fields (absent input keys are left out so the
     * caller only overwrites columns that were actually supplied). Throws on a
     * missing content/word, matching createOrUpdate().
     */
    private static function normalizeCreateOrUpdateData(array $data): array
    {
        $content = null;
        if (isset($data['content'])) {
            $content = $data['content'];
        } elseif (isset($data['word'])) {
            $content = $data['word'];
        }

        if ($content === null || $content === '') {
            throw new \InvalidArgumentException("content/word field is required");
        }

        $md5 = md5($content);

        $translations = [];
        if (isset($data['translations']) && is_array($data['translations'])) {
            $translations = $data['translations'];
        }
        if (isset($data['translation'])) {
            if (is_array($data['translation'])) {
                $translations = array_merge($translations, $data['translation']);
            } else {
                $translations['en'] = $data['translation'];
            }
        }
        if (isset($data['meaning_en'])) {
            $translations['en'] = $data['meaning_en'];
        }
        if (isset($data['meaning_zh'])) {
            $translations['zh'] = $data['meaning_zh'];
        }

        $payload = [];
        if (!empty($translations)) {
            $payload['translations'] = $translations;
            $payload['has_translation'] = true;
        }
        if (isset($data['us_phonetic'])) {
            $payload['us_phonetic'] = $data['us_phonetic'];
        }
        if (isset($data['uk_phonetic'])) {
            $payload['uk_phonetic'] = $data['uk_phonetic'];
        }
        if (isset($data['pronunciation'])) {
            $payload['phonetic'] = $data['pronunciation'];
        }
        if (isset($data['phonetic'])) {
            $payload['phonetic'] = $data['phonetic'];
        }
        if (isset($data['tts_generated'])) {
            $payload['has_audio'] = (bool) $data['tts_generated'];
        }
        if (isset($data['has_audio'])) {
            $payload['has_audio'] = (bool) $data['has_audio'];
        }

        return [
            'content' => $content,
            'md5' => $md5,
            'payload' => $payload,
        ];
    }

    /**
     * Batched create-or-update over the unified tts_cache_{lang} table.
     *
     * Semantics are OVERWRITE-of-supplied-fields (mirrors createOrUpdate(): the
     * translations column is set from the input, never merged into the existing
     * JSON), so the batch is safe to split into one existence probe plus bulk
     * writes without losing data:
     *   1. ONE whereIn('md5', ...) replaces the per-item findByMd5 SELECT.
     *   2. New rows are bulk-inserted via insertOrIgnore. md5 is UNIQUE on the
     *      formal table but only indexed on staging/legacy tables, so a keyed
     *      Eloquent upsert() would not reliably dedup everywhere; insertOrIgnore
     *      degrades safely on both. JSON columns are json_encode()d because raw
     *      insert bypasses the model casts, and timestamps are set explicitly.
     *   3. Existing rows keep the per-row fill()->save() so the cast/serialize
     *      pipeline and partial-overwrite behavior is byte-for-byte unchanged.
     *
     * Returns one entry per successfully created-or-updated md5 so callers that
     * read count($results) (added count) stay correct.
     */
    public static function batchCreateOrUpdate(string $langCode, array $items): array
    {
        $results = [];
        $byMd5 = [];

        // Normalize once; last write wins per md5 within the batch (a duplicate
        // word later in the list overrides the earlier one, as the sequential
        // createOrUpdate loop did). Invalid rows are skipped like the old catch.
        foreach ($items as $item) {
            try {
                $normalized = self::normalizeCreateOrUpdateData($item);
            } catch (\Throwable $e) {
                continue;
            }
            $byMd5[$normalized['md5']] = $normalized;
        }

        if (empty($byMd5)) {
            return $results;
        }

        $allMd5 = array_keys($byMd5);

        $existing = self::forLanguage($langCode)
            ->whereIn('md5', $allMd5)
            ->get()
            ->keyBy('md5');

        $now = now();
        $newRows = [];

        foreach ($byMd5 as $md5 => $normalized) {
            $payload = $normalized['payload'];
            $row = $existing->get($md5);

            if ($row) {
                if (!empty($payload)) {
                    $row->fill($payload);
                    $row->save();
                }
                $results[] = $row;
                continue;
            }

            // Build a raw insert row. fill()-equivalent defaults are applied for a
            // fresh row; JSON columns are encoded because insert() skips casts.
            $insert = [
                'content' => $normalized['content'],
                'md5' => $md5,
                'has_translation' => $payload['has_translation'] ?? false,
                'has_audio' => $payload['has_audio'] ?? false,
                'query_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            if (array_key_exists('translations', $payload)) {
                $insert['translations'] = json_encode($payload['translations']);
            }
            if (array_key_exists('us_phonetic', $payload)) {
                $insert['us_phonetic'] = $payload['us_phonetic'];
            }
            if (array_key_exists('uk_phonetic', $payload)) {
                $insert['uk_phonetic'] = $payload['uk_phonetic'];
            }
            if (array_key_exists('phonetic', $payload)) {
                $insert['phonetic'] = $payload['phonetic'];
            }
            $newRows[] = $insert;
        }

        if (!empty($newRows)) {
            $model = self::forLanguage($langCode);
            // insertOrIgnore so a concurrent insert (or a non-unique legacy table
            // racing this batch) never throws; missed inserts are simply skipped.
            $model->newQuery()->insertOrIgnore($newRows);
            foreach ($newRows as $insert) {
                $results[] = $insert;
            }
        }

        return $results;
    }

    public static function getWordsNeedingTranslation(string $langCode, int $limit = 100): \Illuminate\Database\Eloquent\Collection
    {
        // Order by the indexed query_count instead of inRandomOrder()
        // (ORDER BY RANDOM()), which forced a full scan + sort of the untranslated
        // subset on every 60s background scan, per language. Prioritizing the
        // most-queried words is both cheaper (uses the query_count index) and more
        // useful than a random pick.
        // Skip words a third-party check has marked invalid (is_valid=false):
        // a word Bing/online dictionaries cannot resolve must never be re-enqueued
        // for translation. Mirrors the TTS path
        // (AppQyV1DictionaryTTSCoordinator::pendingWordsQuery already filters
        // is_valid=true). Rows stay valid by default, so this only excludes
        // explicitly-rejected words.
        return self::forLanguage($langCode)
            ->where('has_translation', false)
            ->where('is_valid', true)
            ->orderBy('query_count', 'desc')
            ->limit($limit)
            ->get();
    }

    public static function getWordsNeedingTTS(string $langCode, int $limit = 100): \Illuminate\Database\Eloquent\Collection
    {
        return self::forLanguage($langCode)
            ->where('has_audio', false)
            ->limit($limit)
            ->get();
    }

    public function hasTranslation(): bool
    {
        return (bool) ($this->attributes['has_translation'] ?? false);
    }

    /**
     * Backward-compat: mirrors AppQyV1LangDictionaryModel::incrementQueryCount().
     * Live callers (TTS/translation cache hits) invoke this on shim instances.
     */
    public function incrementQueryCount(): void
    {
        // One UPDATE (was two) — bump the counter and stamp the time together.
        $this->increment('query_count', 1, ['last_query_time' => now()]);
    }
}
