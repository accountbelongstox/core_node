<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Batch delivery of many small audio items (contract: docs_fix/
 * REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md, "W7 contract").
 * A manifest registers the items; their concatenated bytes arrive through the
 * shared offset-v1 receiver; items are then stored by the existing
 * idempotent fill-missing writers after the response, with persisted
 * progress that any status poll can resume.
 */
final class AppQyV1DeliveryBatchService
{
    public const KINDS = [
        AppQyV1ResourceIndexService::KIND_WORD_AUDIO,
        AppQyV1ResourceIndexService::KIND_SENTENCE_AUDIO,
    ];
    public const MAX_ITEMS = 500;
    public const MIN_ITEM_BYTES = 100;
    public const MAX_ITEM_BYTES = 2097152;
    public const MAX_TOTAL_BYTES = 33554432;

    public const STATE_AWAITING_CONTENT = 'awaiting_content';
    public const STATE_PROCESSING = 'processing';
    public const STATE_DONE = 'done';

    public const STATUS_STORED = 'stored';
    public const STATUS_EXISTS = 'exists';
    public const STATUS_NO_TARGET = 'no_target';
    public const STATUS_INVALID = 'invalid';
    public const STATUS_ERROR = 'error';

    public const ERROR_BATCH_NOT_FOUND = 'DELIVERY_BATCH_NOT_FOUND';
    public const ERROR_CONTENT_MISMATCH = 'DELIVERY_BATCH_CONTENT_MISMATCH';
    public const ERROR_UPLOAD_INVALID = 'DELIVERY_UPLOAD_INVALID';
    public const ERROR_STORE_FAILED = 'DELIVERY_STORE_FAILED';

    private const UPLOAD_LANE = 'delivery_batch';
    private const STORAGE_SUBDIR = 'writeback/app_qy_v1/delivery_batch';
    private const WORKER_PREFIX = 'pycore-delivery:';
    private const STALE_PROCESSING_SECONDS = 30;
    private const INLINE_BUDGET_SECONDS = 5.0;
    private const CHECKPOINT_ITEMS = 20;
    private const RETENTION_SECONDS = 86400;
    private const DEFAULT_PROVIDER = 'pycore';

    public function __construct(
        private readonly AppQyV1DurableOffsetUploadService $uploadService,
        private readonly AppQyV1SentenceAudioService $sentenceAudio
    ) {
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
                'state' => self::STATE_AWAITING_CONTENT,
                'items' => array_map(static function (array $item) use (&$offset): array {
                    $entry = [
                        'key' => (string) $item['key'],
                        'sha256' => strtolower((string) $item['sha256']),
                        'bytes' => (int) $item['bytes'],
                        'offset' => $offset,
                        'text' => isset($item['text']) ? (string) $item['text'] : null,
                        'provider' => isset($item['provider']) ? (string) $item['provider'] : null,
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
            return ['error_code' => self::ERROR_BATCH_NOT_FOUND, 'http' => 404];
        }
        if ($state['state'] !== self::STATE_AWAITING_CONTENT) {
            return ['data' => $this->uploadService->alreadyStoredReceipt(self::UPLOAD_LANE, $batchId, $totalBytes)
                + $this->view($state, false)];
        }
        if ($totalBytes !== (int) $state['total_bytes']) {
            return ['error_code' => self::ERROR_UPLOAD_INVALID, 'http' => 422];
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
            return ['error_code' => self::ERROR_UPLOAD_INVALID, 'http' => 422];
        }
        if (!($receipt['upload_complete'] ?? false)) {
            $state['offset'] = (int) $receipt['offset'];
            $state['updated_at'] = time();
            $this->writeState($state);
            return ['data' => $this->uploadService->publicReceipt($receipt) + $this->view($state, false)];
        }
        if (!$this->contentMatches($state, (string) $receipt['spool_path'])) {
            FileSystemManager::delete((string) $receipt['spool_path']);
            return ['error_code' => self::ERROR_CONTENT_MISMATCH, 'http' => 409];
        }
        if (!$this->uploadService->promoteCompleted($receipt, $this->contentPath($batchId))) {
            return ['error_code' => self::ERROR_STORE_FAILED, 'http' => 500];
        }
        $state['state'] = self::STATE_PROCESSING;
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
        if ($state['state'] === self::STATE_PROCESSING
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

            if ($state === null || $state['state'] !== self::STATE_PROCESSING) {
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
                $state['state'] = self::STATE_DONE;
                FileSystemManager::delete($this->contentPath($batchId));
            }
            $state['updated_at'] = time();
            $this->writeState($state);
        });
    }

    private function storeItem(array $state, array $item): string
    {
        $bytes = FileSystemManager::readFileSegment($this->contentPath($state['batch_id']), (int) $item['offset'], (int) $item['bytes']);
        $parsed = AppQyV1ResourceIndexService::parseMediaKey((string) $item['key']);
        $provider = (string) ($item['provider'] ?? '') !== '' ? (string) $item['provider'] : self::DEFAULT_PROVIDER;

        if (!is_string($bytes) || strlen($bytes) !== (int) $item['bytes'] || $parsed === null) {
            return self::STATUS_INVALID;
        }
        try {
            return $state['kind'] === AppQyV1ResourceIndexService::KIND_WORD_AUDIO
                ? $this->storeWord($parsed, $bytes, $provider)
                : $this->storeSentence($state['machine_id'], $parsed, $bytes, $provider, $item['text'] ?? null);
        } catch (Throwable $exception) {
            Log::warning('[DeliveryBatch] Item store failed', [
                'batch_id' => $state['batch_id'],
                'key' => $item['key'],
                'error' => $exception->getMessage(),
            ]);
            return self::STATUS_ERROR;
        }
    }

    private function storeWord(array $parsed, string $bytes, string $provider): string
    {
        $result = (new AppQyV1DictionaryTTSCoordinator())->storeWordAudioBytesDetailed(
            $parsed['language'],
            $parsed['hash'],
            $bytes,
            $provider,
            $parsed['variant'] !== '' ? $parsed['variant'] : null
        );

        return match ((string) ($result['reason'] ?? '')) {
            'stored' => self::STATUS_STORED,
            'exists', 'variant_exists' => self::STATUS_EXISTS,
            'not_found' => self::STATUS_NO_TARGET,
            'invalid' => self::STATUS_INVALID,
            default => self::STATUS_ERROR,
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
            return ($result['already_done'] ?? false) ? self::STATUS_EXISTS : self::STATUS_STORED;
        }

        return match ((string) ($result['status'] ?? '')) {
            'not_found' => self::STATUS_NO_TARGET,
            'invalid' => self::STATUS_INVALID,
            default => self::STATUS_ERROR,
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
        if ($withResults && $state['state'] === self::STATE_DONE) {
            $view['results'] = $state['results'];
        }

        return $view;
    }

    private function purgeExpired(): void
    {
        $cutoff = time() - self::RETENTION_SECONDS;

        foreach (FileSystemManager::iterateFiles($this->storageDirectory()) as $relative => $file) {
            if (!str_contains($relative, '/') && $file->getMTime() < $cutoff) {
                FileSystemManager::delete($file->getPathname());
            }
        }
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
