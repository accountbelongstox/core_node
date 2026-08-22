<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Providers\PathMapper;
use App\Support\QueueCenterContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

use function Illuminate\Support\defer;

final class AppQyV1AgentHistoryAudioWritebackService
{
    private const STORAGE_SUBDIR = 'writeback/app_qy_v1/agent_history_audio';

    private const MIN_AUDIO_BYTES = 128;

    private const LOCK_SECONDS = 300;

    private AppQyV1DailyReadingService $dailyReadingService;

    public function __construct(AppQyV1DailyReadingService $dailyReadingService)
    {
        $this->dailyReadingService = $dailyReadingService;
    }

    public function receiveChunk(
        string $articleId,
        string $sourceRecordId,
        string $audioBytes,
        int $uploadOffset,
        int $uploadLength,
        string $sha256,
        string $chunkSha256,
        array $provenance = []
    ): ?array {
        $identity = '';
        $transferKey = '';
        $spoolFilename = '';
        $spoolPath = '';
        $markerPath = '';
        $existingMarker = null;
        $marker = [];
        $transferContract = [];
        $writeResult = [];
        $nextOffset = 0;
        $maximumChunkBytes = 0;
        $idempotent = false;

        $articleId = trim($articleId);
        $sourceRecordId = trim($sourceRecordId);
        $identity = $articleId !== '' ? 'article:' . $articleId : 'source:' . $sourceRecordId;
        $transferContract = QueueCenterContract::httpTransfer();
        $maximumChunkBytes = max(1, (int) ($transferContract['maximum_chunk_bytes'] ?? 1048576));
        if (($articleId === '' && $sourceRecordId === '')
            || $uploadLength < self::MIN_AUDIO_BYTES
            || $uploadOffset < 0
            || $uploadOffset >= $uploadLength
            || $audioBytes === ''
            || strlen($audioBytes) > $maximumChunkBytes
            || !preg_match('/^[a-f0-9]{64}$/', $sha256)
            || !preg_match('/^[a-f0-9]{64}$/', $chunkSha256)
            || !hash_equals($chunkSha256, hash('sha256', $audioBytes))
        ) {
            return null;
        }

        $transferKey = hash('sha256', $identity);
        $spoolFilename = $transferKey . '.' . $sha256 . '.part';
        $spoolPath = $this->storageDirectory() . DIRECTORY_SEPARATOR . $spoolFilename;
        $markerPath = $this->markerPath($transferKey);
        $existingMarker = $this->readMarker($markerPath);
        if ($this->markerMatches($existingMarker, $sha256)) {
            return $this->receiptFromMarker($existingMarker, $uploadLength, true);
        }

        $writeResult = FileSystemManager::writeFileSegment($spoolPath, $audioBytes, $uploadOffset);
        $nextOffset = (int) ($writeResult['offset'] ?? 0);
        $idempotent = !($writeResult['success'] ?? false);
        if ($nextOffset < 0 || $nextOffset > $uploadLength) {
            return null;
        }
        if ($nextOffset < $uploadLength) {
            return $this->receipt(
                $articleId,
                null,
                $sha256,
                $nextOffset,
                $uploadLength,
                false,
                false,
                (bool) ($writeResult['success'] ?? false),
                $idempotent,
                (bool) ($writeResult['busy'] ?? false)
            );
        }
        if (!$this->validSpool($spoolPath, $sha256)) {
            return null;
        }

        $marker = [
            'transfer_key' => $transferKey,
            'article_id' => $articleId !== '' ? $articleId : null,
            'source_record_id' => $sourceRecordId !== '' ? $sourceRecordId : null,
            'sha256' => $sha256,
            'spool_filename' => $spoolFilename,
            'provenance' => $this->provenance($provenance),
            'state' => 'pending',
            'audio_url' => null,
            'staged_at' => now()->toIso8601String(),
        ];
        if (!$this->writeMarker($markerPath, $marker)) {
            return null;
        }

        defer(static function () use ($transferKey, $sha256): void {
            try {
                app(self::class)->finalize($transferKey, $sha256);
            } catch (Throwable $exception) {
                Log::warning('[AgentHistoryAudioWriteback] Deferred finalization failed', [
                    'transfer_key' => $transferKey,
                    'sha256' => $sha256,
                    'error' => $exception->getMessage(),
                ]);
            }
        });

        return $this->receiptFromMarker($marker, $uploadLength, false);
    }

    public function finalize(string $transferKey, string $sha256): bool
    {
        $lockName = '';
        $result = false;

        if (!preg_match('/^[a-f0-9]{64}$/', $transferKey)
            || !preg_match('/^[a-f0-9]{64}$/', $sha256)
        ) {
            return false;
        }
        $lockName = 'app_qy_v1:agent_history_audio:' . $transferKey;
        $result = Cache::lock($lockName, self::LOCK_SECONDS)->get(
            fn (): bool => $this->finalizeLocked($transferKey, $sha256)
        );

        return $result === true;
    }

    public function recoverPending(int $limit = 1, int $minimumAgeSeconds = 30): int
    {
        $directory = '';
        $entries = [];
        $completed = 0;
        $now = 0;

        $directory = $this->storageDirectory();
        $entries = FileSystemManager::scandir($directory) ?: [];
        sort($entries, SORT_STRING);
        $now = time();

        foreach ($entries as $entry) {
            $path = '';
            $marker = null;
            $modifiedAt = 0;
            $transferKey = '';

            if (!str_ends_with($entry, '.json')) {
                continue;
            }
            $path = $directory . DIRECTORY_SEPARATOR . $entry;
            $modifiedAt = (int) (@filemtime($path) ?: 0);
            if ($modifiedAt > 0 && ($now - $modifiedAt) < $minimumAgeSeconds) {
                continue;
            }
            $marker = $this->readMarker($path);
            if (!is_array($marker) || ($marker['state'] ?? null) !== 'pending') {
                continue;
            }
            $transferKey = (string) ($marker['transfer_key'] ?? '');
            if ($this->finalize($transferKey, (string) ($marker['sha256'] ?? ''))) {
                $completed++;
            }
            if ($completed >= max(1, $limit)) {
                break;
            }
        }

        return $completed;
    }

    private function finalizeLocked(string $transferKey, string $sha256): bool
    {
        $markerPath = '';
        $marker = null;
        $articleId = '';
        $sourceRecordId = '';
        $spoolFilename = '';
        $spoolPath = '';
        $audioBytes = false;
        $article = null;
        $audioUrl = null;
        $currentMarker = null;

        $markerPath = $this->markerPath($transferKey);
        $marker = $this->readMarker($markerPath);
        if (!$this->markerMatches($marker, $sha256)) {
            return false;
        }
        if (($marker['state'] ?? null) === 'published') {
            return true;
        }

        $articleId = trim((string) ($marker['article_id'] ?? ''));
        $sourceRecordId = trim((string) ($marker['source_record_id'] ?? ''));
        $spoolFilename = basename((string) ($marker['spool_filename'] ?? ''));
        $spoolPath = $this->storageDirectory() . DIRECTORY_SEPARATOR . $spoolFilename;
        if ($spoolFilename === '' || !$this->validSpool($spoolPath, $sha256)) {
            return false;
        }

        if ($articleId !== '') {
            $article = AppQyV1Article::query()
                ->where('article_id', $articleId)
                ->where('source', AppQyV1Article::SOURCE_AGENT_HISTORY)
                ->first();
        }
        if ($article === null && $sourceRecordId !== '') {
            $article = AppQyV1Article::findAgentHistoryBySourceRecordId($sourceRecordId);
        }
        if ($article === null) {
            return false;
        }
        $article = AppQyV1Article::resolveCanonicalArticle($article);
        if ($this->dailyReadingService->isPublishedAudio($article, $sha256)) {
            $audioUrl = $this->dailyReadingService->audioUrlFor($article);
        } else {
            $audioBytes = FileSystemManager::readFile($spoolPath);
            if ($audioBytes === false) {
                return false;
            }
            $audioUrl = $this->dailyReadingService->replaceAudioBytes(
                $article,
                $audioBytes,
                is_array($marker['provenance'] ?? null) ? $marker['provenance'] : []
            );
            if ($audioUrl === null) {
                return false;
            }
        }

        $currentMarker = $this->readMarker($markerPath);
        if (!$this->markerMatches($currentMarker, $sha256)) {
            return false;
        }
        $currentMarker['article_id'] = (string) $article->article_id;
        $currentMarker['audio_url'] = $audioUrl;
        $currentMarker['state'] = 'published';
        $currentMarker['published_at'] = now()->toIso8601String();
        if (!$this->writeMarker($markerPath, $currentMarker)) {
            return false;
        }
        FileSystemManager::delete($spoolPath);

        return true;
    }

    private function receiptFromMarker(array $marker, int $totalBytes, bool $idempotent): array
    {
        $published = false;

        $published = ($marker['state'] ?? null) === 'published';

        return $this->receipt(
            (string) ($marker['article_id'] ?? ''),
            isset($marker['audio_url']) ? (string) $marker['audio_url'] : null,
            (string) ($marker['sha256'] ?? ''),
            $totalBytes,
            $totalBytes,
            true,
            !$published,
            true,
            $idempotent,
            false
        );
    }

    private function receipt(
        string $articleId,
        ?string $audioUrl,
        string $sha256,
        int $offset,
        int $totalBytes,
        bool $uploadComplete,
        bool $pending,
        bool $accepted,
        bool $idempotent,
        bool $busy
    ): array {
        $transferContract = [];

        $transferContract = QueueCenterContract::httpTransfer();

        return [
            'upload_protocol' => (string) ($transferContract['protocol'] ?? 'offset-v1'),
            'article_id' => $articleId !== '' ? $articleId : null,
            'audio_url' => $audioUrl,
            'result_sha256' => $sha256,
            'offset' => $offset,
            'total_bytes' => $totalBytes,
            'progress' => $totalBytes > 0 ? round(($offset / $totalBytes) * 100, 2) : 0,
            'upload_complete' => $uploadComplete,
            'writeback_pending' => $pending,
            'accepted' => $accepted,
            'idempotent' => $idempotent,
            'busy' => $busy,
            'retry_after_ms' => $busy
                ? max(1, (int) ($transferContract['retry_interval_ms'] ?? 250))
                : 0,
        ];
    }

    private function storageDirectory(): string
    {
        $directory = PathMapper::getLaravelDataDir(self::STORAGE_SUBDIR);

        FileSystemManager::ensureDirectoryExists($directory);

        return rtrim($directory, '/\\');
    }

    private function markerPath(string $transferKey): string
    {
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . $transferKey . '.json';
    }

    private function markerMatches(?array $marker, string $sha256): bool
    {
        return is_array($marker)
            && hash_equals((string) ($marker['sha256'] ?? ''), $sha256);
    }

    private function readMarker(string $path): ?array
    {
        $content = false;
        $marker = null;

        $content = FileSystemManager::readFile($path);
        if ($content === false) {
            return null;
        }
        $marker = json_decode($content, true);

        return is_array($marker) ? $marker : null;
    }

    private function writeMarker(string $path, array $marker): bool
    {
        $content = '';

        $content = (string) json_encode(
            $marker,
            JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );

        return FileSystemManager::writeFile($path, $content);
    }

    private function validSpool(string $path, string $sha256): bool
    {
        $fileHash = '';

        if (!is_file($path) || (int) filesize($path) < self::MIN_AUDIO_BYTES) {
            return false;
        }
        $fileHash = (string) hash_file('sha256', $path);

        return $fileHash !== '' && hash_equals($sha256, $fileHash);
    }

    private function provenance(array $provenance): array
    {
        return [
            'tts_engine' => isset($provenance['tts_engine'])
                ? (string) $provenance['tts_engine']
                : null,
            'tts_model' => isset($provenance['tts_model'])
                ? (string) $provenance['tts_model']
                : null,
            'tts_chunked' => (bool) ($provenance['tts_chunked'] ?? false),
            'source_record_id' => isset($provenance['source_record_id'])
                ? (string) $provenance['source_record_id']
                : null,
            'audio_rebuild' => true,
        ];
    }
}
