<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Utils\RunsModelTransactions;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Persistent positional + cross-language CORRESPONDENCE index for every source
 * (book|subtitle|document|article). Does NOT store sentence text — text lives
 * only in sentences_{lang}. One row per (source, grain, seq) slot:
 *   - chapter_index   — order (which chapter this slot belongs to)
 *   - corr_id         — cross-language correspondence group id
 *   - primary_language — the source's primary language code
 *   - lang_content_ids {code: content_id|null} — the per-language library refs
 *                       into sentences_{lang} (null = 留空, empty correspondence)
 *   - timing (seg_index / sub_idx / start_sec / end_sec) — for subtitles
 * Both grains are kept: 'cue' (1 source line/cue) and 'sentence' (merged).
 * Unique on (source_type, source_key, grain, seq).
 *
 * This is what powers per-sentence multi-language reading, per-sentence audio
 * status, WordNew joins, and reverse lookup — NOT recoverable cheaply from the
 * source's raw original (especially multi-track subtitle time alignment), so the
 * table is kept. The legacy `sentence_id` column was REMOVED (Books v3.1 §3.3):
 * the per-language link is carried entirely by lang_content_ids (content_id refs).
 */
class AppQyV1SourceSentenceModel extends AppQyV1Model
{
    use RunsModelTransactions;

    protected ?string $appTableSuffix = 'source_sentences';

    protected $fillable = [
        'source_type',
        'source_key',
        'grain',
        'seq',
        'seg_index',
        'sub_idx',
        'start_sec',
        'end_sec',
        'metadata',
        // Books v3 correspondence anchor (spec §3.3).
        'chapter_index',
        'corr_id',
        'primary_language',
        'lang_content_ids',
    ];

    protected function casts(): array
    {
        return [
            'seq' => 'integer',
            'seg_index' => 'integer',
            'sub_idx' => 'integer',
            'start_sec' => 'float',
            'end_sec' => 'float',
            'metadata' => 'array',
            'chapter_index' => 'integer',
            'lang_content_ids' => 'array',
        ];
    }

    /**
     * Resolve the per-language sentence row for this slot from the per-language
     * sentence table ({prefix}_sentences_{lang}) via lang_content_ids[$lang].
     * Returns null when this slot has no correspondence for $lang.
     */
    public function langSentence(string $lang): ?AppQyV1LangSentenceModel
    {
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        $map = $this->lang_content_ids;
        if (!is_array($map) || empty($map[$lang])) {
            return null;
        }
        $contentId = (string) $map[$lang];
        return AppQyV1LangSentenceModel::onLang($lang)->where('content_id', $contentId)->first();
    }

    /**
     * Resolve the per-language chapter row for this slot from the per-language
     * chapter table ({prefix}_chapters_{lang}) by (source_type, source_key,
     * chapter_index). Returns null when that language has no chapter row (留空).
     */
    public function langChapter(string $lang): ?AppQyV1LangChapterModel
    {
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        return AppQyV1LangChapterModel::onLang($lang)
            ->where('source_type', $this->source_type)
            ->where('source_key', $this->source_key)
            ->where('chapter_index', (int) $this->chapter_index)
            ->first();
    }

    public static function orderedSourcePage(
        string $sourceKey,
        string $grain,
        ?int $chapterIndex,
        int $perPage
    ): LengthAwarePaginator {
        $query = self::query()->where('source_key', $sourceKey);

        if ($grain !== 'all') {
            $query->where('grain', $grain);
        }
        if ($chapterIndex !== null) {
            $query->where('chapter_index', $chapterIndex);
        }

        return $query->orderBy('grain')->orderBy('seq')->paginate($perPage);
    }

    /**
     * Keyset page of one source grain ordered by (seq, id): rows strictly after
     * the (afterSeq, afterId) cursor, at most $limit rows. No OFFSET and no
     * COUNT — each page costs one bounded index range scan however deep the
     * walk is (pycore audio-orchestration full sentence sync).
     */
    public static function keysetSourcePage(
        string $sourceKey,
        string $grain,
        int $afterSeq,
        int $afterId,
        int $limit
    ): Collection {
        return self::query()
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->where(static function ($query) use ($afterSeq, $afterId): void {
                $query->where('seq', '>', $afterSeq)
                    ->orWhere(static function ($tie) use ($afterSeq, $afterId): void {
                        $tie->where('seq', $afterSeq)->where('id', '>', $afterId);
                    });
            })
            ->orderBy('seq')
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public static function languageSample(string $sourceType, string $sourceKey): ?self
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->whereNotNull('lang_content_ids')
            ->first();
    }

    public static function countForSource(string $sourceType, string $sourceKey): int
    {
        return self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey)->count();
    }

    public static function deleteForSource(string $sourceType, string $sourceKey): int
    {
        return self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey)->delete();
    }

    public static function deleteForSources(string $sourceType, array $sourceKeys): int
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->whereIn('source_key', array_values(array_unique($sourceKeys)))
            ->delete();
    }

    public static function sourceGrainPage(
        string $sourceType,
        string $sourceKey,
        int $start,
        int $limit
    ): array {
        $base = self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey);
        $counts = (clone $base)
            ->whereIn('grain', ['sentence', 'cue'])
            ->groupBy('grain')
            ->selectRaw('grain, COUNT(*) AS total')
            ->pluck('total', 'grain');
        $sentenceTotal = (int) ($counts->get('sentence') ?? 0);
        $grain = $sentenceTotal > 0 ? 'sentence' : 'cue';
        $total = $sentenceTotal > 0 ? $sentenceTotal : (int) ($counts->get('cue') ?? 0);

        $rows = (clone $base)
            ->where('grain', $grain)
            ->orderBy('seq')
            ->skip($start)
            ->take($limit)
            ->get();

        return ['grain' => $grain, 'total' => $total, 'rows' => $rows];
    }

    public static function orderedStudySlots(string $sourceType, string $sourceKey): array
    {
        $query = self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey);
        $grain = (clone $query)->where('grain', 'sentence')->exists() ? 'sentence' : 'cue';

        return [
            'grain' => $grain,
            'rows' => $query->where('grain', $grain)->orderBy('seq')->get(),
        ];
    }

    public static function studySlotsBetween(
        string $sourceType,
        string $sourceKey,
        string $grain,
        int $start,
        int $end
    ): Collection {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->whereBetween('seq', [$start, $end])
            ->orderBy('seq')
            ->get();
    }

    public static function findSlot(string $sourceType, string $sourceKey, string $grain, int $sequence): ?self
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->where('seq', $sequence)
            ->first();
    }

    /**
     * Slot rows of one source and grain at the given positions (one query).
     *
     * @param array<int,int> $sequences
     */
    public static function slotsAt(string $sourceType, string $sourceKey, string $grain, array $sequences): \Illuminate\Database\Eloquent\Collection
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->whereIn('seq', array_values(array_unique($sequences)))
            ->get();
    }

    /** Grains a reader serves; a re-segmentation moves replaced slots out of them. */
    public const LIVE_GRAINS = ['sentence', 'cue'];
    public const OBSOLETE_GRAIN_PREFIX = 'obsolete:';

    /**
     * Content ids one source's live slots reference, per language.
     *
     * @return array<string,array<int,string>>
     */
    public static function liveContentIdsOfSource(string $sourceType, string $sourceKey): array
    {
        $ids = [];

        self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->whereIn('grain', self::LIVE_GRAINS)
            ->select(['id', 'lang_content_ids'])
            ->chunkById(1000, static function ($slots) use (&$ids): void {
                foreach ($slots as $slot) {
                    foreach ((array) $slot->lang_content_ids as $language => $contentId) {
                        if (is_string($contentId) && $contentId !== '') {
                            $ids[(string) $language][$contentId] = true;
                        }
                    }
                }
            });

        return array_map('array_keys', $ids);
    }

    /** Number of one source's live slots. */
    public static function liveSlotCount(string $sourceType, string $sourceKey): int
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->whereIn('grain', self::LIVE_GRAINS)
            ->count();
    }

    /**
     * Slots of one source and grain from a seq on, in seq order, streamed in
     * chunks (a retired grain is read back after retireLiveSlots).
     */
    public static function slotsFromSeq(string $sourceType, string $sourceKey, string $grain, int $fromSeq, int $chunk): \Illuminate\Support\LazyCollection
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->where('seq', '>=', $fromSeq)
            ->lazyById($chunk, 'seq');
    }

    /**
     * Moves one source's live slots to the obsolete grains (kept, never
     * deleted). seq is shifted past earlier obsolete rows so the position key
     * stays unique across repeated re-segmentations.
     *
     * @return array{moved:int,offsets:array<string,int>} offsets: live grain => first retired seq
     */
    public static function retireLiveSlots(string $sourceType, string $sourceKey): array
    {
        $moved = 0;
        $offsets = [];

        foreach (self::LIVE_GRAINS as $grain) {
            $obsoleteGrain = self::OBSOLETE_GRAIN_PREFIX . $grain;
            $offset = 1 + (int) self::query()
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where('grain', $obsoleteGrain)
                ->max('seq');
            $offsets[$grain] = $offset;
            $moved += self::query()
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where('grain', $grain)
                ->update([
                    'grain' => $obsoleteGrain,
                    'seq' => self::query()->getConnection()->raw('seq + ' . $offset),
                    'updated_at' => now(),
                ]);
        }

        return ['moved' => $moved, 'offsets' => $offsets];
    }

    /**
     * Book/document sources whose live slots point at any of these content ids.
     *
     * @return array<int,array{source_type:string,source_key:string}>
     */
    public static function sourcesReferencing(string $language, array $contentIds, array $sourceTypes): array
    {
        return self::query()
            ->select(['source_type', 'source_key'])
            ->distinct()
            ->whereIn('source_type', $sourceTypes)
            ->whereIn('grain', self::LIVE_GRAINS)
            ->whereRaw('(lang_content_ids::jsonb ->> ?) = ANY (?::text[])', [$language, '{' . implode(',', $contentIds) . '}'])
            ->get()
            ->map(static fn (self $row): array => ['source_type' => (string) $row->source_type, 'source_key' => (string) $row->source_key])
            ->all();
    }

    /**
     * The subset of these content ids still referenced by any live slot.
     *
     * @return array<string,true>
     */
    public static function liveReferencedContentIds(string $language, array $contentIds): array
    {
        return self::query()
            ->whereIn('grain', self::LIVE_GRAINS)
            ->whereRaw('(lang_content_ids::jsonb ->> ?) = ANY (?::text[])', [$language, '{' . implode(',', $contentIds) . '}'])
            ->selectRaw('DISTINCT lang_content_ids::jsonb ->> ? AS content_id', [$language])
            ->pluck('content_id')
            ->flip()
            ->map(static fn (): bool => true)
            ->all();
    }

    /** Bulk insert of new slot rows (JSON columns already encoded, timestamps set). */
    public static function insertLinks(array $rows): void
    {
        self::query()->insert($rows);
    }

    public static function slotCountsByChapter(string $sourceKey, string $grain = 'all'): array
    {
        $query = self::query()->where('source_key', $sourceKey);
        if ($grain !== 'all') {
            $query->where('grain', $grain);
        }

        return $query
            ->selectRaw('chapter_index, COUNT(*) as slot_count')
            ->groupBy('chapter_index')
            ->pluck('slot_count', 'chapter_index')
            ->mapWithKeys(static fn ($count, $chapter): array => [(int) $chapter => (int) $count])
            ->all();
    }

    public static function rowsForSourceKeyGrain(string $sourceKey, string $grain)
    {
        return self::query()
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->orderBy('chapter_index')
            ->orderBy('seq')
            ->get();
    }

    public static function countForSourceKeyGrain(string $sourceKey, string $grain): int
    {
        return self::query()->where('source_key', $sourceKey)->where('grain', $grain)->count();
    }

    public static function maximumChapterIndex(string $sourceKey, string $grain): ?int
    {
        $value = self::query()->where('source_key', $sourceKey)->where('grain', $grain)->max('chapter_index');

        return $value === null ? null : (int) $value;
    }

    public static function countForChapter(string $sourceKey, string $grain, int $chapterIndex): int
    {
        return self::query()
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->where('chapter_index', $chapterIndex)
            ->count();
    }

    public static function collectSourceTexts(string $sourceType, string $sourceKey): array
    {
        $grain = self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('grain', 'sentence')
            ->exists() ? 'sentence' : 'cue';
        $texts = [];

        self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('grain', $grain)
            ->orderBy('seq')
            ->chunk(500, function ($links) use (&$texts) {
                $idsByLanguage = [];

                foreach ($links as $link) {
                    $language = $link->primary_language ?: 'en';
                    $contentIds = is_array($link->lang_content_ids) ? $link->lang_content_ids : [];
                    $contentId = $contentIds[$language] ?? null;
                    if ($contentId !== null && $contentId !== '') {
                        $idsByLanguage[$language][] = (string) $contentId;
                    }
                }

                $rowsByLanguage = [];
                foreach ($idsByLanguage as $language => $contentIds) {
                    $rowsByLanguage[$language] = AppQyV1LangSentenceModel::rowsByContentIds($language, $contentIds)
                        ->keyBy('content_id');
                }

                foreach ($links as $link) {
                    $language = $link->primary_language ?: 'en';
                    $contentIds = is_array($link->lang_content_ids) ? $link->lang_content_ids : [];
                    $contentId = $contentIds[$language] ?? null;
                    $languageRows = $rowsByLanguage[$language] ?? null;
                    $sentence = $contentId !== null && $languageRows !== null
                        ? $languageRows->get((string) $contentId)
                        : null;
                    if ($sentence !== null && !empty($sentence->text)) {
                        $texts[] = $sentence->text;
                    }
                }
            });

        return $texts;
    }

    public static function contentIdsExclusiveToAgentHistory(string $language, array $contentIds): array
    {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        $contentIds = array_values(array_unique(array_filter(array_map(
            static fn ($contentId): string => trim((string) $contentId),
            $contentIds
        ))));
        if ($language === '' || $contentIds === []) {
            return [];
        }

        $linkTable = (new self())->getTable();
        $articleTable = (new AppQyV1ArticleModel())->getTable();
        $placeholders = implode(',', array_fill(0, count($contentIds), '?'));
        $bindings = array_merge([$language], $contentIds);
        $rows = self::query()
            ->from($linkTable . ' as source_links')
            ->leftJoin(
                $articleTable . ' as source_articles',
                'source_articles.article_id',
                '=',
                'source_links.source_key'
            )
            ->whereRaw("(source_links.lang_content_ids ->> ?) IN ({$placeholders})", $bindings)
            ->select([
                'source_links.source_type',
                'source_articles.source as article_source',
                'source_articles.article_type as article_type',
            ])
            ->selectRaw('(source_links.lang_content_ids ->> ?) as content_id', [$language])
            ->get();

        $agentHistoryIds = [];
        $otherSourceIds = [];
        foreach ($rows as $row) {
            $contentId = trim((string) $row->content_id);
            if ($contentId === '') {
                continue;
            }
            $isAgentHistory = $row->source_type === 'article'
                && $row->article_source === AppQyV1ArticleModel::SOURCE_AGENT_HISTORY
                && $row->article_type === AppQyV1ArticleModel::TYPE_DAILY;
            if ($isAgentHistory) {
                $agentHistoryIds[$contentId] = true;
            } else {
                $otherSourceIds[$contentId] = true;
            }
        }

        return array_values(array_diff(array_keys($agentHistoryIds), array_keys($otherSourceIds)));
    }
}
