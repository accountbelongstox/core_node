<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Models\Worker;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\PycoreTasks\PycoreComputeRoster;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Services\WorkLeases\WorkLeaseAssignments;
use App\Services\WorkLeases\WorkLeaseLanes;
use App\Services\WorkLeases\WorkLeaseService;
use App\Support\AudioOrchestrationContract;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\Log;

/**
 * Server-owned audio plan of one book (audio_orchestration_contract
 * book_plan). The app posts the plan once; Laravel derives the clips from
 * its own book data (source_sentences correspondence slots plus the distinct
 * words of the primary language), raises their gap rows from the reading
 * position forward, and answers the app's cursor reads: status counters
 * and the ready ids after a cursor. Generation itself is the work leases'.
 */
final class AppQyV1BookAudioPlanService
{
    public const QUALITY_NONE = 0;
    public const QUALITY_FAST = 1;
    public const QUALITY_UPGRADED = 2;
    public const QUALITY_GAVE_UP = 3;

    private const STATUS_KEY = 'book_plan:status:';
    private const REFRESH_KEY = 'book_plan:refresh:';
    private const HINT_KEY = 'book_plan:hint:';
    private const BUILD_KEY = 'book_plan:build:';
    private const BUILD_LOCK_SECONDS = 300;
    private const SYNC_KEY = 'book_plan:sync:';
    private const SYNC_SECONDS = 300;
    private const DIRTY_KEY = 'book_plan:dirty:';
    private const DIRTY_SECONDS = 86400;
    private const WORD_PATTERN = "/[\\p{L}]+(?:['\\x{2019}][\\p{L}]+)*/u";
    private const CJK_PATTERN = '/[\x{3040}-\x{30ff}\x{3400}-\x{4dbf}\x{4e00}-\x{9fff}\x{ac00}-\x{d7af}\x{f900}-\x{faff}]/u';
    private const INSERT_CHUNK = 1000;
    private const PLAN_LANES = [WorkLeaseLanes::SENTENCE_AUDIO, WorkLeaseLanes::WORD_AUDIO];

    private ConnectionInterface $db;
    private string $plans;
    private string $clips;
    private string $books;
    private string $sourceSentences;

    public function __construct()
    {
        $this->db = \Illuminate\Support\Facades\DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1));
        $this->plans = '"' . AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'book_audio_plans') . '"';
        $this->clips = '"' . AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'book_audio_plan_clips') . '"';
        $this->books = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'books');
        $this->sourceSentences = '"' . AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'source_sentences') . '"';
    }

    public static function setting(string $path): mixed
    {
        return AudioOrchestrationContract::bookPlan($path);
    }

    public function plansTable(): string
    {
        return $this->plans;
    }

    public function clipsTable(): string
    {
        return $this->clips;
    }

    /**
     * POST book_plans: creates the plan once (identity = book, chapter, languages,
     * words; the client plan hash is kept as a marker) and applies the reading
     * position. Null when the book does not exist.
     *
     * @param array{source_key:string,chapter_index?:?int,languages:array,include_words?:bool,position?:int,plan_hash?:?string} $request
     */
    public function ensure(array $request): ?array
    {
        $sourceKey = (string) $request['source_key'];
        $book = AppQyV1BookModel::query()->where('source_key', $sourceKey)->first(['id', 'source_key', 'language']);

        if ($book === null) {
            return null;
        }
        $available = WorkLeaseLanes::languages(WorkLeaseLanes::SENTENCE_AUDIO);
        $languages = array_values(array_unique(array_filter(
            array_map(static fn ($language): string => AppQyV1TableMaps::normalizeLangCode((string) $language), (array) $request['languages']),
            static fn (string $language): bool => $language !== '' && in_array($language, $available, true)
        )));
        sort($languages);
        $chapter = isset($request['chapter_index']) ? (int) $request['chapter_index'] : null;
        $words = (bool) ($request['include_words'] ?? false);
        $position = max(0, (int) ($request['position'] ?? 0));
        $planId = sha1(implode('|', [$sourceKey, $chapter ?? 'all', implode(',', $languages), $words ? 'words' : 'sentences']));
        $now = now();
        $created = $this->db->table($this->unquoted($this->plans))->insertOrIgnore([
            'plan_id' => $planId,
            'source_key' => $sourceKey,
            'chapter_index' => $chapter,
            'languages' => json_encode($languages),
            'include_words' => $words,
            'plan_hash' => isset($request['plan_hash']) ? mb_substr((string) $request['plan_hash'], 0, 64) : null,
            'position' => $position,
            'state' => 'building',
            'created_at' => $now,
            'updated_at' => $now,
        ]) > 0;
        $plan = $this->plan($planId);

        if ($created) {
            $this->buildSentences($plan, $languages, $sourceKey, $chapter);
            if (!$words) {
                $this->setState($plan->id, 'ready');
            }
        } else {
            $this->db->update(
                "UPDATE {$this->plans} SET plan_hash = ?, updated_at = ? WHERE id = ?",
                [isset($request['plan_hash']) ? mb_substr((string) $request['plan_hash'], 0, 64) : $plan->plan_hash, $now, $plan->id]
            );
        }
        if ($words && $plan->state === 'building') {
            $this->startWords($planId, AppQyV1TableMaps::normalizeLangCode((string) ($book->language ?? '')) ?: ($languages[0] ?? ''));
        }
        $this->movePosition($planId, $position);

        return $this->status($planId, true);
    }

    /** Word membership runs after the response; a plan still building later (a restart killed it) is started again, one build at a time. */
    private function startWords(string $planId, string $language): void
    {
        if (!QueueCenterCacheStore::get()->add(self::BUILD_KEY . $planId, 1, self::BUILD_LOCK_SECONDS)) {
            return;
        }
        defer(function () use ($planId, $language): void {
            $this->buildWords($planId, $language);
        });
    }

    /** The reader moved: stores the position and re-raises the head window once it moved far enough (or the plan is new). */
    public function movePosition(string $planId, int $position): void
    {
        $plan = $this->plan($planId);

        if ($plan === null) {
            return;
        }
        $raised = $plan->raised_position;
        $moved = $raised === null || abs($position - (int) $raised) >= (int) self::setting('reprioritize_min_move');
        $this->db->update("UPDATE {$this->plans} SET position = ? WHERE id = ?", [$position, $plan->id]);
        if ($moved) {
            $plan->position = $position;
            $this->raise($plan);
        }
    }

    /** The app's assignment PUT also drops the status cache, so its figures show at once. */
    public function forgetStatus(string $planId): void
    {
        QueueCenterCacheStore::get()->forget(self::STATUS_KEY . $planId);
    }

    /** A claim named the plan: its head window leads that claim (throttled). */
    public function hint(string $planId): void
    {
        $cache = QueueCenterCacheStore::get();
        $plan = $planId === '' ? null : $this->plan($planId);

        if ($plan === null) {
            return;
        }
        $settled = $plan->raised_position !== null && (int) $plan->raised_position === (int) $plan->position;
        $key = self::HINT_KEY . ($settled ? 'settled:' : '') . $planId;

        if ($cache->add($key, 1, $settled ? (int) self::setting('claim_hint_ttl_seconds') : (int) self::setting('status_cache_seconds') * 5)) {
            $this->raise($plan);
        }
    }

    /**
     * GET book_plans/{planId}: counters, per-node generating counts, fast-pass
     * state. Null for an unknown plan. Cached status_cache_seconds.
     */
    public function status(string $planId, bool $fresh = false): ?array
    {
        $cache = QueueCenterCacheStore::get();
        $plan = $this->plan($planId);

        if ($plan === null) {
            return null;
        }
        if (!$fresh && is_array($cached = $cache->get(self::STATUS_KEY . $planId))) {
            return $cached;
        }
        $this->refreshReady($plan);
        defer(fn () => $this->syncAndRebuildWords($plan));
        $plan = $this->plan($planId);
        $figures = ['total' => 0, 'ready' => 0, 'generating' => 0, 'failed' => 0];
        $sentenceMissing = 0;
        $nodes = [];
        $now = now();
        $upgrade = ['total' => 0, 'done' => 0];

        foreach ($this->db->select(
            'SELECT lane, language, count(*) AS total, count(ready_seq) AS ready,'
            . ' count(*) FILTER (WHERE quality > 0) AS upgrade_total, count(*) FILTER (WHERE quality >= ?) AS upgrade_done'
            . " FROM {$this->clips} WHERE plan_pk = ? GROUP BY lane, language",
            [self::QUALITY_UPGRADED, $plan->id]
        ) as $group) {
            $figures['total'] += (int) $group->total;
            $figures['ready'] += (int) $group->ready;
            if ($group->lane === WorkLeaseLanes::SENTENCE_AUDIO) {
                $sentenceMissing += (int) $group->total - (int) $group->ready;
                $upgrade['total'] += (int) $group->upgrade_total;
                $upgrade['done'] += (int) $group->upgrade_done;
            }
            $table = '"' . WorkLeaseLanes::table((string) $group->lane, (string) $group->language) . '"';
            $key = WorkLeaseLanes::keyColumn((string) $group->lane);
            $member = "EXISTS (SELECT 1 FROM {$this->clips} pc WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.content_key = t.{$key})";
            $scope = [$plan->id, $group->lane, $group->language];

            foreach ($this->db->select(
                "(SELECT 'g' AS kind, t.tts_locked_by AS worker, count(*) AS n FROM {$table} t"
                . ' WHERE t.tts_lease_id IS NOT NULL AND t.tts_lease_expires_at >= ? AND t.has_audio IS NOT TRUE AND ' . $member
                . ' GROUP BY t.tts_locked_by)'
                . " UNION ALL (SELECT 'f' AS kind, NULL AS worker, count(*) AS n FROM {$table} t"
                . ' WHERE t.' . AppQyV1MediaGaps::TTS_FAILED . ' AND t.has_audio IS NOT TRUE AND ' . $member . ')',
                array_merge([$now], $scope, $scope)
            ) as $row) {
                if ($row->kind === 'g') {
                    $figures['generating'] += (int) $row->n;
                    $nodes[(string) $row->worker] = ($nodes[(string) $row->worker] ?? 0) + (int) $row->n;
                } else {
                    $figures['failed'] += (int) $row->n;
                }
            }
        }
        $fastEnabled = (bool) self::setting('fast_pass.enabled');
        $fastPass = $fastEnabled && (bool) $plan->fast_pass;
        if (!$fastPass && $fastEnabled && $sentenceMissing > (int) self::setting('fast_pass.missing_threshold')) {
            $fastPass = true;
            $this->db->update("UPDATE {$this->plans} SET fast_pass = TRUE WHERE id = ?", [$plan->id]);
        }
        $status = [
            'plan_id' => $planId,
            'state' => (string) $plan->state,
            'total' => $figures['total'],
            'ready' => $figures['ready'],
            'generating' => $figures['generating'],
            'queued' => max(0, $figures['total'] - $figures['ready'] - $figures['generating'] - $figures['failed']),
            'failed' => $figures['failed'],
            'empty_languages' => $this->emptyLanguages($plan),
            'skipped' => (int) $plan->skipped,
            'ready_cursor' => (int) $plan->ready_seq_max,
            'nodes' => $this->nodeRows($nodes),
            'fast_pass' => $fastPass,
            'upgrade' => $fastEnabled ? $upgrade : ['total' => 0, 'done' => 0],
            'assignments' => app(WorkLeaseAssignments::class)->summary($plan),
            'updated_at' => $now->toIso8601String(),
        ];
        $cache->put(self::STATUS_KEY . $planId, $status, (int) self::setting('status_cache_seconds'));

        return $status;
    }

    /**
     * GET book_plans/{planId}/ready: resource ids of the clips that became ready
     * after $cursor, in ready order. Null for an unknown plan.
     *
     * @return array{ids:array<int,string>,cursor:int,more:bool}|null
     */
    public function ready(string $planId, int $cursor, int $limit): ?array
    {
        $plan = $this->plan($planId);

        if ($plan === null) {
            return null;
        }
        $limit = max(1, min($limit, (int) self::setting('ready_page_max')));
        $this->refreshReady($plan);
        $rows = $this->db->select(
            "SELECT ready_seq, lane, language, content_key FROM {$this->clips} WHERE plan_pk = ? AND ready_seq > ? ORDER BY ready_seq LIMIT ?",
            [$plan->id, $cursor, $limit + 1]
        );
        $more = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $words = [];
        $ids = [];

        foreach ($rows as $row) {
            if ($row->lane === WorkLeaseLanes::WORD_AUDIO) {
                $words[(string) $row->language][] = (string) $row->content_key;
            }
        }
        $contents = [];
        foreach ($words as $language => $hashes) {
            $contents[$language] = AppQyV1LangDictionaryModel::forLanguage($language)->whereIn('md5', $hashes)->pluck('content', 'md5')->all();
        }
        foreach ($rows as $row) {
            $language = (string) $row->language;
            if ($row->lane === WorkLeaseLanes::SENTENCE_AUDIO) {
                $ids[] = AppQyV1AudioBundleService::resourceKey(AppQyV1AudioBundleService::KIND_SENTENCE, $language, (string) $row->content_key);
            } elseif (isset($contents[$language][$row->content_key])) {
                $ids[] = AppQyV1AudioBundleService::resourceKey(
                    AppQyV1AudioBundleService::KIND_WORD,
                    $language,
                    mb_strtolower(trim((string) $contents[$language][$row->content_key]))
                );
            }
        }

        return [
            'ids' => $ids,
            'cursor' => $rows === [] ? $cursor : (int) end($rows)->ready_seq,
            'more' => $more,
        ];
    }

    /** A sentence report landed: records the fast-pass quality state of the plan rows holding it. */
    public function noteDelivery(string $language, string $contentId, ?string $variantKey, ?string $provider): void
    {
        $quality = (string) self::setting('fast_pass.quality_variant');
        $where = "lane = ? AND language = ? AND content_key = ?";

        if ($variantKey === $quality) {
            $this->db->update("UPDATE {$this->clips} SET quality = ? WHERE {$where}", [self::QUALITY_UPGRADED, WorkLeaseLanes::SENTENCE_AUDIO, $language, $contentId]);
        } elseif (($variantKey === null || $variantKey === '') && $provider === (string) self::setting('fast_pass.engine')) {
            $this->db->update(
                "UPDATE {$this->clips} SET quality = ? WHERE {$where} AND quality = ? AND plan_pk IN (SELECT id FROM {$this->plans} WHERE fast_pass)",
                [self::QUALITY_FAST, WorkLeaseLanes::SENTENCE_AUDIO, $language, $contentId, self::QUALITY_NONE]
            );
        }
    }

    /** A quality upgrade failed on a node: the row keeps its base clip and is not leased for upgrade again. */
    public function noteUpgradeFailed(string $language, string $contentId): void
    {
        $this->db->update(
            "UPDATE {$this->clips} SET quality = ? WHERE lane = ? AND language = ? AND content_key = ? AND quality = ?",
            [self::QUALITY_GAVE_UP, WorkLeaseLanes::SENTENCE_AUDIO, $language, $contentId, self::QUALITY_FAST]
        );
    }

    public function plan(string $planId): ?object
    {
        return $this->db->selectOne("SELECT * FROM {$this->plans} WHERE plan_id = ?", [$planId]);
    }

    public function connection(): ConnectionInterface
    {
        return $this->db;
    }

    /** @return array<int,array{0:string,1:string}> [lane, language] pairs the plan holds */
    public function groups(int $planPk): array
    {
        return array_map(
            static fn (object $row): array => [(string) $row->lane, (string) $row->language],
            $this->db->select("SELECT DISTINCT lane, language FROM {$this->clips} WHERE plan_pk = ? ORDER BY lane, language", [$planPk])
        );
    }

    private function setState(int $planPk, string $state): void
    {
        $this->db->update("UPDATE {$this->plans} SET state = ?, updated_at = ? WHERE id = ?", [$state, now(), $planPk]);
    }

    /** Sentence membership: one statement per language, live library sentences of the book's slots only. Returns the clips added. */
    private function buildSentences(object $plan, array $languages, string $sourceKey, ?int $chapter): int
    {
        $chapterSql = $chapter === null ? '' : ' AND ss.chapter_index = ' . (int) $chapter;
        $added = 0;

        foreach ($languages as $language) {
            $table = '"' . WorkLeaseLanes::table(WorkLeaseLanes::SENTENCE_AUDIO, $language) . '"';
            $key = 'ss.lang_content_ids ->> ' . $this->literal($language);
            $added += $this->db->affectingStatement(
                "INSERT INTO {$this->clips} (plan_pk, lane, language, content_key, position)"
                . ' SELECT ' . (int) $plan->id . ', CAST(' . $this->literal(WorkLeaseLanes::SENTENCE_AUDIO) . ' AS varchar), CAST(' . $this->literal($language) . " AS varchar), {$key}, MIN(ss.seq)"
                . " FROM {$this->sourceSentences} ss JOIN {$table} t ON t.content_id = {$key}"
                . " WHERE ss.source_key = ? AND ss.grain = 'sentence'{$chapterSql} AND " . AppQyV1MediaGaps::SENTENCE_LIVE
                . " GROUP BY {$key} ON CONFLICT DO NOTHING",
                [$sourceKey]
            );
        }

        return $added;
    }

    /**
     * The plan follows the book: sentences a re-segmentation retired leave it (their rows can
     * never get audio), the live sentences it lacks join it, and a clip whose audio was taken
     * back (quality repair, missing file) gets its ready sequence cleared so it is ready again
     * once regenerated. At most every SYNC_SECONDS (null while throttled). Returns the sentence clips added.
     */
    private function syncMembership(object $plan): ?int
    {
        $cache = QueueCenterCacheStore::get();

        if (!$cache->add(self::SYNC_KEY . $plan->plan_id, 1, self::SYNC_SECONDS)) {
            return null;
        }
        $languages = array_values(array_filter((array) json_decode((string) $plan->languages, true), 'is_string'));
        $chapter = $plan->chapter_index === null ? null : (int) $plan->chapter_index;
        $changed = 0;

        foreach ($languages as $language) {
            $table = '"' . WorkLeaseLanes::table(WorkLeaseLanes::SENTENCE_AUDIO, $language) . '"';
            $changed += $this->db->affectingStatement(
                "DELETE FROM {$this->clips} pc USING {$table} t WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND t.content_id = pc.content_key"
                . ' AND NOT (' . AppQyV1MediaGaps::SENTENCE_LIVE . ')',
                [$plan->id, WorkLeaseLanes::SENTENCE_AUDIO, $language]
            );
        }
        $added = $this->buildSentences($plan, $languages, (string) $plan->source_key, $chapter);
        foreach ($this->groups($plan->id) as [$lane, $language]) {
            $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
            $key = WorkLeaseLanes::keyColumn($lane);
            $changed += $this->db->affectingStatement(
                "UPDATE {$this->clips} pc SET ready_seq = NULL FROM {$table} t WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ?"
                . " AND pc.ready_seq IS NOT NULL AND t.{$key} = pc.content_key AND t.has_audio IS NOT TRUE",
                [$plan->id, $lane, $language]
            );
        }
        if ($added > 0) {
            $this->db->update("UPDATE {$this->plans} SET raised_position = NULL WHERE id = ?", [$plan->id]);
            $this->raise($this->plan((string) $plan->plan_id));
        }
        if ($added + $changed > 0) {
            $cache->forget(self::STATUS_KEY . $plan->plan_id);
            Log::info('[BookAudioPlan] membership synced', ['plan' => $plan->plan_id, 'added' => $added, 'changed' => $changed]);
        }

        return $added;
    }

    /** Requested sentence languages of the plan that hold no clip (their sentences are not in the library yet, or the plan was built before they were). */
    public function emptyLanguages(object $plan): array
    {
        $empty = [];

        foreach (array_filter((array) json_decode((string) $plan->languages, true), 'is_string') as $language) {
            if ($this->db->selectOne(
                "SELECT 1 AS present FROM {$this->clips} WHERE plan_pk = ? AND lane = ? AND language = ? LIMIT 1",
                [$plan->id, WorkLeaseLanes::SENTENCE_AUDIO, $language]
            ) === null) {
                $empty[] = $language;
            }
        }

        return $empty;
    }

    /** A writer added sentences to a book: the plans of that book sync on the next timer run, without waiting for an app read. */
    public function noteSourceChanged(string $sourceKey): void
    {
        try {
            $cache = QueueCenterCacheStore::get();

            foreach ($this->db->select("SELECT plan_id FROM {$this->plans} WHERE source_key = ?", [$sourceKey]) as $plan) {
                $cache->put(self::DIRTY_KEY . $plan->plan_id, 1, self::DIRTY_SECONDS);
            }
        } catch (\Throwable $exception) {
            Log::warning('[BookAudioPlan] source change not noted', ['source_key' => $sourceKey, 'error' => $exception->getMessage()]);
        }
    }

    /**
     * Timer pass: plans flagged by noteSourceChanged and plans with a requested language
     * holding no clip sync their membership (idempotent; a plan at most every SYNC_SECONDS,
     * at most $limit plans per pass; the rest wait for the next pass). Returns the plans synced.
     */
    public function syncPending(int $limit): int
    {
        $cache = QueueCenterCacheStore::get();
        $synced = 0;

        foreach ($this->db->select("SELECT * FROM {$this->plans} ORDER BY id") as $plan) {
            if ($synced >= $limit) {
                break;
            }
            $dirty = $cache->has(self::DIRTY_KEY . $plan->plan_id);
            if (!$dirty && $this->emptyLanguages($plan) === []) {
                continue;
            }
            if ($dirty) {
                $cache->forget(self::DIRTY_KEY . $plan->plan_id);
                $cache->forget(self::SYNC_KEY . $plan->plan_id);
            }
            if ($this->syncAndRebuildWords($plan) !== null) {
                $synced++;
            }
        }

        return $synced;
    }

    /** Membership sync of a plan (status read or timer); new sentences bring their words into a word plan. Null while throttled or failed. */
    private function syncAndRebuildWords(object $plan): ?int
    {
        try {
            $added = $this->syncMembership($plan);
            if (($added ?? 0) > 0 && (bool) $plan->include_words && $plan->state === 'ready'
                && QueueCenterCacheStore::get()->add(self::BUILD_KEY . $plan->plan_id, 1, self::BUILD_LOCK_SECONDS)) {
                $language = AppQyV1TableMaps::normalizeLangCode((string) AppQyV1BookModel::query()->where('source_key', $plan->source_key)->value('language'));
                $this->buildWords((string) $plan->plan_id, $language);
            }

            return $added;
        } catch (\Throwable $exception) {
            Log::warning('[BookAudioPlan] membership sync failed', ['plan' => $plan->plan_id, 'error' => $exception->getMessage()]);

            return null;
        }
    }

    /** SQL literal of a trusted short token (language code, lane name). */
    private function literal(string $value): string
    {
        return $this->db->getPdo()->quote($value);
    }

    /**
     * Word membership (run after the response): the distinct words of the primary
     * language sentences in play order. Rows are ensured in the dictionary; a word
     * the validity check rejected is skipped (it never gets audio).
     */
    private function buildWords(string $planId, string $language): void
    {
        $plan = $this->plan($planId);
        $skipped = 0;

        if ($plan === null) {
            return;
        }
        try {
            if (!in_array($language, WorkLeaseLanes::languages(WorkLeaseLanes::WORD_AUDIO), true)) {
                $this->setState($plan->id, 'ready');

                return;
            }
            $table = '"' . WorkLeaseLanes::table(WorkLeaseLanes::SENTENCE_AUDIO, $language) . '"';
            $chunk = (int) self::setting('word_build_chunk');
            $first = [];
            $after = -1;

            do {
                $rows = $this->db->select(
                    "SELECT pc.position, t.text FROM {$this->clips} pc JOIN {$table} t ON t.content_id = pc.content_key"
                    . ' WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.position > ? ORDER BY pc.position LIMIT ?',
                    [$plan->id, WorkLeaseLanes::SENTENCE_AUDIO, $language, $after, $chunk]
                );
                foreach ($rows as $row) {
                    $after = (int) $row->position;
                    foreach ($this->tokens((string) $row->text) as $word) {
                        $first[$word] ??= $after;
                    }
                }
            } while (count($rows) === $chunk);

            AppQyV1LangDictionaryModel::ensureContents($language, array_keys($first));
            $dictionary = '"' . WorkLeaseLanes::table(WorkLeaseLanes::WORD_AUDIO, $language) . '"';
            $inserts = [];
            foreach ($first as $word => $position) {
                $canonical = AppQyV1LangDictionaryModel::canonicalWord((string) $word);
                if ($canonical === null) {
                    $skipped++;
                    continue;
                }
                $inserts[md5($canonical)] = $position;
            }
            foreach (array_chunk(array_keys($inserts), self::INSERT_CHUNK) as $hashes) {
                $valid = array_flip(array_map('strval', $this->db->table($this->unquoted($dictionary))
                    ->whereIn('md5', $hashes)
                    ->whereRaw('(' . AppQyV1MediaGaps::WORD_NOT_INVALID . ')')
                    ->pluck('md5')
                    ->all()));
                $rows = [];
                foreach ($hashes as $hash) {
                    if (!isset($valid[$hash])) {
                        $skipped++;
                        continue;
                    }
                    $rows[] = [
                        'plan_pk' => $plan->id,
                        'lane' => WorkLeaseLanes::WORD_AUDIO,
                        'language' => $language,
                        'content_key' => $hash,
                        'position' => $inserts[$hash],
                    ];
                }
                if ($rows !== []) {
                    $this->db->table($this->unquoted($this->clips))->insertOrIgnore($rows);
                }
            }
            $this->db->update("UPDATE {$this->plans} SET skipped = ?, raised_position = NULL WHERE id = ?", [$skipped, $plan->id]);
            $this->setState($plan->id, 'ready');
            $this->movePosition($planId, (int) $this->plan($planId)->position);
        } catch (\Throwable $exception) {
            Log::warning('[BookAudioPlan] word membership build failed', ['plan' => $planId, 'error' => $exception->getMessage()]);
            $this->setState($plan->id, 'ready');
        }
    }

    /** @return array<int,string> unique lower-case alphabetic tokens of one sentence (CJK runs skipped) */
    private function tokens(string $sentence): array
    {
        $words = [];

        if (preg_match_all(self::WORD_PATTERN, $sentence, $matches) === false) {
            return [];
        }
        foreach ($matches[0] as $match) {
            $word = mb_strtolower(trim($match, "'-\u{2019}"));
            if ($word !== '' && preg_match(self::CJK_PATTERN, $word) !== 1) {
                $words[$word] = true;
            }
        }

        return array_keys($words);
    }

    /**
     * Gap rows of the plan: the head window (from the reading position) at
     * head_priority, the rest at body_priority; an earlier head window left
     * behind drops to the body. Never lowers a promotion or want priority.
     */
    private function raise(object $plan): void
    {
        $head = (int) self::setting('head_priority');
        $body = (int) self::setting('body_priority');
        $from = (int) $plan->position;
        $to = $from + (int) self::setting('head_window');
        $now = now();

        foreach ($this->groups($plan->id) as [$lane, $language]) {
            $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
            $key = WorkLeaseLanes::keyColumn($lane);
            $gap = WorkLeaseLanes::gap($lane);
            $join = "FROM {$this->clips} pc WHERE pc.plan_pk = ? AND pc.lane = ? AND pc.language = ? AND pc.content_key = {$table}.{$key} AND ({$gap})";
            $scope = [$plan->id, $lane, $language];

            $this->db->update(
                "UPDATE {$table} SET tts_priority = ?, tts_requested_at = ? {$join} AND pc.position >= ? AND pc.position < ? AND {$table}.tts_priority < ?",
                array_merge([$head, $now], $scope, [$from, $to, $head])
            );
            $this->db->update(
                "UPDATE {$table} SET tts_priority = ? {$join} AND (pc.position < ? OR pc.position >= ?) AND {$table}.tts_priority < ?",
                array_merge([$body], $scope, [$from, $to, $body])
            );
            $this->db->update(
                "UPDATE {$table} SET tts_priority = ? {$join} AND (pc.position < ? OR pc.position >= ?) AND {$table}.tts_priority = ?",
                array_merge([$body], $scope, [$from, $to, $head])
            );
        }
        $this->db->update("UPDATE {$this->plans} SET raised_position = ?, updated_at = ? WHERE id = ?", [$from, $now, $plan->id]);
        QueueCenterCacheStore::get()->forget(self::STATUS_KEY . $plan->plan_id);
    }

    /**
     * Gives every plan clip that has audio now and no ready sequence yet the next
     * sequence numbers (play order within one pass); one refresher at a time (an
     * advisory lock), at most every refresh_min_seconds.
     */
    private function refreshReady(object $plan): void
    {
        $cache = QueueCenterCacheStore::get();

        if (!$cache->add(self::REFRESH_KEY . $plan->plan_id, 1, (int) self::setting('refresh_min_seconds'))) {
            return;
        }
        $this->db->transaction(function () use ($plan): void {
            $lock = $this->db->selectOne('SELECT pg_try_advisory_xact_lock(?::bigint) AS locked', [crc32('book_plan_ready:' . $plan->id)]);
            if (!$lock->locked) {
                return;
            }
            $base = (int) $this->db->selectOne("SELECT ready_seq_max FROM {$this->plans} WHERE id = ?", [$plan->id])->ready_seq_max;

            foreach ($this->groups($plan->id) as [$lane, $language]) {
                $table = '"' . WorkLeaseLanes::table($lane, $language) . '"';
                $key = WorkLeaseLanes::keyColumn($lane);
                $base += $this->db->update(
                    "UPDATE {$this->clips} pc SET ready_seq = ? + sub.rn FROM ("
                    . " SELECT c.id, row_number() OVER (ORDER BY c.position, c.id) AS rn FROM {$this->clips} c JOIN {$table} t ON t.{$key} = c.content_key"
                    . ' WHERE c.plan_pk = ? AND c.lane = ? AND c.language = ? AND c.ready_seq IS NULL AND t.has_audio IS TRUE'
                    . ' ) sub WHERE pc.id = sub.id',
                    [$base, $plan->id, $lane, $language]
                );
            }
            $this->db->update("UPDATE {$this->plans} SET ready_seq_max = ? WHERE id = ?", [$base, $plan->id]);
        });
    }

    /**
     * @param array<string,int> $counts clips by leasing worker id
     * @return array<int,array{sid:string,label:string,platform:string,compute_class:string,count:int}>
     */
    private function nodeRows(array $counts): array
    {
        $leases = app(WorkLeaseService::class);
        $rows = [];

        foreach ($counts as $workerId => $count) {
            $worker = Worker::findByWorkerId($workerId);
            $identity = (array) ($worker?->metadata['work_identity'] ?? []);
            $sid = $leases->shortId($workerId);
            $rows[] = [
                'sid' => $sid,
                'label' => (string) ($identity['label'] ?? $sid),
                'platform' => (string) ($identity['platform'] ?? ''),
                'compute_class' => (string) ($worker !== null ? PycoreComputeRoster::classOf($worker) : ''),
                'count' => $count,
            ];
        }
        usort($rows, static fn (array $a, array $b): int => $b['count'] <=> $a['count']);

        return $rows;
    }

    private function unquoted(string $table): string
    {
        return trim($table, '"');
    }
}
