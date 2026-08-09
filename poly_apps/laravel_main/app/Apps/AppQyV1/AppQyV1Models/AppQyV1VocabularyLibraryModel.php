<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Utils\RunsModelTransactions;

/**
 * Vocabulary library - the ONLY membership store after the Wave A
 * consolidation (AppQyV1_2026_06_12_15000x migrations):
 *  - word_ids: flat ordered array of per-language dictionary ids
 *    (app_qy_v1_tts_cache_{lang}.id). Libraries are single-language; the
 *    dictionary table is derived from the `language` column.
 *  - cover_*: absorbed from the dropped vocabulary_covers table.
 */
class AppQyV1VocabularyLibraryModel extends Model
{
    use HasFactory, RunsModelTransactions;

    /**
     * Canonical language name <-> code map. Library rows store the full
     * lowercase name in `language` ('english'); dictionary tables and
     * group_words/user_word_progress rows use the 2-letter code ('en').
     */
    public const LANGUAGE_NAME_TO_CODE = [
        'english' => 'en',
        'japanese' => 'ja',
        'korean' => 'ko',
        'vietnamese' => 'vi',
        'lao' => 'lo',
        'chinese' => 'zh',
    ];

    protected $appKey = AppKeys::APPQYV1;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_libraries');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'name',
        'description',
        'language',
        'total_words',
        'is_public',
        'owner_user_id',
        'source',
        'difficulty_level',
        'category',
        'image_url',
        'is_recommended',
        'tags',
        'word_ids',
        'cover_filename',
        'cover_status',
        'cover_prompt',
        'cover_priority',
        'cover_attempts',
        'cover_error_message',
        'cover_width',
        'cover_height',
        'cover_last_requested_at',
        'cover_last_generated_at',
        'cover_started_at',
        'cover_finished_at',
        'cover_provider',
        'cover_model',
        'cover_latency_ms',
        'cover_mcp_submitted_at',
        'assist_claimed_at',
        'assist_claimed_by',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'is_recommended' => 'boolean',
        'tags' => 'array',
        'word_ids' => 'array',
        'cover_priority' => 'integer',
        'cover_attempts' => 'integer',
        'cover_width' => 'integer',
        'cover_height' => 'integer',
        'cover_last_requested_at' => 'datetime',
        'cover_last_generated_at' => 'datetime',
        'cover_started_at' => 'datetime',
        'cover_finished_at' => 'datetime',
        'cover_latency_ms' => 'integer',
        'cover_mcp_submitted_at' => 'datetime',
        'assist_claimed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** Map a full language name ('english') to its 2-letter code ('en'). */
    public static function languageNameToCode(string $language): ?string
    {
        $key = strtolower(trim($language));
        if (isset(self::LANGUAGE_NAME_TO_CODE[$key])) {
            return self::LANGUAGE_NAME_TO_CODE[$key];
        }
        // Already a known code ('en') - pass through.
        if (in_array($key, self::LANGUAGE_NAME_TO_CODE, true)) {
            return $key;
        }
        return null;
    }

    /** Map a 2-letter code ('en') to the canonical full name ('english'). */
    public static function languageCodeToName(string $code): ?string
    {
        $key = strtolower(trim($code));
        $flipped = array_flip(self::LANGUAGE_NAME_TO_CODE);
        if (isset($flipped[$key])) {
            return $flipped[$key];
        }
        // Already a known full name - pass through.
        if (isset(self::LANGUAGE_NAME_TO_CODE[$key])) {
            return $key;
        }
        return null;
    }

    /** 2-letter dictionary language code for this library row. */
    public function languageCode(): ?string
    {
        return self::languageNameToCode((string) $this->language);
    }

    /** word_ids as a plain int array ([] when unset/never converted). */
    public function getWordIdsArray(): array
    {
        $ids = $this->word_ids;
        if (!is_array($ids)) {
            return [];
        }
        return array_map('intval', $ids);
    }

    /**
     * Batch-fetch a page of this library's dictionary rows.
     *
     * Slices word_ids ($offset/$limit), runs ONE whereIn on the library
     * language's tts_cache_{lang} table and returns the rows re-ordered to
     * match the slice order (whereIn does not preserve order). Ids missing
     * from the dictionary (should not happen post-conversion) are skipped.
     *
     * @return Collection<int, AppQyV1LangDictionaryModel>
     */
    public function dictionaryWords(int $offset, int $limit): Collection
    {
        $slice = array_slice($this->getWordIdsArray(), $offset, $limit);
        if (empty($slice)) {
            return new Collection();
        }

        $langCode = $this->languageCode();
        if ($langCode === null) {
            return new Collection();
        }

        $rows = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->whereIn('id', $slice)
            ->get()
            ->keyBy('id');

        $ordered = new Collection();
        foreach ($slice as $id) {
            if ($rows->has($id)) {
                $ordered->push($rows->get($id));
            }
        }
        return $ordered;
    }

    public function scopePublic($query)
    {
        return $query->where('is_public', true);
    }

    public function scopeForLanguage($query, ?string $language)
    {
        if ($language) {
            $query->where('language', $language);
        }

        return $query;
    }

    public function scopeSearchTextInsensitive($query, string $search)
    {
        $needle = '%' . strtolower($search) . '%';

        return $query->where(function ($builder) use ($needle) {
            $builder->whereRaw('LOWER(name) LIKE ?', [$needle])
                ->orWhereRaw('LOWER(description) LIKE ?', [$needle]);
        });
    }

    public static function publicLanguageAggregates(?string $language = null)
    {
        return self::query()
            ->public()
            ->forLanguage($language)
            ->selectRaw('language, SUM(total_words) as total_words, COUNT(*) as libraries_count')
            ->groupBy('language')
            ->orderBy('language')
            ->get();
    }

    public static function promotePendingCovers(array $ids, bool $all): array
    {
        return self::runInTransaction(static function () use ($ids, $all): array {
            $head = self::query()
                ->orderByDesc('cover_priority')
                ->lockForUpdate()
                ->first(['cover_priority']);
            $ticket = (int) ($head->cover_priority ?? 0) + 1;
            $query = self::query()->whereIn('cover_status', ['pending', 'retry', 'failed']);

            if (!$all) {
                $query->whereIn('id', $ids);
            }

            $promoted = $query->update([
                'cover_priority' => $ticket,
                'cover_status' => 'pending',
                'assist_claimed_by' => null,
                'assist_claimed_at' => null,
            ]);

            return ['priority' => $ticket, 'promoted' => $promoted];
        });
    }

    /**
     * Get groups that use this library (many-to-many)
     */
    public function groups()
    {
        return $this->belongsToMany(
            AppQyV1WordGroupModel::class,
            AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries'),
            'library_id',
            'group_id',
            'id',
            'id'
        )->withTimestamps()
         ->withPivot('added_at');
    }
}
