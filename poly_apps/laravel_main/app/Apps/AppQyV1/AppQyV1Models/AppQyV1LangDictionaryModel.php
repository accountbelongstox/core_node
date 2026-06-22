<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Multi-Language Dictionary Model
 *
 * Operates on language-specific dictionary tables: {prefix}_{lang}_dictionaries
 * Used for TTS caching, translations, and word metadata
 * Table prefix is obtained from key center (AppTablePrefixServiceProvider)
 */
class AppQyV1LangDictionaryModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;
    protected $langCode;

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
        'is_valid',
        'validity_checked_at',
        'validity_source',
        'validity_note',
        'query_count',
        'last_modified',
        'last_query_time',
        // TTS generation process state (queue-less coordination — the former
        // tts_queue table's job, carried on the canonical row).
        'tts_status',
        'tts_attempts',
        'tts_error',
        'tts_locked_at',
        'tts_locked_by',
        'tts_priority',
        'tts_requested_at',
        'tts_completed_at',
        // Word-image generation process state (queue-less coordination — the
        // image queue's job, carried on the canonical row; mirrors tts_*).
        'image_status',
        'image_priority',
        'image_locked_at',
        'image_locked_by',
        'image_attempts',
        'image_requested_at',
        'image_completed_at',
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
        'is_valid' => 'boolean',
        'validity_checked_at' => 'datetime',
        'query_count' => 'integer',
        'last_modified' => 'datetime',
        'last_query_time' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'tts_attempts' => 'integer',
        'tts_priority' => 'integer',
        'tts_locked_at' => 'datetime',
        'tts_requested_at' => 'datetime',
        'tts_completed_at' => 'datetime',
        'image_attempts' => 'integer',
        'image_priority' => 'integer',
        'image_locked_at' => 'datetime',
        'image_requested_at' => 'datetime',
        'image_completed_at' => 'datetime',
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
        // Resolve through the canonical table map so reads hit the same table
        // the dictionary importer populates (app_qy_v1_tts_cache_{lang}).
        $this->table = AppQyV1TableMaps::getDictionaryTableName($this->langCode);
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

    /**
     * Cache TTL (seconds) for the per-language dashboard dictionary metrics.
     * Short window so even paths that bypass explicit invalidation self-heal.
     */
    public const METRICS_CACHE_TTL = 300;

    /**
     * Canonical cache key for the per-language dictionary metrics aggregate
     * surfaced on the vocabulary dashboard. Keyed by the 2-letter language code
     * so every read/write path shares one definition.
     */
    public static function metricsCacheKey(string $langCode): string
    {
        return 'appqyv1:dict_metrics:' . strtolower($langCode);
    }

    /**
     * Canonical cache key for the consolidated per-language dictionary stats
     * aggregate used by the system-initialization dashboard. Shares the same
     * language-code keying so it can be invalidated alongside dict_metrics.
     */
    public static function sysInitStatsCacheKey(string $langCode): string
    {
        return 'appqyv1:sysinit_stats:dict:' . strtolower($langCode);
    }

    /**
     * Invalidate the cached dictionary metrics for a language. Call after any
     * write that changes a metric-relevant column (row count, has_translation,
     * translations, has_audio, image_files, is_valid, validity_checked_at).
     * Safe to call with either a language name or a 2-letter code.
     */
    public static function forgetMetricsCache(string $langCode): void
    {
        Cache::forget(self::metricsCacheKey($langCode));
        // The system-init dashboard aggregate is derived from the same table,
        // so it must be dropped on the same writes.
        Cache::forget(self::sysInitStatsCacheKey($langCode));
        // The summary/audio-size dashboards roll up the same per-language data and
        // are cached separately (5 min / 30 min); drop them too so a dictionary
        // write isn't masked by a stale summary for up to their TTL.
        Cache::forget('appqyv1_system_statistics_summary');
        Cache::forget('appqyv1_audio_file_size_stats');
    }

    /**
     * Batch-resolve dictionary rows for (word_id, language_code) reference
     * pairs - the canonical shape referenced by vocabulary_libraries.word_ids
     * and the group_word_progress JSON map (the shared resolver every
     * word-ref consumer goes through).
     *
     * One whereIn query per language (no per-row queries). Returns a map
     * keyed "{lang}:{id}" => dictionary row; pairs whose id is missing from
     * their dictionary are simply absent from the result.
     *
     * @param iterable<array{word_id:int|string, language_code:string}> $refs
     * @return array<string, self>
     */
    public static function resolveWordRefs(iterable $refs): array
    {
        $idsByLang = [];
        foreach ($refs as $ref) {
            $lang = strtolower((string) $ref['language_code']);
            $idsByLang[$lang][(int) $ref['word_id']] = true;
        }

        $resolved = [];
        foreach ($idsByLang as $lang => $idSet) {
            $ids = array_keys($idSet);
            foreach (array_chunk($ids, 1000) as $chunk) {
                $rows = self::forLanguage($lang)->whereIn('id', $chunk)->get();
                foreach ($rows as $row) {
                    $resolved[$lang . ':' . $row->id] = $row;
                }
            }
        }

        return $resolved;
    }

    public static function findByMd5(string $langCode, string $md5)
    {
        return self::forLanguage($langCode)
            ->where('md5', $md5)
            ->first();
    }

    public static function findByContent(string $langCode, string $content)
    {
        $md5 = md5($content);
        return self::findByMd5($langCode, $md5);
    }

    public static function createOrFind(string $langCode, string $content): self
    {
        $md5 = md5($content);

        $existing = self::findByMd5($langCode, $md5);
        if ($existing) {
            return $existing;
        }

        $instance = self::forLanguage($langCode);
        $instance->content = $content;
        $instance->md5 = $md5;
        $instance->has_translation = false;
        $instance->query_count = 0;
        $instance->save();

        // New row changes the dictionary count -> invalidate metrics.
        self::forgetMetricsCache($langCode);

        return $instance;
    }

    public static function updateWord(string $langCode, string $md5, array $data): void
    {
        self::forLanguage($langCode)
            ->where('md5', $md5)
            ->update(array_merge($data, ['updated_at' => now()]));

        self::forgetMetricsCache($langCode);
    }

    /**
     * Explicitly record a third-party validity check for a single word.
     *
     * Validity is externally asserted: rows stay valid by default and only an
     * explicit check (typically a client that verifies the word online) can mark
     * one invalid. Returns true when a matching row was updated.
     */
    public static function markValidity(string $langCode, string $md5, bool $isValid, ?string $source = null, ?string $note = null): bool
    {
        $affected = self::forLanguage($langCode)
            ->where('md5', $md5)
            ->update([
                'is_valid' => $isValid,
                'validity_checked_at' => now(),
                'validity_source' => $source,
                'validity_note' => $note,
                'updated_at' => now(),
            ]);

        if ($affected > 0) {
            self::forgetMetricsCache($langCode);
        }

        return $affected > 0;
    }

    /**
     * Restrict to "sentence" rows: dictionary entries whose content length
     * falls in the sentence range (50 < LENGTH(content) < 500).
     *
     * LENGTH() has no native query-builder equivalent, so the comparison stays
     * in whereRaw. LENGTH() behaves identically on sqlite and pgsql (both count
     * characters for text), so this scope is cross-DB safe.
     */
    public function scopeSentenceLength($query)
    {
        return $query->whereRaw('LENGTH(content) > 50')
            ->whereRaw('LENGTH(content) < 500');
    }

    /** Only words explicitly marked invalid by a third-party check. */
    public function scopeInvalid($query)
    {
        return $query->where('is_valid', false);
    }

    /** Words that are valid (default state, i.e. not explicitly invalid). */
    public function scopeValid($query)
    {
        return $query->where('is_valid', true);
    }

    /** Words a third-party client has not yet checked. */
    public function scopeValidityUnchecked($query)
    {
        return $query->whereNull('validity_checked_at');
    }

    public function incrementQueryCount(): void
    {
        // One UPDATE statement: Eloquent's increment() applies the extra columns
        // in the same query, so the counter bump and the last_query_time stamp no
        // longer cost two separate round-trips per word lookup.
        $this->increment('query_count', 1, ['last_query_time' => now()]);
    }

    public function addTTSFile(string $path, string $speedKey = 'p0pct', string $type = 'word'): void
    {
        $ttsFiles = $this->tts_files ?? [];

        $ttsFiles[] = [
            'path' => $path,
            'speed_key' => $speedKey,
            'type' => $type,
            'provider' => 'edge-tts',
            'created_at' => now()->toDateTimeString(),
        ];

        $this->tts_files = $ttsFiles;
        $this->tts_provider = 'edge-tts';
        $this->save();
    }

    public function getTTSFile(string $speedKey = 'p0pct'): ?array
    {
        if (empty($this->tts_files)) {
            return null;
        }

        foreach ($this->tts_files as $ttsFile) {
            if (isset($ttsFile['speed_key']) && $ttsFile['speed_key'] === $speedKey) {
                return $ttsFile;
            }
        }

        return null;
    }

    public function hasTTSFile(string $speedKey = 'p0pct'): bool
    {
        return $this->getTTSFile($speedKey) !== null;
    }

    public static function getWordsWithoutTTS(string $langCode, int $limit = 20, bool $skipQueued = true): \Illuminate\Database\Eloquent\Collection
    {
        // Queue-less coordination: "queued" now means an unstale processing
        // claim on the row itself (tts_status/tts_locked_at) — the old
        // tts_queue cross-check is gone with the table.
        $query = self::forLanguage($langCode)
            ->where('has_audio', false);

        if ($skipQueued) {
            $staleBefore = now()->subMinutes(10);
            $query->where(function ($q) use ($staleBefore) {
                $q->whereNull('tts_status')
                    ->orWhere('tts_status', 'pending')
                    ->orWhere(function ($qq) use ($staleBefore) {
                        $qq->where('tts_status', 'processing')
                            ->where('tts_locked_at', '<', $staleBefore);
                    });
            });
        }

        return $query->orderBy('query_count', 'desc')
            ->limit($limit)
            ->get();
    }
}
