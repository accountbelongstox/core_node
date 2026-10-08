<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1AiPromptModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PerLanguageMetricsModel;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Models\GlobalTask;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\AiGateway\AiGateway;
use App\Services\AiGateway\AiProviderRegistry;
use App\Services\AiGateway\AiRequestFailure;
use App\Services\PycoreTasks\PycoreTaskQueue;
use App\Services\TaskManagerService;
use App\Support\AudioOrchestrationContract;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Laravel side of phrase extraction (docs_fix/DESIGN_PHRASE_PIPELINE.md §4):
 * claim a batch of gap sentences under the phrase lease, ask the AI gateway
 * (OpenRouter free) with the code-owned prompt, parse + store; on a
 * pycore_fallback_codes failure hand the batch to pycore as one phrase_extract
 * global task whose sentences keep the lease while the task is live.
 */
final class AppQyV1PhraseExtractionService
{
    public const OUTCOME_IDLE = 'idle';
    public const OUTCOME_STORED = 'stored';
    public const OUTCOME_DELEGATED = 'delegated';
    public const OUTCOME_FAILED = 'failed';
    public const OUTCOME_RELEASED = 'released';
    public const OUTCOME_BACKOFF = 'backoff';

    private const APP_NAME = 'AppQyV1';
    private const SOURCE = 'phrase_extraction';
    private const CACHE_STORE = 'file';
    private const INTERVAL_KEY = 'appqyv1:phrase_extraction:interval';
    private const FALLBACK_KEY = 'appqyv1:phrase_extraction:fallback_until';
    private const BACKOFF_KEY = 'appqyv1:phrase_extraction:backoff_until';
    private const LAST_OUTCOME_KEY = 'appqyv1:phrase_extraction:last_outcome';
    private const LAST_OUTCOME_KEEP_SECONDS = 86400;
    private const FINISH_REASON_LENGTH = 'length';
    private const LANGUAGE_CURSOR_KEY = 'appqyv1:phrase_extraction:language_cursor';
    private const LANGUAGE_CACHE_SECONDS = 300;
    private const NOT_CONFIGURED_CODE = 'not_configured';

    /**
     * Contract fallback codes => AiChat/AiRequestFailure error codes.
     * not_configured is set here when the provider has no key (AiChat returns no code then).
     */
    private const FALLBACK_CODE_MAP = [
        'AI_RATE_LIMITED' => ['rate_limit', 'local_rate_limit'],
        'AI_PROVIDER_NOT_CONFIGURED' => [self::NOT_CONFIGURED_CODE],
        'AI_DAILY_BUDGET_EXHAUSTED' => ['quota'],
    ];

    /** @var array{at:int, languages:array<int,string>}|null */
    private static ?array $languageCache = null;

    public function __construct(
        private readonly AppQyV1PhraseResponseParser $parser = new AppQyV1PhraseResponseParser(),
        private readonly AppQyV1PhraseWriter $writer = new AppQyV1PhraseWriter(),
        private readonly AppQyV1PhraseModelSelector $selector = new AppQyV1PhraseModelSelector()
    ) {
    }

    /** One timer tick: renew delegated leases, then at most one batch (min_interval_seconds apart). */
    public function tick(): array
    {
        $languages = $this->languages();
        $language = null;

        if ($languages === []) {
            return ['outcome' => self::OUTCOME_IDLE];
        }
        $this->renewDelegatedLeases();
        if ($this->inBackoff()) {
            return ['outcome' => self::OUTCOME_BACKOFF];
        }
        if (!Cache::store(self::CACHE_STORE)->add(self::INTERVAL_KEY, 1, max(1, (int) $this->setting('min_interval_seconds')))) {
            return ['outcome' => self::OUTCOME_IDLE];
        }
        $language = $this->nextLanguage($languages);

        return $this->runBatch($language);
    }

    public function runBatch(string $language): array
    {
        $fallbackMode = $this->inFallbackMode();
        $prompt = null;
        $batch = [];
        $leaseId = '';
        $rendered = '';
        $result = [];
        $code = null;
        $selection = [];
        $options = [];

        if ($fallbackMode && $this->openTaskCount() >= (int) $this->setting('pycore_tasks_max_pending')) {
            return ['outcome' => self::OUTCOME_IDLE, 'language' => $language];
        }
        $prompt = $this->promptTemplate();
        if ($prompt === null) {
            Log::warning('[AppQyV1PhraseExtraction] prompt row missing or disabled; run sys:init', ['prompt_key' => $this->setting('prompt_key')]);
            return ['outcome' => self::OUTCOME_IDLE, 'language' => $language];
        }
        $selection = $this->selector->choose();
        if ($selection['model'] === null) {
            $this->startBackoff((int) AudioOrchestrationContract::phrasePipeline('extraction.model_selection.all_cooled_backoff_seconds'));
            Log::warning('[AppQyV1PhraseExtraction] every candidate model is cooling down, extraction paused', [
                'cooled' => $selection['cooled'],
                'available_in_s' => $this->selector->secondsUntilAvailable(),
            ]);
            return $this->remember(['outcome' => self::OUTCOME_BACKOFF, 'language' => $language, 'error_code' => 'no_model']);
        }
        $options = $this->requestOptions($selection);
        $leaseId = str_replace('-', '', (string) Str::uuid());
        $batch = $this->claim($language, $leaseId);
        if ($batch === []) {
            return ['outcome' => self::OUTCOME_IDLE, 'language' => $language];
        }
        $rendered = $this->render($prompt, $language, $batch);

        if ($fallbackMode || !AiProviderRegistry::isConfigured((string) $this->setting('provider'))) {
            $code = $fallbackMode ? 'local_rate_limit' : self::NOT_CONFIGURED_CODE;
            return $this->remember($this->delegate($language, $batch, $leaseId, $rendered, $code, $selection, $options));
        }

        $result = AiGateway::chatWith(
            (string) $this->setting('provider'),
            $rendered,
            (string) $selection['model'],
            null,
            self::SOURCE,
            (int) $this->setting('request_timeout_seconds'),
            [
                'max_tokens' => (int) $this->setting('max_output_tokens'),
                'temperature' => (float) $this->setting('temperature'),
            ] + $options
        );
        if (!empty($result['success'])) {
            return $this->remember($this->store(
                $language,
                $batch,
                (string) ($result['text'] ?? ''),
                $this->servedModel($result, $selection),
                [
                    'finish_reason' => (string) ($result['finish_reason'] ?? ''),
                    'reasoning_only' => !empty($result['reasoning_only']),
                ]
            ));
        }

        $code = $this->errorCode($result);
        if ($this->isFallbackCode($code)) {
            $this->enterFallbackMode((float) ($result['retry_after_s'] ?? 0));
            return $this->remember($this->delegate($language, $batch, $leaseId, $rendered, $code, $selection, $options));
        }

        return $this->remember($this->gatewayFailure($language, $batch, $result, $code, $selection));
    }

    /**
     * A gateway call that failed for a reason other than rate limit / quota /
     * missing key (contract failure_policy). Provider and model faults are not
     * the sentences' fault: the claim is released without a phrase attempt and
     * the extractor backs off. A heavy-batch fault (timeout, empty answer)
     * strikes the model and still charges the attempt unless that strike
     * benched the model.
     *
     * @param array<int, array{n:int, content_id:string, text:string}> $batch
     */
    private function gatewayFailure(string $language, array $batch, array $result, ?string $code, array $selection): array
    {
        $contentIds = array_column($batch, 'content_id');
        $error = strtolower((string) ($result['error'] ?? ''));
        $modelError = $this->containsAny($error, (array) $this->policy('model_error_marks'));
        $uncharged = in_array((string) $code, (array) $this->policy('uncharged_codes'), true)
            || $this->containsAny($error, (array) $this->policy('uncharged_marks'));
        $benched = false;
        $charge = true;

        if ($modelError) {
            $benched = $this->selector->recordFailure($selection['model'], AppQyV1PhraseModelSelector::FAILURE_MODEL_ERROR);
        } elseif (in_array((string) $code, (array) $this->policy('model_strike_codes'), true)) {
            $benched = $this->selector->recordFailure(
                $selection['model'],
                $code === 'empty_response' ? AppQyV1PhraseModelSelector::FAILURE_EMPTY : AppQyV1PhraseModelSelector::FAILURE_TIMEOUT
            );
        }
        $charge = !$modelError && !$uncharged && !$benched;
        if ($charge) {
            $this->writer->recordFailure($language, $contentIds);
        } else {
            $this->writer->releaseLease($language, $contentIds);
            $this->startBackoff((int) $this->policy('backoff_seconds'));
        }
        Log::warning('[AppQyV1PhraseExtraction] gateway failure', [
            'language' => $language,
            'sentences' => count($batch),
            'model' => $selection['model'],
            'error_code' => $code,
            'charged' => $charge,
            'model_benched' => $benched,
            'error' => mb_substr((string) ($result['error'] ?? ''), 0, 300),
        ]);

        return ['outcome' => self::OUTCOME_FAILED, 'language' => $language, 'sentences' => count($batch), 'error_code' => $code, 'charged' => $charge];
    }

    /**
     * Parse one raw answer for a batch and store it; an unparseable answer
     * counts one attempt for every batch sentence. Shared with the
     * phrase_extract result writeback.
     *
     * $meta (finish_reason, reasoning_only) describes how the model answered:
     * it feeds the model health (selector strikes) and decides whether the
     * sentences the answer did not reach are charged an attempt. A model that
     * answered unusably and got benched by that strike is not held against the
     * sentences.
     *
     * @param array<int, array{n:int, content_id:string, text:string}> $batch
     * @param array{finish_reason?:string, reasoning_only?:bool} $meta
     */
    public function store(string $language, array $batch, string $raw, ?string $sourceModel, array $meta = []): array
    {
        $parsed = $this->parser->parse($raw, $batch);
        $stored = [];
        $truncated = (string) ($meta['finish_reason'] ?? '') === self::FINISH_REASON_LENGTH || !empty($parsed['salvaged']);
        $reasoningOnly = !empty($meta['reasoning_only']);
        $reason = null;
        $benched = false;

        if (!$parsed['ok']) {
            $reason = $reasoningOnly
                ? AppQyV1PhraseModelSelector::FAILURE_REASONING_ONLY
                : ($parsed['error'] === AppQyV1PhraseResponseParser::ERROR_EMPTY
                    ? AppQyV1PhraseModelSelector::FAILURE_EMPTY
                    : ($truncated ? AppQyV1PhraseModelSelector::FAILURE_TRUNCATED : AppQyV1PhraseModelSelector::FAILURE_UNPARSEABLE));
            $benched = $this->selector->recordFailure($sourceModel, $reason);
            if ($benched) {
                $this->writer->releaseLease($language, array_column($batch, 'content_id'));
            } else {
                $this->writer->recordFailure($language, array_column($batch, 'content_id'));
            }
            Log::warning('[AppQyV1PhraseExtraction] answer not parseable', [
                'language' => $language,
                'sentences' => count($batch),
                'model' => $sourceModel,
                'error' => $parsed['error'],
                'reason' => $reason,
                'model_benched' => $benched,
                'charged' => !$benched,
                'answer_head' => mb_substr($raw, 0, 200),
            ]);
            return ['outcome' => self::OUTCOME_FAILED, 'language' => $language, 'sentences' => count($batch), 'error_code' => $parsed['error']];
        }
        $stored = $this->writer->store($language, $batch, $parsed['items'], $sourceModel, !$truncated);
        if ($reasoningOnly) {
            $reason = AppQyV1PhraseModelSelector::FAILURE_REASONING_ONLY;
        } elseif ($truncated) {
            $reason = AppQyV1PhraseModelSelector::FAILURE_TRUNCATED;
        }
        if ($reason !== null) {
            $this->selector->recordFailure($sourceModel, $reason);
        } else {
            $this->selector->recordSuccess($sourceModel);
        }
        Log::info('[AppQyV1PhraseExtraction] batch stored', ['language' => $language, 'model' => $sourceModel, 'truncated' => $truncated] + $stored);

        return ['outcome' => self::OUTCOME_STORED, 'language' => $language] + $stored;
    }

    /** Model that produced the answer: the one OpenRouter reports as served, else the primary asked for. */
    private function servedModel(array $result, array $selection): ?string
    {
        $served = trim((string) ($result['served_model'] ?? ''));

        return $served !== '' ? $served : ($selection['model'] ?? null);
    }

    /**
     * Gateway request options of this batch: the contract's request_options
     * with the in-request `models` list replaced by the selector's choice.
     *
     * @return array<string,mixed>
     */
    private function requestOptions(array $selection): array
    {
        $options = (array) $this->setting('request_options');

        $options['models'] = $selection['models'];

        return $options;
    }

    /** Remember the last tick outcome for status(); returns it unchanged. */
    private function remember(array $outcome): array
    {
        Cache::store(self::CACHE_STORE)->put(self::LAST_OUTCOME_KEY, $outcome + ['at' => time()], self::LAST_OUTCOME_KEEP_SECONDS);

        return $outcome;
    }

    private function inBackoff(): bool
    {
        return (int) Cache::store(self::CACHE_STORE)->get(self::BACKOFF_KEY, 0) > time();
    }

    private function startBackoff(int $seconds): void
    {
        $seconds = max(1, $seconds);

        Cache::store(self::CACHE_STORE)->put(self::BACKOFF_KEY, time() + $seconds, $seconds);
    }

    private function containsAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($haystack, strtolower((string) $needle))) {
                return true;
            }
        }

        return false;
    }

    private function policy(string $name): mixed
    {
        return $this->setting('failure_policy.' . $name);
    }

    /**
     * Pipeline state for the status endpoint: extraction modes, the model
     * choice and health, the pycore delegation queue and per-language counts.
     */
    public function status(): array
    {
        $languages = $this->languages();
        $store = Cache::store(self::CACHE_STORE);
        $now = time();
        $counts = [];

        foreach ($languages as $language) {
            $counts[$language] = $this->writer->statusCounts($language);
        }

        return [
            'languages' => $counts,
            'fallback_mode_seconds' => max(0, (int) $store->get(self::FALLBACK_KEY, 0) - $now),
            'backoff_seconds' => max(0, (int) $store->get(self::BACKOFF_KEY, 0) - $now),
            'pycore_tasks_open' => $this->openTaskCount(),
            'provider_configured' => AiProviderRegistry::isConfigured((string) $this->setting('provider')),
            'selection' => $this->selector->choose(),
            'model_health' => $this->selector->snapshot(),
            'last_outcome' => $store->get(self::LAST_OUTCOME_KEY),
        ];
    }

    /**
     * Claim up to batch_sentences gap sentences (phrase_priority DESC, id) and
     * keep the head that fits batch_max_chars (at least one); the rest is released.
     *
     * @return array<int, array{n:int, content_id:string, text:string}>
     */
    public function claim(string $language, string $leaseId): array
    {
        $table = AppQyV1TableMaps::getSentenceTableName($language);
        $connection = AppQyV1PhraseWriter::connection();
        $wrapped = $connection->getQueryGrammar()->wrapTable($table);
        $now = now();
        $expiresAt = $now->copy()->addSeconds((int) $this->setting('lease_seconds'));
        $maxChars = (int) $this->setting('batch_max_chars');
        $rows = [];
        $batch = [];
        $released = [];
        $empty = [];
        $chars = 0;

        $rows = $connection->select(
            "UPDATE {$wrapped} SET phrase_lease_id = ?, phrase_lease_expires_at = ?, phrase_locked_by = ?"
            . " WHERE id IN (SELECT id FROM {$wrapped} WHERE (" . AppQyV1MediaGaps::SENTENCE_PHRASES . ')'
            . ' AND (phrase_lease_expires_at IS NULL OR phrase_lease_expires_at < ?)'
            . ' ORDER BY phrase_priority DESC, id LIMIT ? FOR UPDATE SKIP LOCKED)'
            . ' RETURNING id, content_id, text, phrase_priority',
            [$leaseId, $expiresAt, $this->lockedBy(), $now, max(1, (int) $this->setting('batch_sentences'))]
        );
        usort($rows, static fn (object $a, object $b): int => [(int) $b->phrase_priority, (int) $a->id] <=> [(int) $a->phrase_priority, (int) $b->id]);

        foreach ($rows as $row) {
            $text = trim((string) $row->text);
            if ($text === '') {
                $empty[] = (string) $row->content_id;
                continue;
            }
            if ($batch !== [] && $chars + mb_strlen($text) > $maxChars) {
                $released[] = (string) $row->content_id;
                continue;
            }
            $chars += mb_strlen($text);
            $batch[] = ['n' => count($batch) + 1, 'content_id' => (string) $row->content_id, 'text' => $text];
        }
        $this->writer->releaseLease($language, $released, $leaseId);
        if ($empty !== []) {
            $this->writer->store($language, array_map(static fn (string $id, int $i): array => ['n' => $i + 1, 'content_id' => $id, 'text' => ''], $empty, array_keys($empty)),
                array_fill(1, count($empty), []), null);
        }

        return $batch;
    }

    /** Hand the claimed batch to pycore as one phrase_extract task; the lease stays while the task is live. */
    private function delegate(string $language, array $batch, string $leaseId, string $rendered, ?string $code, array $selection, array $options): array
    {
        $taskType = (string) $this->setting('pycore_task_type');
        $contentIds = array_column($batch, 'content_id');
        $created = null;

        if ($this->openTaskCount() >= (int) $this->setting('pycore_tasks_max_pending')) {
            $this->writer->releaseLease($language, $contentIds, $leaseId);
            return ['outcome' => self::OUTCOME_RELEASED, 'language' => $language, 'sentences' => count($batch), 'error_code' => $code];
        }
        try {
            $created = app(TaskManagerService::class)->createTaskOnce(
                self::APP_NAME,
                $taskType,
                [
                    'language' => $language,
                    'prompt_key' => (string) $this->setting('prompt_key'),
                    'prompt' => $rendered,
                    'model' => (string) $selection['model'],
                    'request_options' => $options,
                    'max_tokens' => (int) $this->setting('max_output_tokens'),
                    'temperature' => (float) $this->setting('temperature'),
                    'lease_id' => $leaseId,
                    'sentences' => $batch,
                ],
                PycoreTaskQueue::groupKey($taskType, ['language' => $language, 'content_ids' => $contentIds]),
                (int) $this->setting('lease_seconds'),
                0,
                0
            );
        } catch (\Throwable $e) {
            $this->writer->releaseLease($language, $contentIds, $leaseId);
            Log::warning('[AppQyV1PhraseExtraction] pycore task creation failed, batch released', ['language' => $language, 'error' => $e->getMessage()]);
            return ['outcome' => self::OUTCOME_RELEASED, 'language' => $language, 'sentences' => count($batch), 'error_code' => $code];
        }
        Log::info('[AppQyV1PhraseExtraction] batch delegated to pycore', [
            'language' => $language,
            'sentences' => count($batch),
            'task_id' => $created['task']->task_id,
            'created' => $created['created'],
            'error_code' => $code,
        ]);

        return ['outcome' => self::OUTCOME_DELEGATED, 'language' => $language, 'sentences' => count($batch), 'task_id' => (string) $created['task']->task_id];
    }

    /** Keep the phrase lease of every live phrase_extract task's sentences (the lease of the task's lifetime). */
    private function renewDelegatedLeases(): void
    {
        $taskType = (string) $this->setting('pycore_task_type');
        $expiresAt = now()->addSeconds((int) $this->setting('lease_seconds'));
        $byLanguage = [];

        $tasks = GlobalTask::query()
            ->where('task_type', $taskType)
            ->whereIn('status', QueueCenterContract::taskStatuses('live'))
            ->limit(max(1, (int) $this->setting('pycore_tasks_max_pending')) * 2)
            ->get(['payload']);
        foreach ($tasks as $task) {
            $payload = is_array($task->payload) ? $task->payload : [];
            $language = (string) ($payload['language'] ?? '');
            $leaseId = (string) ($payload['lease_id'] ?? '');
            if ($language !== '' && $leaseId !== '') {
                $byLanguage[$language][] = $leaseId;
            }
        }
        foreach ($byLanguage as $language => $leaseIds) {
            AppQyV1PhraseWriter::connection()->table(AppQyV1TableMaps::getSentenceTableName($language))
                ->whereIn('phrase_lease_id', $leaseIds)
                ->whereNull('phrase_status')
                ->update(['phrase_lease_expires_at' => $expiresAt]);
        }
        $this->chargeFailedDelegations($taskType);
    }

    /**
     * A phrase_extract task that ended failed or cancelled without a writeback
     * still holds its sentences' lease: charge those sentences one attempt (the
     * writer clears the lease, so each failed task is charged once) instead of
     * letting them cycle back to pycore without a retry budget.
     */
    private function chargeFailedDelegations(string $taskType): void
    {
        $tasks = GlobalTask::query()
            ->where('task_type', $taskType)
            ->whereIn('status', [QueueCenterContract::taskStatus('failed'), QueueCenterContract::taskStatus('cancelled')])
            ->where('updated_at', '>=', now()->subSeconds(2 * (int) $this->setting('lease_seconds')))
            ->limit(max(1, (int) $this->setting('pycore_tasks_max_pending')) * 2)
            ->get(['payload']);

        foreach ($tasks as $task) {
            $payload = is_array($task->payload) ? $task->payload : [];
            $language = (string) ($payload['language'] ?? '');
            $leaseId = (string) ($payload['lease_id'] ?? '');
            if ($language === '' || $leaseId === '') {
                continue;
            }
            $held = AppQyV1PhraseWriter::connection()->table(AppQyV1TableMaps::getSentenceTableName($language))
                ->where('phrase_lease_id', $leaseId)
                ->whereNull('phrase_status')
                ->pluck('content_id')
                ->all();
            if ($held !== []) {
                $this->writer->recordFailure($language, array_map('strval', $held));
            }
        }
    }

    private function openTaskCount(): int
    {
        $counts = GlobalTask::statusCountsForTaskType((string) $this->setting('pycore_task_type'));
        $live = QueueCenterContract::taskStatuses('live');
        $total = 0;

        foreach ($counts as $status => $count) {
            if (in_array((string) $status, $live, true)) {
                $total += (int) $count;
            }
        }

        return $total;
    }

    private function render(string $template, string $language, array $batch): string
    {
        $lines = array_map(static fn (array $s): string => $s['n'] . "\t" . preg_replace('/\s+/u', ' ', $s['text']), $batch);

        return strtr($template, [
            '{sentences}' => implode("\n", $lines),
            '{language}' => $language,
            '{meaning_language}' => (string) AudioOrchestrationContract::phrasePipeline('meaning_language'),
            '{max_phrases}' => (string) $this->setting('max_phrases_per_sentence'),
            '{max_words}' => (string) $this->setting('phrase_max_words'),
        ]);
    }

    private function promptTemplate(): ?string
    {
        $row = AppQyV1AiPromptModel::rowsByKeys([(string) $this->setting('prompt_key')])->first();
        $template = $row !== null && $row->enabled ? trim((string) $row->prompt_template) : '';

        return $template !== '' ? $template : null;
    }

    private function errorCode(array $result): ?string
    {
        $code = $result['error_code'] ?? null;

        if (is_string($code) && $code !== '') {
            return $code;
        }

        return AiRequestFailure::classify(isset($result['error']) ? (string) $result['error'] : null)['code'];
    }

    private function isFallbackCode(?string $code): bool
    {
        if ($code === null) {
            return false;
        }
        foreach ((array) $this->setting('pycore_fallback_codes') as $contractCode) {
            if (in_array($code, self::FALLBACK_CODE_MAP[(string) $contractCode] ?? [], true)) {
                return true;
            }
        }

        return false;
    }

    private function inFallbackMode(): bool
    {
        return (int) Cache::store(self::CACHE_STORE)->get(self::FALLBACK_KEY, 0) > time();
    }

    private function enterFallbackMode(float $retryAfterSeconds): void
    {
        $seconds = (int) ceil(max($retryAfterSeconds, (float) $this->setting('min_interval_seconds')));

        Cache::store(self::CACHE_STORE)->put(self::FALLBACK_KEY, time() + $seconds, $seconds);
    }

    /** Contract languages whose phrase and sentence tables exist (sys:init creates them). */
    private function languages(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $phraseTables = [];
        $sentenceTables = [];

        if (self::$languageCache !== null && time() - self::$languageCache['at'] < self::LANGUAGE_CACHE_SECONDS) {
            return self::$languageCache['languages'];
        }
        foreach ((array) AudioOrchestrationContract::phrasePipeline('languages') as $language) {
            $language = strtolower((string) $language);
            $phraseTables[$language] = AppQyV1TableMaps::getPhraseTableName($language);
            $sentenceTables[$language] = AppQyV1TableMaps::getSentenceTableName($language);
        }
        self::$languageCache = [
            'at' => time(),
            'languages' => array_values(array_intersect(
                array_keys(AppQyV1PerLanguageMetricsModel::filterExistingTables($connection, $phraseTables)),
                array_keys(AppQyV1PerLanguageMetricsModel::filterExistingTables($connection, $sentenceTables))
            )),
        ];

        return self::$languageCache['languages'];
    }

    private function nextLanguage(array $languages): string
    {
        $store = Cache::store(self::CACHE_STORE);
        $cursor = (int) $store->get(self::LANGUAGE_CURSOR_KEY, 0);

        $store->forever(self::LANGUAGE_CURSOR_KEY, $cursor + 1);

        return $languages[$cursor % count($languages)];
    }

    private function lockedBy(): string
    {
        return mb_substr((gethostname() ?: 'laravel') . ':' . getmypid(), 0, 64);
    }

    private function setting(string $name): mixed
    {
        return AudioOrchestrationContract::phrasePipeline('extraction.' . $name);
    }
}
