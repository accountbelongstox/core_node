<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Providers\PathMapper;
use App\Support\QueueCenterContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Batch delivery of many small audio items (contract: docs_fix/
 * REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md, "W7 contract";
 * kinds, limits, batch states, item statuses, error codes and retention:
 * queue_center_contract.json#delivery).
 * A manifest registers the items; their concatenated bytes arrive through the
 * shared offset-v1 receiver; items are then stored by the existing
 * idempotent fill-missing writers after the response, with persisted
 * progress that any status poll can resume.
 */
final class AppQyV1DeliveryBatchService
{
    private const UPLOAD_LANE = 'delivery_batch';
    private const STORAGE_SUBDIR = 'writeback/app_qy_v1/delivery_batch';
    private const WORKER_PREFIX = 'pycore-delivery:';
    private const STALE_PROCESSING_SECONDS = 30;
    private const INLINE_BUDGET_SECONDS = 5.0;
    private const CHECKPOINT_ITEMS = 20;
    private const BATCH_FILE_PATTERN = '/^([a-f0-9]{40})\.[^\/]+$/';
    private const DEFAULT_PROVIDER = 'pycore';

    public function __construct(
        private readonly AppQyV1DurableOffsetUploadService $uploadService,
        private readonly AppQyV1SentenceAudioService $sentenceAudio
    ) {
    }

    /** @return array<int,string> delivery.batch_kinds */
    public static function kinds(): array
    {
        return QueueCenterContract::stringList('delivery.batch_kinds');
    }

    /** delivery.batch_limits.<name>: items, min_item_bytes, item_bytes, total_bytes. */
    public static function limit(string $name): int
    {
        return QueueCenterContract::positiveInt('delivery.batch_limits.' . $name);
    }

    /** delivery.batch_states.<role>: awaiting_content, processing, done. */
    public static function state(string $role): string
    {
        return QueueCenterContract::string('delivery.batch_states.' . $role);
    }

    /** delivery.batch_item_statuses.<role>: stored, exists, no_target, invalid, error. */
    public static function itemStatus(string $role): string
    {
        return QueueCenterContract::string('delivery.batch_item_statuses.' . $role);
    }

    /** delivery.error_codes.<role>. */
    public static function errorCode(string $role): string
    {
        return QueueCenterContract::string('delivery.error_codes.' . $role);
    }

    public static function retentionSeconds(): int
    {
        return QueueCenterContract::positiveInt('delivery.retention_seconds');
    }

    public static function batchId(string $machineId, string $kind, array $items): string
    {
        $canonical = array_map(static fn (array $item): array => [
            (string) $item['key'],
            strtolower((string) $item['sha256']),
            (int) $item['bytes'],
        ], $items);

        return substr(hash('sha256', $machineId . "\n" . $kind . "\n" . json_encode($canonical)), 0, 40);
    }

    /** Register (or re-read) a manifest; returns the progress view. */
    public function register(string $machineId, string $kind, array $items): array
    {
        $batchId = self::batchId($machineId, $kind, $items);
        $state = $this->readState($batchId);

        if ($state === null || $state['machine_id'] !== $machineId) {
            $this->purgeExpired();
            $offset = 0;
            $state = [
                'batch_id' => $batchId,
                'machine_id' => $machineId,
                'kind' => $kind,
                'state' => self::state('awaiting_content'),
                'items' => array_map(static function (array $item) use (&$offset): array {
                    $entry = [
                        'key' => (string) $item['key'],
                        'sha256' => strtolower((string) $item['sha256']),
                        'bytes' => (int) $item['bytes'],
                        'offset' => $offset,
                        'text' => isset($item['text']) ? (string) $item['text'] : null,
                        'provider' => isset($item['provider']) ? (string) $item['provider'] : null,
                        'cleaned_word' => isset($item['cleaned_word']) ? (string) $item['cleaned_word'] : null,
                    ];
                    $offset += (int) $item['bytes'];
                    return $entry;
                }, array_values($items)),
                'total_bytes' => 0,
                'offset' => 0,
                'processed' => 0,
                'results' => [],
                'updated_at' => time(),
            ];
            $state['total_bytes'] = $offset;
            $this->writeState($state);
        }

        return $this->view($state, false);
    }

    /** One offset-v1 chunk of the concatenated content. */
    public function receiveContent(
        string $machineId,
        string $batchId,
        string $chunk,
        int $offset,
        int $totalBytes,
        string $contentSha256,
        string $chunkSha256
    ): array {
        $state = $this->readState($batchId);
        $receipt = null;

        if ($state === null || $state['machine_id'] !== $machineId) {
            return ['error_code' => self::errorCode('batch_not_found'), 'http' => 404];
        }
        if ($state['state'] !== self::state('awaiting_content')) {
            return ['data' => $this->uploadService->alreadyStoredReceipt(self::UPLOAD_LANE, $batchId, $totalBytes)
                + $this->view($state, false)];
        }
        if ($totalBytes !== (int) $state['total_bytes']) {
            return ['error_code' => self::errorCode('upload_invalid'), 'http' => 422];
        }
        $receipt = $this->uploadService->receive(
            self::UPLOAD_LANE,
            $batchId,
            $chunk,
            $offset,
            $totalBytes,
            $contentSha256,
            $chunkSha256
        );
        if ($receipt === null) {
            return ['error_code' => self::errorCode('upload_invalid'), 'http' => 422];
        }
        if (!($receipt['upload_complete'] ?? false)) {
            $state['offset'] = (int) $receipt['offset'];
            $state['updated_at'] = time();
            $this->writeState($state);
            return ['data' => $this->uploadService->publicReceipt($receipt) + $this->view($state, false)];
        }
        if (!$this->contentMatches($state, (string) $receipt['spool_path'])) {
            FileSystemManager::delete((string) $receipt['spool_path']);
            return ['error_code' => self::errorCode('batch_content_mismatch'), 'http' => 409];
        }
        if (!$this->uploadService->promoteCompleted($receipt, $this->contentPath($batchId))) {
            return ['error_code' => self::errorCode('store_failed'), 'http' => 500];
        }
        $state['state'] = self::state('processing');
        $state['offset'] = $totalBytes;
        $state['updated_at'] = time();
        $this->writeState($state);
        defer(static function () use ($batchId): void {
            try {
                app(self::class)->advance($batchId, null);
            } catch (Throwable $exception) {
                Log::warning('[DeliveryBatch] Deferred processing failed', [
                    'batch_id' => $batchId,
                    'error' => $exception->getMessage(),
                ]);
            }
        });

        return ['data' => $this->uploadService->publicReceipt($receipt) + $this->view($state, false)];
    }

    /** Progress view; a processing batch without recent progress is advanced inline. */
    public function status(string $machineId, string $batchId): ?array
    {
        $state = $this->readState($batchId);

        if ($state === null || $state['machine_id'] !== $machineId) {
            return null;
        }
        if ($state['state'] === self::state('processing')
            && time() - (int) $state['updated_at'] >= self::STALE_PROCESSING_SECONDS) {
            $this->advance($batchId, self::INLINE_BUDGET_SECONDS);
            $state = $this->readState($batchId) ?? $state;
        }

        return $this->view($state, true);
    }

    /** Store pending items under the batch lock; null budget = until done. */
    public function advance(string $batchId, ?float $budgetSeconds): void
    {
        FileSystemManager::runWithExclusiveFileLock($this->lockPath($batchId), function () use ($batchId, $budgetSeconds): void {
            $state = $this->readState($batchId);
            $started = microtime(true);
            $sinceCheckpoint = 0;

            if ($state === null || $state['state'] !== self::state('processing')) {
                return;
            }
            while ($state['processed'] < count($state['items'])) {
                if ($budgetSeconds !== null && microtime(true) - $started >= $budgetSeconds) {
                    break;
                }
                $item = $state['items'][$state['processed']];
                $state['results'][] = ['key' => $item['key'], 'status' => $this->storeItem($state, $item)];
                $state['processed']++;
                if (++$sinceCheckpoint >= self::CHECKPOINT_ITEMS) {
                    $state['updated_at'] = time();
                    $this->writeState($state);
                    $sinceCheckpoint = 0;
                }
            }
            if ($state['processed'] >= count($state['items'])) {
                $state['state'] = self::state('done');
                FileSystemManager::delete($this->contentPath($batchId));
            }
            $state['updated_at'] = time();
            $this->writeState($state);
        });
    }

    private function storeItem(array $state, array $item): string
    {
        $bytes = FileSystemManager::readFileSegment($this->contentPath($state['batch_id']), (int) $item['offset'], (int) $item['bytes']);
        $parsed = AppQyV1ResourceIndexService::parseMediaKey((string) $item['key'], (string) $state['kind']);
        $provider = (string) ($item['provider'] ?? '') !== '' ? (string) $item['provider'] : self::DEFAULT_PROVIDER;

        if (!is_string($bytes) || strlen($bytes) !== (int) $item['bytes'] || $parsed === null) {
            return self::itemStatus('invalid');
        }
        try {
            return $state['kind'] === AppQyV1ResourceIndexService::KIND_WORD_AUDIO
                ? $this->storeWord($parsed, $bytes, $provider, $item['cleaned_word'] ?? null)
                : $this->storeSentence($state['machine_id'], $parsed, $bytes, $provider, $item['text'] ?? null);
        } catch (Throwable $exception) {
            Log::warning('[DeliveryBatch] Item store failed', [
                'batch_id' => $state['batch_id'],
                'key' => $item['key'],
                'error' => $exception->getMessage(),
            ]);
            return self::itemStatus('error');
        }
    }

    /** A key without md5 (word_identity.fallback_when_md5_absent) resolves by lang + cleaned_word. */
    private function storeWord(array $parsed, string $bytes, string $provider, ?string $spelling): string
    {
        $coordinator = new AppQyV1DictionaryTTSCoordinator();
        $variant = $parsed['variant'] !== '' ? $parsed['variant'] : null;
        $result = $parsed['hash'] === ''
            ? $coordinator->storeCleanedWordAudioBytesDetailed($parsed['language'], $parsed['cleaned_word'], $bytes, $provider, $spelling, $variant)
            : $coordinator->storeWordAudioBytesDetailed($parsed['language'], $parsed['hash'], $bytes, $provider, $variant);

        return match ((string) ($result['reason'] ?? '')) {
            'stored' => self::itemStatus('stored'),
            'exists', 'variant_exists' => self::itemStatus('exists'),
            'not_found' => self::itemStatus('no_target'),
            'invalid' => self::itemStatus('invalid'),
            default => self::itemStatus('error'),
        };
    }

    private function storeSentence(string $machineId, array $parsed, string $bytes, string $provider, ?string $text): string
    {
        $result = $this->sentenceAudio->report(
            $parsed['hash'],
            $parsed['language'],
            self::WORKER_PREFIX . $machineId,
            true,
            $bytes,
            $provider,
            null,
            $parsed['variant'] !== '' ? $parsed['variant'] : null,
            null,
            $text
        );

        if ($result['ok'] ?? false) {
            return ($result['already_done'] ?? false) ? self::itemStatus('exists') : self::itemStatus('stored');
        }

        return match ((string) ($result['status'] ?? '')) {
            'not_found' => self::itemStatus('no_target'),
            'invalid' => self::itemStatus('invalid'),
            default => self::itemStatus('error'),
        };
    }

    private function contentMatches(array $state, string $spoolPath): bool
    {
        foreach ($state['items'] as $item) {
            $bytes = FileSystemManager::readFileSegment($spoolPath, (int) $item['offset'], (int) $item['bytes']);
            if (!is_string($bytes)
                || strlen($bytes) !== (int) $item['bytes']
                || !hash_equals((string) $item['sha256'], hash('sha256', $bytes))) {
                return false;
            }
        }

        return true;
    }

    private function view(array $state, bool $withResults): array
    {
        $view = [
            'batch_id' => $state['batch_id'],
            'kind' => $state['kind'],
            'state' => $state['state'],
            'total_bytes' => (int) $state['total_bytes'],
            'offset' => (int) $state['offset'],
            'processed' => (int) $state['processed'],
            'total' => count($state['items']),
            'updated_at' => gmdate('c', (int) $state['updated_at']),
        ];
        if ($withResults && $state['state'] === self::state('done')) {
            $view['results'] = $state['results'];
        }

        return $view;
    }

    /**
     * Remove batches idle for retentionSeconds(): every file and the stored
     * updated_at are older than the window, whatever the state (a live
     * processing batch checkpoints its updated_at while it advances). Files
     * without a readable state expire by modification time. Returns the
     * removed batch count.
     */
    public function purgeExpired(): int
    {
        $cutoff = time() - self::retentionSeconds();
        $batches = [];
        $removed = 0;
        $deleted = false;

        foreach (FileSystemManager::iterateFiles($this->storageDirectory()) as $relative => $file) {
            if (preg_match(self::BATCH_FILE_PATTERN, $relative, $match) === 1) {
                $batches[$match[1]][] = $file;
            }
        }
        foreach ($batches as $batchId => $files) {
            if (!$this->batchExpired((string) $batchId, $files, $cutoff)) {
                continue;
            }
            $deleted = true;
            foreach ($files as $file) {
                $deleted = FileSystemManager::delete($file->getPathname()) && $deleted;
            }
            $removed += $deleted ? 1 : 0;
        }

        return $removed;
    }

    /** @param array<int,\SplFileInfo> $files */
    private function batchExpired(string $batchId, array $files, int $cutoff): bool
    {
        $state = null;

        foreach ($files as $file) {
            if ($file->getMTime() >= $cutoff) {
                return false;
            }
        }
        $state = $this->readState($batchId);

        return $state === null || (int) ($state['updated_at'] ?? 0) < $cutoff;
    }

    private function readState(string $batchId): ?array
    {
        $content = FileSystemManager::readFile($this->statePath($batchId), false);
        $state = is_string($content) ? json_decode($content, true) : null;

        return is_array($state) && isset($state['batch_id'], $state['items']) ? $state : null;
    }

    private function writeState(array $state): void
    {
        FileSystemManager::writeFileAtomic(
            $this->statePath((string) $state['batch_id']),
            (string) json_encode($state, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        );
    }

    private function statePath(string $batchId): string
    {
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . $batchId . '.json';
    }

    private function contentPath(string $batchId): string
    {
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . $batchId . '.bin';
    }

    private function lockPath(string $batchId): string
    {
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . $batchId . '.lock';
    }

    private function storageDirectory(): string
    {
        $directory = PathMapper::getLaravelDataDir(self::STORAGE_SUBDIR);
        FileSystemManager::ensureDirectoryExists($directory);

        return rtrim($directory, '/\\');
    }
}
