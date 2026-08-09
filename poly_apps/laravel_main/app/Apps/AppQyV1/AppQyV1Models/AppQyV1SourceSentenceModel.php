<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use Illuminate\Pagination\LengthAwarePaginator;

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
class AppQyV1SourceSentenceModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'source_sentences');
    }

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

    protected $casts = [
        'seq' => 'integer',
        'seg_index' => 'integer',
        'sub_idx' => 'integer',
        'start_sec' => 'float',
        'end_sec' => 'float',
        'metadata' => 'array',
        'chapter_index' => 'integer',
        'lang_content_ids' => 'array',
    ];

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

    public static function sourceGrainPage(
        string $sourceType,
        string $sourceKey,
        int $start,
        int $limit
    ): array {
        $base = self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey);
        $grain = 'sentence';
        $total = (clone $base)->where('grain', $grain)->count();

        if ($total === 0) {
            $grain = 'cue';
            $total = (clone $base)->where('grain', $grain)->count();
        }

        $rows = (clone $base)
            ->where('grain', $grain)
            ->orderBy('seq')
            ->skip($start)
            ->take($limit)
            ->get();

        return ['grain' => $grain, 'total' => $total, 'rows' => $rows];
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

    public static function createLink(array $attributes): self
    {
        return self::create($attributes);
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
