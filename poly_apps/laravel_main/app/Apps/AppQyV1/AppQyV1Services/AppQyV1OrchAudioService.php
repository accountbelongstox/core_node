<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1OrchAudioSegmentModel as OrchSegment;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1OrchAudioTaskModel as OrchTask;
use App\Providers\PathMapper;
use Illuminate\Support\Carbon;

/**
 * Idempotent ingest and read model for pycore audio-orchestration output
 * (contract: docs_fix/REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md,
 * "W5 contract"). Segment audio is stored content-addressed under the static
 * app_qy_v1 audio tree.
 */
final class AppQyV1OrchAudioService
{
    public const ERROR_TASK_NOT_FOUND = 'ORCH_AUDIO_TASK_NOT_FOUND';
    public const ERROR_SEGMENT_UNDECLARED = 'ORCH_AUDIO_SEGMENT_UNDECLARED';
    public const ERROR_SEGMENT_HASH_MISMATCH = 'ORCH_AUDIO_SEGMENT_HASH_MISMATCH';
    public const ERROR_UPLOAD_INVALID = 'ORCH_AUDIO_UPLOAD_INVALID';
    public const ERROR_STORE_FAILED = 'ORCH_AUDIO_STORE_FAILED';

    public const RESULT_CREATED = 'created';
    public const RESULT_UPDATED = 'updated';
    public const RESULT_UNCHANGED = 'unchanged';

    private const UPLOAD_LANE = 'orch_audio_segment';
    public const SEGMENT_AUDIO_SUBDIR = 'orchestration';
    private const AUDIO_URL_PREFIX = '/static/app_qy_v1/audio/';
    private const AUDIO_EXTENSION = '.mp3';
    private const DEFAULT_LANGUAGE = 'en';
    private const WORD_RESOURCE_LIMIT = 300;
    private const RESOURCE_KIND_WORD = 'word';
    private const RESOURCE_KIND_SENTENCE = 'sentence';
    private const PREVIEW_TEXT_LENGTH = 500;

    private AppQyV1DurableOffsetUploadService $uploadService;

    private AppQyV1AudioGateway $audioGateway;

    private AppQyV1ResourceIndexService $resourceIndex;

    public function __construct(
        AppQyV1DurableOffsetUploadService $uploadService,
        AppQyV1AudioGateway $audioGateway,
        AppQyV1ResourceIndexService $resourceIndex
    ) {
        $this->uploadService = $uploadService;
        $this->audioGateway = $audioGateway;
        $this->resourceIndex = $resourceIndex;
    }

    /**
     * Delivery diff of task metadata and segment audio (diff kind
     * orch_output; replaces the former ingest/probe endpoint).
     */
    public function diffTasks(string $machineId, array $tasks): array
    {
        $keys = [];
        $stored = [];
        $segments = [];
        $result = [];

        foreach ($tasks as $task) {
            $keys[] = OrchTask::taskKey($machineId, (string) $task['key']);
        }
        $stored = OrchTask::mapByTaskKeys($keys);
        $segments = OrchSegment::mapForTasks($keys);

        foreach ($tasks as $position => $task) {
            $taskKey = $keys[$position];
            $row = $stored[$taskKey] ?? null;
            $missing = [];
            foreach (is_array($task['segments'] ?? null) ? $task['segments'] : [] as $segment) {
                $index = (int) $segment['index'];
                $known = $segments[$taskKey][$index] ?? null;
                if ($known === null
                    || !$known->isReady()
                    || !hash_equals((string) $known->stored_sha256, strtolower((string) $segment['sha256']))) {
                    $missing[] = $index;
                }
            }
            $result[] = [
                'task_id' => (string) $task['key'],
                'task_key' => $taskKey,
                'known' => $row !== null,
                'meta_current' => $row !== null && hash_equals((string) $row->meta_hash, (string) $task['meta_hash']),
                'segments_missing' => $missing,
            ];
        }

        return $result;
    }

    public function ingestTasks(string $machineId, array $tasks): array
    {
        $counts = [self::RESULT_CREATED => 0, self::RESULT_UPDATED => 0, self::RESULT_UNCHANGED => 0];
        $results = [];

        OrchTask::runInTransaction(function () use ($machineId, $tasks, &$counts, &$results): void {
            foreach ($tasks as $task) {
                $entry = $this->ingestTask($machineId, $task);
                $counts[$entry['result']]++;
                $results[] = $entry;
            }
        });

        return ['tasks' => $results] + $counts;
    }

    /**
     * One offset-v1 chunk of a declared segment. Returns
     * ['error_code' => ..., 'http' => ...] on rejection, else ['data' => receipt].
     */
    public function receiveSegmentChunk(
        string $machineId,
        string $taskId,
        int $segmentIndex,
        string $chunk,
        int $offset,
        int $totalBytes,
        string $audioSha256,
        string $chunkSha256
    ): array {
        $taskKey = OrchTask::taskKey($machineId, $taskId);
        $segment = null;
        $identity = $taskKey . ':' . $segmentIndex;
        $receipt = null;
        $destination = '';

        if (OrchTask::findByTaskKey($taskKey) === null) {
            return ['error_code' => self::ERROR_TASK_NOT_FOUND, 'http' => 404];
        }
        $segment = OrchSegment::findSegment($taskKey, $segmentIndex);
        if ($segment === null) {
            return ['error_code' => self::ERROR_SEGMENT_UNDECLARED, 'http' => 409];
        }
        if (!hash_equals((string) $segment->audio_sha256, $audioSha256)) {
            return ['error_code' => self::ERROR_SEGMENT_HASH_MISMATCH, 'http' => 409];
        }

        $destination = $this->audioPath($audioSha256);
        if ($segment->isReady() || is_file($destination)) {
            return ['data' => $this->completeSegment(
                $taskKey,
                $segmentIndex,
                $audioSha256,
                $this->uploadService->alreadyStoredReceipt(self::UPLOAD_LANE, $identity, $totalBytes)
            )];
        }

        $receipt = $this->uploadService->receive(
            self::UPLOAD_LANE,
            $identity,
            $chunk,
            $offset,
            $totalBytes,
            $audioSha256,
            $chunkSha256
        );
        if ($receipt === null) {
            return ['error_code' => self::ERROR_UPLOAD_INVALID, 'http' => 422];
        }
        if (!($receipt['upload_complete'] ?? false)) {
            return ['data' => $this->uploadService->publicReceipt($receipt)];
        }
        if (!$this->uploadService->promoteCompleted($receipt, $destination)) {
            return ['error_code' => self::ERROR_STORE_FAILED, 'http' => 500];
        }

        return ['data' => $this->completeSegment(
            $taskKey,
            $segmentIndex,
            $audioSha256,
            $this->uploadService->publicReceipt($receipt)
        )];
    }

    public function list(?string $source, ?string $search, int $page, int $perPage): array
    {
        $result = OrchTask::page($source, $search, $page, $perPage);
        $firstReady = OrchSegment::firstReadyForTasks($result['items']->pluck('task_key')->all());

        return [
            'items' => $result['items']
                ->map(fn (OrchTask $task): array => $this->summary($task, $firstReady[$task->task_key] ?? null))
                ->all(),
            'total' => (int) $result['total'],
            'page' => $page,
            'per_page' => $perPage,
            'sources' => OrchTask::sourceCounts(),
        ];
    }

    public function detail(string $taskKey, int $sentencePage, int $sentencePerPage): ?array
    {
        $task = OrchTask::findByTaskKey($taskKey);
        $segments = null;
        $firstReady = null;
        $segmentRows = [];
        $playlist = [];
        $sentences = [];
        $sentenceSlice = [];

        if ($task === null) {
            return null;
        }
        $segments = OrchSegment::orderedForTask($taskKey);
        foreach ($segments as $segment) {
            $ready = $segment->isReady();
            $url = $ready ? $this->audioUrl((string) $segment->stored_sha256) : null;
            if ($ready && $firstReady === null) {
                $firstReady = $segment;
            }
            $segmentRows[] = [
                'index' => (int) $segment->segment_index,
                'start' => $segment->sentence_start,
                'end' => $segment->sentence_end,
                'status' => $segment->status,
                'ready' => $ready,
                'audio_url' => $url,
                'bytes' => (int) $segment->audio_bytes,
                'duration_ms' => (int) $segment->duration_ms,
                'timeline' => is_array($segment->timeline) ? $segment->timeline : [],
                'started_at' => $segment->started_at?->toIso8601String(),
                'finished_at' => $segment->finished_at?->toIso8601String(),
            ];
            if ($ready) {
                $playlist[] = [
                    'index' => (int) $segment->segment_index,
                    'audio_url' => $url,
                    'duration_ms' => (int) $segment->duration_ms,
                ];
            }
        }

        $sentences = $this->sentenceSource($task);
        $sentenceSlice = array_slice($sentences, ($sentencePage - 1) * $sentencePerPage, $sentencePerPage);

        return [
            'task' => $this->summary($task, $firstReady) + [
                'source_text' => $task->source_text,
                'pattern' => $task->pattern,
            ],
            'segments' => $segmentRows,
            'playlist' => $playlist,
            'sentences' => [
                'items' => $this->sentencesWithAudio($sentenceSlice, $task),
                'total' => count($sentences),
                'page' => $sentencePage,
                'per_page' => $sentencePerPage,
            ],
            'words' => $this->wordsWithAudio($task),
        ];
    }

    private function ingestTask(string $machineId, array $task): array
    {
        $taskId = (string) $task['task_id'];
        $taskKey = OrchTask::taskKey($machineId, $taskId);
        $existing = OrchTask::findByTaskKey($taskKey);
        $metaHash = (string) $task['meta_hash'];
        $result = self::RESULT_UNCHANGED;
        $attributes = [];
        $sentences = [];

        if ($existing === null || !hash_equals((string) $existing->meta_hash, $metaHash)) {
            $attributes = [
                'machine_id' => $machineId,
                'task_id' => $taskId,
                'source' => (string) $task['source'],
                'status' => (string) $task['status'],
                'meta_hash' => $metaHash,
                'task_updated_at' => $this->timestamp($task['updated_at'] ?? null) ?? now(),
            ];
            // Optional fields are partial-update: an absent key keeps the stored value.
            if (array_key_exists('name', $task)) {
                $attributes['name'] = $task['name'] !== null ? mb_substr((string) $task['name'], 0, 255) : null;
            }
            if (array_key_exists('language', $task) || $existing === null) {
                $attributes['language'] = $this->language($task['language'] ?? null);
            }
            if (array_key_exists('source_ref', $task)) {
                $attributes['source_ref'] = is_array($task['source_ref']) ? $task['source_ref'] : null;
            }
            if (array_key_exists('source_text', $task)) {
                $attributes['source_text'] = $task['source_text'] !== null ? (string) $task['source_text'] : null;
            }
            if (array_key_exists('pattern', $task)) {
                $attributes['pattern'] = is_array($task['pattern']) ? $task['pattern'] : null;
            }
            if (array_key_exists('sentences', $task)) {
                $sentences = $this->normalizeSentences($task['sentences']);
                $attributes['sentences'] = $sentences;
                $attributes['sentence_count'] = count($sentences);
            }
            if (array_key_exists('resources', $task)) {
                $attributes['resources'] = $this->normalizeResources($task['resources']);
            }
            foreach (['created_at' => 'task_created_at', 'generation_started_at' => 'generation_started_at',
                'generation_finished_at' => 'generation_finished_at'] as $field => $column) {
                if (array_key_exists($field, $task)) {
                    $attributes[$column] = $this->timestamp($task[$field]);
                }
            }
            $attributes['preview_text'] = $this->previewText(
                $attributes['sentences'] ?? (is_array($existing?->sentences) ? $existing->sentences : []),
                $attributes['source_text'] ?? $existing?->source_text
            );
            OrchTask::query()->updateOrCreate(['task_key' => $taskKey], $attributes);
            if (array_key_exists('segments', $task)) {
                OrchSegment::replaceDeclared($taskKey, $this->segmentRows($task['segments']));
                OrchTask::refreshSegmentCounters($taskKey);
            }
            $result = $existing === null ? self::RESULT_CREATED : self::RESULT_UPDATED;
        }

        return [
            'task_id' => $taskId,
            'task_key' => $taskKey,
            'result' => $result,
            'segments_missing' => OrchSegment::orderedForTask($taskKey)
                ->reject(static fn (OrchSegment $segment): bool => $segment->isReady())
                ->map(static fn (OrchSegment $segment): int => (int) $segment->segment_index)
                ->values()
                ->all(),
        ];
    }

    private function completeSegment(string $taskKey, int $segmentIndex, string $sha256, array $receipt): array
    {
        OrchSegment::markStored($taskKey, $segmentIndex, $sha256);
        OrchTask::refreshSegmentCounters($taskKey);
        $this->resourceIndex->recordOrchSegment($sha256);

        return $receipt + [
            'task_key' => $taskKey,
            'index' => $segmentIndex,
            'audio_url' => $this->audioUrl($sha256),
            'ready' => true,
        ];
    }

    private function summary(OrchTask $task, ?OrchSegment $firstReady): array
    {
        return [
            'id' => (string) $task->task_key,
            'task_id' => (string) $task->task_id,
            'source' => (string) $task->source,
            'name' => $task->name,
            'language' => $task->language,
            'status' => (string) $task->status,
            'source_ref' => $task->source_ref,
            'preview_text' => $task->preview_text,
            'sentence_count' => (int) $task->sentence_count,
            'segment_count' => (int) $task->segment_count,
            'segments_ready' => (int) $task->segments_ready,
            'duration_ms' => (int) $task->duration_ms,
            'audio_url' => $firstReady !== null ? $this->audioUrl((string) $firstReady->stored_sha256) : null,
            'created_at' => $task->task_created_at?->toIso8601String(),
            'updated_at' => $task->task_updated_at?->toIso8601String(),
            'generation_started_at' => $task->generation_started_at?->toIso8601String(),
            'generation_finished_at' => $task->generation_finished_at?->toIso8601String(),
            'received_at' => $task->updated_at?->toIso8601String(),
        ];
    }

    /** Task sentences; tasks without inline sentences fall back to their sentence resources. */
    private function sentenceSource(OrchTask $task): array
    {
        $sentences = is_array($task->sentences) ? $task->sentences : [];
        $position = 0;

        if ($sentences !== []) {
            return $sentences;
        }
        foreach (is_array($task->resources) ? $task->resources : [] as $resource) {
            if (($resource['kind'] ?? '') !== self::RESOURCE_KIND_SENTENCE) {
                continue;
            }
            $sentences[] = [
                'seq' => $position++,
                'language' => $resource['language'],
                'text' => $resource['text'],
                'languages' => [],
            ];
        }

        return $sentences;
    }

    private function sentencesWithAudio(array $sentences, OrchTask $task): array
    {
        $lookups = [];
        $resolved = [];
        $items = [];

        foreach ($sentences as $position => $sentence) {
            $lookups[$position] = [
                'text' => (string) $sentence['text'],
                'language' => $this->language($sentence['language'] ?? $task->language),
            ];
        }
        $resolved = $this->audioGateway->resolveSentencesPassive($lookups);
        foreach ($sentences as $position => $sentence) {
            $url = $resolved[$position]['url'] ?? null;
            $items[] = [
                'seq' => (int) ($sentence['seq'] ?? 0),
                'language' => $lookups[$position]['language'],
                'text' => $lookups[$position]['text'],
                'languages' => is_array($sentence['languages'] ?? null) ? $sentence['languages'] : [],
                'audio_url' => $url,
                'audio_ready' => $url !== null,
            ];
        }

        return $items;
    }

    private function wordsWithAudio(OrchTask $task): array
    {
        $words = [];

        foreach (is_array($task->resources) ? $task->resources : [] as $resource) {
            if (($resource['kind'] ?? '') !== self::RESOURCE_KIND_WORD || count($words) >= self::WORD_RESOURCE_LIMIT) {
                continue;
            }
            $resolved = $this->audioGateway->requestWord(
                (string) $resource['text'],
                $this->language($resource['language'] ?? $task->language),
                null,
                false,
                false
            );
            $words[] = [
                'word' => (string) $resolved['word'],
                'language' => (string) $resolved['language'],
                'audio_url' => $resolved['audio_url'],
                'audio_status' => (string) $resolved['audio_status'],
            ];
        }

        return $words;
    }

    private function normalizeSentences(mixed $sentences): array
    {
        $normalized = [];

        foreach (is_array($sentences) ? $sentences : [] as $position => $sentence) {
            $text = trim((string) ($sentence['text'] ?? ''));
            if ($text === '') {
                continue;
            }
            $normalized[] = [
                'seq' => (int) ($sentence['seq'] ?? $position),
                'language' => $this->language($sentence['language'] ?? null),
                'text' => $text,
                'languages' => is_array($sentence['languages'] ?? null) ? $sentence['languages'] : [],
            ];
        }

        return $normalized;
    }

    private function normalizeResources(mixed $resources): array
    {
        $normalized = [];
        $seen = [];

        foreach (is_array($resources) ? $resources : [] as $resource) {
            $kind = (string) ($resource['kind'] ?? '');
            $text = trim((string) ($resource['text'] ?? ''));
            $language = $this->language($resource['language'] ?? null);
            $identity = $kind . "\n" . $language . "\n" . $text;
            if ($text === '' || isset($seen[$identity])) {
                continue;
            }
            $seen[$identity] = true;
            $normalized[] = ['kind' => $kind, 'text' => $text, 'language' => $language];
        }

        return $normalized;
    }

    private function segmentRows(mixed $segments): array
    {
        $rows = [];

        foreach (is_array($segments) ? $segments : [] as $segment) {
            $rows[(int) $segment['index']] = [
                'segment_index' => (int) $segment['index'],
                'sentence_start' => isset($segment['start']) ? (int) $segment['start'] : null,
                'sentence_end' => isset($segment['end']) ? (int) $segment['end'] : null,
                'status' => isset($segment['status']) ? (string) $segment['status'] : null,
                'audio_sha256' => strtolower((string) $segment['sha256']),
                'audio_bytes' => (int) ($segment['bytes'] ?? 0),
                'duration_ms' => (int) ($segment['duration_ms'] ?? 0),
                'timeline' => is_array($segment['timeline'] ?? null)
                    ? json_encode(array_values($segment['timeline']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : null,
                'started_at' => $this->timestamp($segment['started_at'] ?? null),
                'finished_at' => $this->timestamp($segment['finished_at'] ?? null),
            ];
        }

        return array_values($rows);
    }

    private function previewText(array $sentences, mixed $sourceText): ?string
    {
        $text = $sentences !== [] ? (string) $sentences[0]['text'] : trim((string) ($sourceText ?? ''));

        return $text !== '' ? mb_substr($text, 0, self::PREVIEW_TEXT_LENGTH) : null;
    }

    private function language(mixed $language): string
    {
        $code = AppQyV1TableMaps::normalizeLangCode((string) ($language ?? ''));

        return $code !== '' ? $code : self::DEFAULT_LANGUAGE;
    }

    /** Epoch seconds (int/float) or an ISO-8601 string; anything else is null. */
    private function timestamp(mixed $value): ?Carbon
    {
        $parsed = false;

        if (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value))) {
            return (float) $value > 0 ? Carbon::createFromTimestamp((float) $value) : null;
        }
        if (!is_string($value) || trim($value) === '') {
            return null;
        }
        $parsed = strtotime($value);

        return $parsed === false ? null : Carbon::createFromTimestamp($parsed);
    }

    public static function segmentAudioRelative(string $sha256): string
    {
        return self::SEGMENT_AUDIO_SUBDIR . '/' . substr($sha256, 0, 2) . '/' . $sha256 . self::AUDIO_EXTENSION;
    }

    private function audioPath(string $sha256): string
    {
        return PathMapper::getAppQyV1AudioBaseDir(self::segmentAudioRelative($sha256));
    }

    private function audioUrl(string $sha256): string
    {
        return self::AUDIO_URL_PREFIX . self::segmentAudioRelative($sha256);
    }
}
