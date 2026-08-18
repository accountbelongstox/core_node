<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use App\Services\QueueCenter\QueueCenterService;
use Illuminate\Support\Facades\Log;

trait AppQyV1SentenceAudioLookupTrait
{
    /**
     * Paginated database-only list for Queue Center.
     *
     * @return array{total:int,page:int,per_page:int,items:array<int,array<string,mixed>>,summary:array{languages:array<string,int>,reconciled:int}}
     */
    public function listMissing(?string $language, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $queue = app(QueueCenterService::class)->listLiveQueue(
            QueueCenterService::QUEUE_SENTENCE_AUDIO,
            $page,
            $perPage,
            $language
        );
        $items = [];
        foreach ($queue['items'] as $task) {
            $payload = is_array($task['payload'] ?? null) ? $task['payload'] : [];
            $variantKey = trim((string) ($payload['variant_key'] ?? ''));
            $items[] = [
                'task_id' => (string) ($task['task_id'] ?? ''),
                'content_id' => (string) ($payload['content_id'] ?? ''),
                'text' => (string) ($payload['text'] ?? ($payload['content'] ?? '')),
                'language' => (string) ($payload['language'] ?? ''),
                'queue_position' => (int) ($task['queue_position'] ?? 0),
                'tts_status' => (string) ($task['status'] ?? 'pending'),
                'progress' => (float) ($task['progress'] ?? 0),
                'stage' => (string) ($task['stage'] ?? ($task['status'] ?? 'pending')),
                'backend_uploaded' => (bool) ($task['backend_uploaded'] ?? false),
                'tts_locked_by' => $task['assigned_to'] ?? null,
                'assigned_at' => $task['assigned_at'] ?? null,
                'updated_at' => $task['updated_at'] ?? null,
                'occurrence_count' => 0,
                'missing_variants' => $variantKey !== '' ? [$variantKey] : [],
            ];
        }

        return [
            'total' => $queue['total'],
            'page' => $page,
            'per_page' => $perPage,
            'items' => $items,
            'summary' => [
                'languages' => $queue['languages'],
                'reconciled' => 0,
            ],
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private function formatAudioFilesForApi(LangSentence $sentence): array
    {
        $rows = AppQyV1SentenceAudioFiles::list($sentence);
        $out = [];
        foreach ($rows as $row) {
            $path = is_string($row['path'] ?? null) ? $row['path'] : '';
            $out[] = [
                'variant_key' => $row['variant_key'] ?? '',
                'accent' => $row['accent'] ?? null,
                'gender' => $row['gender'] ?? null,
                'source' => $row['source'] ?? null,
                'voice_type' => $row['voice_type'] ?? null,
                'provider' => $row['provider'] ?? null,
                'path' => $path,
                'has_file' => (bool) ($row['has_file'] ?? false),
                'url' => $path !== '' ? AppQyV1SentenceAudioUrl::forRelative($path) : null,
            ];
        }
        return $out;
    }

    public function relativePathFor(string $language, string $contentId, ?string $variantKey = null): string
    {
        $suffix = ($variantKey !== null && $variantKey !== '') ? ('_' . $variantKey) : '';
        return $language . '/' . $contentId . $suffix . '.mp3';
    }

    public function variantExistsOnDisk(string $language, string $contentId, ?string $variantKey = null): bool
    {
        $relative = $this->relativePathFor($language, $contentId, $variantKey);
        $full = PathMapper::getAppQyV1SentenceSoundsDir($relative);
        clearstatcache(true, $full);
        return is_file($full) && filesize($full) > 0;
    }

    /** @return array{relative:string,full:string}|null */
    private function findOnDisk(string $language, string $contentId): ?array
    {
        foreach (self::AUDIO_EXTENSIONS as $extension) {
            $relative = $language . '/' . $contentId . '.' . $extension;
            $full = PathMapper::getAppQyV1SentenceSoundsDir($relative);
            clearstatcache(true, $full);
            if (is_file($full) && filesize($full) > 0) {
                return ['relative' => $relative, 'full' => $full];
            }
        }
        return null;
    }

    private function locate(string $contentId, string $language): ?LangSentence
    {
        if (!$this->tableExists($language)) {
            return null;
        }
        return LangSentence::findByContentId($language, $contentId);
    }

    private function ensureSentenceRow(string $contentId, string $language, string $text): ?LangSentence
    {
        if (!$this->tableExists($language)) {
            return null;
        }

        $existing = LangSentence::findByContentId($language, $contentId);
        if ($existing) {
            $existing->occurrence_count = (int) ($existing->occurrence_count ?? 0) + 1;
            if ($this->isEmptyValue($existing->getAttribute('text'))) {
                $existing->text = $text;
            }
            $existing->saveRecord();
            return $existing;
        }

        $model = LangSentence::for($language);
        $model->fill([
            'content_id' => $contentId,
            'sentence_id' => MediaIngestService::computeSentenceId($text, $language),
            'corr_id' => 'reader|' . $contentId,
            'text' => $text,
            'language' => $language,
            'occurrence_count' => 1,
            'has_audio' => false,
            'tts_status' => 'pending',
        ]);
        $model->saveRecord();

        Log::info('[SentenceAudio] Ensured sentence row for reader resolve', [
            'content_id' => $contentId,
            'language' => $language,
        ]);
        return $model;
    }

    private function isEmptyValue(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return trim($value) === '';
        }
        return false;
    }

    private function reconcilePresent(LangSentence $sentence, string $relativePath): void
    {
        if (!$sentence->has_audio || $sentence->audio !== $relativePath) {
            $sentence->has_audio = true;
            $sentence->audio = $relativePath;
        }
        $sentence->tts_status = 'completed';
        if ($sentence->tts_completed_at === null) {
            $sentence->tts_completed_at = now();
        }
    }
}
