<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\BindsAppQyV1LanguageTable;
use Illuminate\Support\Collection;

/**
 * Per-language phrase store {prefix}_phrases_{lang} (docs_fix/DESIGN_PHRASE_PIPELINE.md §3).
 *
 * Bound dynamically; obtain an instance via AppQyV1LangPhraseModel::for($lang)
 * (or a query via onLang($lang)). Deduped on content_id; meaning/audio are
 * fill-missing (never clobbered). Audio gap: AppQyV1MediaGaps::PHRASE_AUDIO
 * (work-lease lane phrase_audio over the tts_* columns).
 */
class AppQyV1LangPhraseModel extends AppQyV1Model
{
    use BindsAppQyV1LanguageTable;

    /** Row origin: extracted by AI from a sentence, or created by an audio report for an unknown phrase. */
    public const ORIGIN_AI = 'ai';
    public const ORIGIN_ADHOC = 'adhoc';

    protected $fillable = [
        'content_id',
        'text',
        'language',
        'meaning',
        'sentence_count',
        'origin',
        'source_model',
        'audio',
        'has_audio',
        'audio_files',
        'tts_status',
        'tts_attempts',
        'tts_error',
        'tts_locked_at',
        'tts_locked_by',
        'tts_lease_id',
        'tts_lease_expires_at',
        'tts_priority',
        'tts_requested_at',
        'tts_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'has_audio' => 'boolean',
            'sentence_count' => 'integer',
            'audio_files' => 'array',
            'tts_attempts' => 'integer',
            'tts_priority' => 'integer',
            'tts_locked_at' => 'datetime',
            'tts_lease_expires_at' => 'datetime',
            'tts_requested_at' => 'datetime',
            'tts_completed_at' => 'datetime',
        ];
    }

    protected static function resolveLanguageTable(string $language): string
    {
        return AppQyV1TableMaps::getPhraseTableName(AppQyV1TableMaps::normalizeLangCode($language));
    }

    public static function findByContentId(string $lang, string $contentId): ?self
    {
        return self::onLang($lang)->where('content_id', $contentId)->first();
    }

    public static function rowsByContentIds(string $lang, array $contentIds): Collection
    {
        if ($contentIds === [] || !self::tableExists($lang)) {
            return new Collection();
        }

        return self::onLang($lang)
            ->whereIn('content_id', array_values(array_unique($contentIds)))
            ->get();
    }

    /** Phrases still lacking audio (AppQyV1MediaGaps::PHRASE_AUDIO). */
    public static function pendingAudioCount(string $lang): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->whereRaw('(' . AppQyV1MediaGaps::PHRASE_AUDIO . ')')
            ->count();
    }

    /** Languages whose phrase table exists (the phrase_audio lane languages). */
    public static function existingLanguages(): array
    {
        $existing = array_fill_keys((new static())->getConnection()->getSchemaBuilder()->getTableListing(null, false), true);

        return array_values(array_filter(
            AppQyV1TableMaps::getSupportedLanguages(),
            static fn (string $language): bool => isset($existing[self::resolveLanguageTable($language)])
        ));
    }
}
