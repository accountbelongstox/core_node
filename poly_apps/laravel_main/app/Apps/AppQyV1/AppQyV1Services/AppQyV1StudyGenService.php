<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1StudyGrammarPointModel as StudyGrammarPoint;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1StudyPhraseModel as StudyPhrase;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1StudySegmentModel as StudySegment;
use Illuminate\Support\Facades\DB;

/**
 * Study-content generation control plane (Book Study-Content Generation pipeline
 * §5 — development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md).
 *
 * UI-driven row-lease (assist-flavor) protocol over the study_segments table:
 * plan-on-demand + claim/submit/release/status/segment-content. Segmentation is
 * delegated to AppQyV1StudyGenSegmenter and the submit fan-out to
 * AppQyV1StudyGenWriteback (kept as siblings so no file exceeds the size cap).
 * The 60-minute lease lives on study_segments.claimed_at/claimed_by — NOT on
 * books.assist_claimed_at (that is the poster-assist lease).
 */
class AppQyV1StudyGenService
{
    public const LEASE_MINUTES = 60;
    public const DEFAULT_LANGUAGES = ['en', 'zh'];

    private AppQyV1StudyGenSegmenter $segmenter;
    private AppQyV1StudyGenWriteback $writeback;

    public function __construct(
        ?AppQyV1StudyGenSegmenter $segmenter = null,
        ?AppQyV1StudyGenWriteback $writeback = null
    ) {
        $this->segmenter = $segmenter ?: new AppQyV1StudyGenSegmenter();
        $this->writeback = $writeback ?: new AppQyV1StudyGenWriteback();
    }

    /**
     * Feature gate. When false the write endpoints back off cleanly (assist
     * convention). Default true.
     */
    public static function isEnabled(): bool
    {
        return (bool) env('APPQYV1_STUDY_GEN_ENABLED', true);
    }

    // ------------------------------------------------------------------
    // §5.1 sources listing
    // ------------------------------------------------------------------

    /**
     * List books + articles with their generation markers, merged with a live
     * study_segments count. Documents are not listed (user-scoped uploads).
     *
     * @return array{success:bool,items:array<int,array<string,mixed>>,total:int,page:int,per_page:int}
     */
    public function listSources(string $type, int $page, int $perPage, ?string $q): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $wantBooks = ($type === 'book' || $type === 'all');
        $wantArticles = ($type === 'article' || $type === 'all');

        $booksTotal = $wantBooks ? $this->sourcesBaseQuery('book', $q)->count() : 0;
        $articlesTotal = $wantArticles ? $this->sourcesBaseQuery('article', $q)->count() : 0;

        $bookRows = collect();
        $articleRows = collect();

        // Stable order: books first, then articles (§5.1 merged listing).
        if ($wantBooks && $offset < $booksTotal) {
            $bookRows = $this->sourcesBaseQuery('book', $q)
                ->orderBy('id')->skip($offset)->take($perPage)->get();
        }
        $remaining = $perPage - $bookRows->count();
        if ($wantArticles && $remaining > 0) {
            $articleOffset = $offset > $booksTotal ? $offset - $booksTotal : 0;
            $articleRows = $this->sourcesBaseQuery('article', $q)
                ->orderBy('id')->skip($articleOffset)->take($remaining)->get();
        }

        $items = [];
        foreach ($bookRows as $row) {
            $items[] = $this->mapSourceRow('book', (string) $row->source_key, $row);
        }
        foreach ($articleRows as $row) {
            $items[] = $this->mapSourceRow('article', (string) $row->article_id, $row);
        }

        $this->attachLiveStudy($items);

        return [
            'success' => true,
            'items' => $items,
            'total' => $booksTotal + $articlesTotal,
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    /** Base select for one source type, hasColumn-guarded for the marker columns. */
    private function sourcesBaseQuery(string $sourceType, ?string $q)
    {
        if ($sourceType === 'book') {
            $query = Book::query();
            $columns = ['id', 'source_key', 'title', 'language', 'sentence_count'];
        } else {
            $query = AppQyV1Article::query();
            $columns = ['id', 'article_id', 'title', 'language', 'sentence_count'];
        }
        if ($this->markerColumnsReady($sourceType)) {
            $columns[] = 'study_gen_status';
            $columns[] = 'study_gen_progress';
        }
        if ($q !== null && $q !== '') {
            $query->where('title', 'like', '%' . $q . '%');
        }
        return $query->select($columns);
    }

    /** One source-row -> item shape (cached marker columns; live count added later). */
    private function mapSourceRow(string $sourceType, string $sourceKey, $row): array
    {
        $cachedStatus = (string) ($row->study_gen_status ?? 'none');
        $progress = $row->study_gen_progress ?? null;
        if (is_string($progress)) {
            $decoded = json_decode($progress, true);
            $progress = is_array($decoded) ? $decoded : null;
        }
        return [
            'source_type' => $sourceType,
            'source_key' => $sourceKey,
            'title' => $row->title,
            'language' => $row->language,
            'sentence_count' => (int) ($row->sentence_count ?? 0),
            'study' => [
                'status' => $cachedStatus !== '' ? $cachedStatus : 'none',
                'segments_total' => (int) ($progress['segments_total'] ?? 0),
                'segments_done' => (int) ($progress['segments_done'] ?? 0),
                'languages' => is_array($progress['languages'] ?? null) ? $progress['languages'] : [],
                'updated_at' => $progress['updated_at'] ?? null,
            ],
        ];
    }

    /**
     * Overwrite each item's study.{status,segments_total,segments_done} with a
     * live study_segments count (one grouped query for the whole page). Sources
     * never planned report {status:none,segments_total:0,segments_done:0}.
     *
     * @param array<int,array<string,mixed>> $items
     */
    private function attachLiveStudy(array &$items): void
    {
        if (empty($items)) {
            return;
        }

        $keysByType = [];
        foreach ($items as $item) {
            $keysByType[$item['source_type']][] = $item['source_key'];
        }

        // grouped: (source_type|source_key) -> [status => count]
        $grouped = [];
        foreach ($keysByType as $sourceType => $keys) {
            $rows = StudySegment::query()
                ->where('source_type', $sourceType)
                ->whereIn('source_key', array_values(array_unique($keys)))
                ->groupBy('source_key', 'status')
                ->select('source_key', 'status', DB::raw('count(*) as total'))
                ->get();
            foreach ($rows as $r) {
                $grouped[$sourceType . '|' . $r->source_key][(string) $r->status] = (int) $r->total;
            }
        }

        foreach ($items as &$item) {
            $byStatus = $grouped[$item['source_type'] . '|' . $item['source_key']] ?? [];
            $total = array_sum($byStatus);
            $done = (int) ($byStatus['done'] ?? 0);
            $item['study']['segments_total'] = $total;
            $item['study']['segments_done'] = $done;
            $item['study']['status'] = $this->deriveStatus($total, $done);
        }
        unset($item);
    }

    // ------------------------------------------------------------------
    // §5.2 claim (plan-on-demand)
    // ------------------------------------------------------------------

    /**
     * @return array{success:bool,error?:string,lease_minutes:int,items:array<int,array<string,mixed>>}
     */
    public function claim(
        string $claimer,
        string $sourceType,
        string $sourceKey,
        ?int $segmentIndex,
        int $limit,
        ?array $languages,
        int $targetChars
    ): array {
        $limit = max(1, min(3, $limit));
        $claimerId = mb_substr($claimer, 0, 64);

        // Plan on demand (no-op when segments already exist).
        $planned = $this->segmenter->plan($sourceType, $sourceKey, false, $targetChars);
        if (($planned['segments_total'] ?? 0) === 0) {
            return ['success' => true, 'lease_minutes' => self::LEASE_MINUTES, 'items' => []];
        }

        $connection = StudySegment::query()->getModel()->getConnectionName();
        $claimedIds = DB::connection($connection)->transaction(function () use ($sourceType, $sourceKey, $segmentIndex, $limit, $claimerId) {
            $leaseFloor = now()->subMinutes(self::LEASE_MINUTES);

            $query = StudySegment::query()
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where(function ($w) use ($leaseFloor) {
                    // Claimable = pending OR failed OR lease-expired (any status
                    // except done). Expired leases are silently reclaimed.
                    $w->where('status', 'pending')
                        ->orWhere('status', 'failed')
                        ->orWhere(function ($x) use ($leaseFloor) {
                            $x->where('status', '!=', 'done')
                                ->whereNotNull('claimed_at')
                                ->where('claimed_at', '<', $leaseFloor);
                        });
                });

            if ($segmentIndex !== null) {
                $query->where('segment_index', $segmentIndex);
            }

            $rows = $query->orderBy('segment_index')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            $ids = [];
            foreach ($rows as $row) {
                $row->status = 'generating';
                $row->claimed_at = now();
                $row->claimed_by = $claimerId;
                $row->attempts = (int) $row->attempts + 1;
                $row->error = null;
                $row->save();
                $ids[] = (int) $row->id;
            }
            return $ids;
        }, 1);

        if (empty($claimedIds)) {
            return ['success' => true, 'lease_minutes' => self::LEASE_MINUTES, 'items' => []];
        }

        $targetLanguages = $this->resolveTargetLanguages($sourceType, $sourceKey, $languages);

        $segments = StudySegment::query()->whereIn('id', $claimedIds)->orderBy('segment_index')->get();
        $items = [];
        foreach ($segments as $segment) {
            $primaryLanguage = (string) ($segment->primary_language ?? '');
            $perSegmentTargets = array_values(array_filter($targetLanguages, static fn ($code) => $code !== $primaryLanguage));

            $items[] = [
                'source_type' => $segment->source_type,
                'source_key' => $segment->source_key,
                'segment_index' => (int) $segment->segment_index,
                'grain' => $segment->grain,
                'seq_start' => (int) $segment->seq_start,
                'seq_end' => (int) $segment->seq_end,
                'chapter_index' => (int) $segment->chapter_index,
                'primary_language' => $segment->primary_language,
                'char_count' => (int) $segment->char_count,
                'target_languages' => $perSegmentTargets,
                'slots' => $this->segmenter->buildSegmentSlots($segment),
            ];
        }

        return ['success' => true, 'lease_minutes' => self::LEASE_MINUTES, 'items' => $items];
    }

    /**
     * Target-language resolution order (§5.2): request languages -> book/article
     * metadata.seeded_languages -> ['en','zh']. Normalized, deduped, supported.
     * The primary language is stripped per-segment by the caller.
     *
     * @return array<int,string>
     */
    private function resolveTargetLanguages(string $sourceType, string $sourceKey, ?array $languages): array
    {
        $raw = [];
        if (is_array($languages) && !empty($languages)) {
            $raw = $languages;
        } else {
            $seeded = $this->seededLanguages($sourceType, $sourceKey);
            $raw = !empty($seeded) ? $seeded : self::DEFAULT_LANGUAGES;
        }

        $out = [];
        foreach ($raw as $lang) {
            $code = AppQyV1TableMaps::normalizeLangCode((string) $lang);
            if ($code !== '' && AppQyV1TableMaps::isLanguageSupported($code) && !in_array($code, $out, true)) {
                $out[] = $code;
            }
        }
        return $out;
    }

    /** metadata.seeded_languages for a book/article source (empty otherwise). */
    private function seededLanguages(string $sourceType, string $sourceKey): array
    {
        $metadata = null;
        if ($sourceType === 'book') {
            $metadata = Book::query()->where('source_key', $sourceKey)->value('metadata');
        } elseif ($sourceType === 'article') {
            $metadata = AppQyV1Article::query()->where('article_id', $sourceKey)->value('metadata');
        }
        if (is_string($metadata)) {
            $decoded = json_decode($metadata, true);
            $metadata = is_array($decoded) ? $decoded : null;
        }
        if (is_array($metadata) && isset($metadata['seeded_languages']) && is_array($metadata['seeded_languages'])) {
            return $metadata['seeded_languages'];
        }
        return [];
    }

    // ------------------------------------------------------------------
    // §5.3 submit
    // ------------------------------------------------------------------

    /**
     * @param array<string,mixed> $body
     * @return array<string,mixed> includes http_status (popped by the controller)
     */
    public function submit(array $body): array
    {
        $sourceType = (string) ($body['source_type'] ?? '');
        $sourceKey = (string) ($body['source_key'] ?? '');
        $segmentIndex = (int) ($body['segment_index'] ?? -1);
        $provider = isset($body['provider']) ? mb_substr((string) $body['provider'], 0, 32) : null;
        $slots = (isset($body['slots']) && is_array($body['slots'])) ? $body['slots'] : [];
        $phrases = (isset($body['phrases']) && is_array($body['phrases'])) ? $body['phrases'] : [];
        $grammar = (isset($body['grammar_points']) && is_array($body['grammar_points'])) ? $body['grammar_points'] : [];

        $segment = StudySegment::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('segment_index', $segmentIndex)
            ->first();

        if (!$segment) {
            return ['ok' => false, 'status' => 'not_found', 'http_status' => 404];
        }

        // Idempotency gate: an already-done segment acks with zero writes so a
        // retried POST can never double-insert phrase/grammar rows.
        if ($segment->status === 'done') {
            return ['ok' => true, 'status' => 'done', 'already_done' => true, 'http_status' => 200];
        }

        $wasFailed = ($segment->status === 'failed');
        $connection = StudySegment::query()->getModel()->getConnectionName();

        $result = DB::connection($connection)->transaction(function () use ($segment, $slots, $phrases, $grammar, $provider, $wasFailed) {
            // Failed-segment resubmit: replace this segment's phrase/grammar
            // batches (delete-then-insert) so a retry never accumulates.
            if ($wasFailed) {
                StudyPhrase::query()->where('segment_id', $segment->id)->delete();
                StudyGrammarPoint::query()->where('segment_id', $segment->id)->delete();
            }

            $applied = $this->writeback->apply($segment, $slots, $phrases, $grammar);

            $segment->status = 'done';
            $segment->languages_done = $applied['languages_done'];
            if ($provider !== null && $provider !== '') {
                $segment->provider = $provider;
            }
            $segment->generated_at = now();
            $segment->claimed_at = null;
            $segment->claimed_by = null;
            $segment->error = null;
            $segment->save();

            return $applied;
        });

        // Progress cache (source of truth is study_segments; hasColumn-guarded).
        $this->recomputeProgress($sourceType, $sourceKey);

        return [
            'ok' => true,
            'status' => 'done',
            'applied' => $result['applied'],
            'http_status' => 200,
        ];
    }

    // ------------------------------------------------------------------
    // §5.4 release
    // ------------------------------------------------------------------

    /**
     * @param array<int,int> $segmentIndexes
     * @return array{success:bool,released:int}
     */
    public function release(string $sourceType, string $sourceKey, array $segmentIndexes, ?string $claimer, ?string $error): array
    {
        $indexes = array_values(array_unique(array_map('intval', $segmentIndexes)));
        if (empty($indexes)) {
            return ['success' => true, 'released' => 0];
        }

        // Only rows actually holding a lease are touched; done rows never demoted.
        $base = StudySegment::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->whereIn('segment_index', $indexes)
            ->whereNotNull('claimed_at')
            ->where('status', '!=', 'done');

        $released = (clone $base)->count();

        if ($error !== null && $error !== '') {
            (clone $base)->update([
                'status' => 'failed',
                'error' => mb_substr($error, 0, 2000),
                'claimed_at' => null,
                'claimed_by' => null,
            ]);
        } else {
            (clone $base)->update([
                'status' => 'pending',
                'claimed_at' => null,
                'claimed_by' => null,
            ]);
        }

        $this->recomputeProgress($sourceType, $sourceKey);

        return ['success' => true, 'released' => $released];
    }

    // ------------------------------------------------------------------
    // §5.5 status
    // ------------------------------------------------------------------

    /**
     * @return array<string,mixed>
     */
    public function status(string $sourceType, string $sourceKey): array
    {
        $segments = StudySegment::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->orderBy('segment_index')
            ->get();

        $total = $segments->count();
        $done = $segments->where('status', 'done')->count();
        $generating = $segments->where('status', 'generating')->count();
        $failed = $segments->where('status', 'failed')->count();

        $list = [];
        foreach ($segments as $segment) {
            $list[] = [
                'segment_index' => (int) $segment->segment_index,
                'status' => $segment->status,
                'char_count' => (int) $segment->char_count,
                'seq_start' => (int) $segment->seq_start,
                'seq_end' => (int) $segment->seq_end,
                'chapter_index' => (int) $segment->chapter_index,
                'languages_done' => is_array($segment->languages_done) ? $segment->languages_done : [],
                'provider' => $segment->provider,
                'attempts' => (int) $segment->attempts,
                'error' => $segment->error,
            ];
        }

        return [
            'success' => true,
            'source_type' => $sourceType,
            'source_key' => $sourceKey,
            'totals' => [
                'segments_total' => $total,
                'segments_done' => $done,
                'generating' => $generating,
                'failed' => $failed,
                'status' => $this->deriveStatus($total, $done),
            ],
            'segments' => $list,
        ];
    }

    // ------------------------------------------------------------------
    // §5.6 segment-content (retrieval hook)
    // ------------------------------------------------------------------

    /**
     * @return array<string,mixed>
     */
    public function segmentContent(string $sourceType, string $sourceKey, ?int $segmentIndex, ?int $seq): array
    {
        $query = StudySegment::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey);

        if ($segmentIndex !== null) {
            $query->where('segment_index', $segmentIndex);
        } else {
            // Covering segment via seq BETWEEN seq_start AND seq_end.
            $query->where('seq_start', '<=', $seq)->where('seq_end', '>=', $seq);
        }

        $segment = $query->orderBy('segment_index')->first();
        if (!$segment) {
            return ['success' => false, 'status' => 'not_found', 'http_status' => 404];
        }

        $phrases = StudyPhrase::query()
            ->where('segment_id', $segment->id)
            ->orderBy('id')
            ->get(['language', 'phrase', 'meaning'])
            ->map(static fn ($p) => ['language' => $p->language, 'phrase' => $p->phrase, 'meaning' => $p->meaning])
            ->all();

        $grammar = StudyGrammarPoint::query()
            ->where('segment_id', $segment->id)
            ->orderBy('id')
            ->get(['language', 'point', 'explanation'])
            ->map(static fn ($g) => ['language' => $g->language, 'point' => $g->point, 'explanation' => $g->explanation])
            ->all();

        return [
            'success' => true,
            'segment' => [
                'segment_index' => (int) $segment->segment_index,
                'seq_start' => (int) $segment->seq_start,
                'seq_end' => (int) $segment->seq_end,
                'status' => $segment->status,
                'languages_done' => is_array($segment->languages_done) ? $segment->languages_done : [],
            ],
            'phrases' => $phrases,
            'grammar_points' => $grammar,
            'http_status' => 200,
        ];
    }

    // ------------------------------------------------------------------
    // Progress cache (§3.4)
    // ------------------------------------------------------------------

    /**
     * Recompute the denormalized source marker from study_segments (source of
     * truth) and write it to books/articles. hasColumn-guarded so the code ships
     * before the migration without 500s; documents have no source table.
     */
    private function recomputeProgress(string $sourceType, string $sourceKey): void
    {
        if ($sourceType !== 'book' && $sourceType !== 'article') {
            return;
        }
        if (!$this->markerColumnsReady($sourceType)) {
            return;
        }

        $byStatus = StudySegment::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->groupBy('status')
            ->select('status', DB::raw('count(*) as total'))
            ->pluck('total', 'status');

        $total = 0;
        foreach ($byStatus as $count) {
            $total += (int) $count;
        }
        $done = (int) ($byStatus['done'] ?? 0);
        $status = $this->deriveStatus($total, $done);

        // Union of languages across done segments.
        $languages = [];
        StudySegment::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('status', 'done')
            ->select('languages_done')
            ->chunk(500, function ($rows) use (&$languages) {
                foreach ($rows as $row) {
                    $rowLangs = is_array($row->languages_done) ? $row->languages_done : [];
                    foreach ($rowLangs as $code) {
                        $languages[(string) $code] = true;
                    }
                }
            });

        $progress = [
            'segments_total' => $total,
            'segments_done' => $done,
            'languages' => array_keys($languages),
            'updated_at' => now()->toIso8601String(),
        ];

        // Query-builder update (no full-row load: books carry a longText body).
        // The json column is bound as an encoded string.
        $payload = [
            'study_gen_status' => $status,
            'study_gen_progress' => json_encode($progress),
        ];
        if ($sourceType === 'book') {
            Book::query()->where('source_key', $sourceKey)->update($payload);
        } else {
            AppQyV1Article::query()->where('article_id', $sourceKey)->update($payload);
        }
    }

    /** none | partial | complete from live counts. */
    private function deriveStatus(int $total, int $done): string
    {
        if ($done <= 0) {
            return 'none';
        }
        if ($total > 0 && $done >= $total) {
            return 'complete';
        }
        return 'partial';
    }

    // ------------------------------------------------------------------
    // Cached schema probes (marker columns ship in a separate migration)
    // ------------------------------------------------------------------

    /** @var array<string,bool> */
    private static array $markerColumns = [];

    private function markerColumnsReady(string $sourceType): bool
    {
        if (!array_key_exists($sourceType, self::$markerColumns)) {
            try {
                $model = $sourceType === 'book' ? new Book() : new AppQyV1Article();
                self::$markerColumns[$sourceType] = $model->getConnection()
                    ->getSchemaBuilder()
                    ->hasColumn($model->getTable(), 'study_gen_status');
            } catch (\Throwable $e) {
                self::$markerColumns[$sourceType] = false;
            }
        }
        return self::$markerColumns[$sourceType];
    }
}
