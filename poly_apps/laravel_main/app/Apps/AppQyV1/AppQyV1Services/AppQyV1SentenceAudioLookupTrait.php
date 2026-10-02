<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Support\QueueProgress;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use Illuminate\Support\Facades\Log;

trait AppQyV1SentenceAudioLookupTrait
{
    /**
     * The sentence audio gap for the Queue Center "awaiting audio" list:
     * keyset pages (id > cursor) of AppQyV1MediaGaps::SENTENCE_AUDIO rows with
     * their work-lease state. Without a language the language with the largest
     * gap is listed; summary.languages holds every language's gap.
     *
     * @return array{total:int,page:int,per_page:int,language:?string,cursor_id:int,next_cursor:int,has_more:bool,progress:array,items:array<int,array<string,mixed>>,summary:array{languages:array<string,int>,reconciled:int}}
     */
    public function listMissing(?string $language, int $cursorId, int $perPage): array
    {
        $perPage = max(1, min(100, $perPage));
        $gaps = [];
        $items = [];
        $now = now();

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $code) {
            $counts = LangSentence::audioGapCounts($code);
            if ($counts['pending'] + $counts['failed'] > 0) {
                $gaps[$code] = $counts['pending'] + $counts['failed'];
            }
        }
        arsort($gaps);
        $code = $language !== null && trim($language) !== ''
            ? AppQyV1TableMaps::normalizeLangCode($language)
            : (string) (array_key_first($gaps) ?? 'en');
        $rows = LangSentence::withoutAudioKeysetPage($code, $cursorId, $perPage + 1, [
            'id', 'content_id', 'text', 'language', 'tts_status', 'tts_locked_by', 'tts_locked_at',
            'tts_lease_expires_at', 'occurrence_count', 'updated_at',
        ]);
        $hasMore = $rows->count() > $perPage;
        $rows = $rows->take($perPage)->values();
        foreach ($rows as $row) {
            $leased = $row->tts_lease_expires_at !== null && \Illuminate\Support\Carbon::parse($row->tts_lease_expires_at)->gte($now);
            $items[] = [
                'task_id' => null,
                'content_id' => (string) $row->content_id,
                'text' => (string) $row->text,
                'language' => (string) ($row->language ?: $code),
                'queue_position' => 0,
                'tts_status' => $leased ? 'leased' : (string) ($row->tts_status ?: 'pending'),
                'progress' => 0.0,
                'stage' => $leased ? 'leased' : (string) ($row->tts_status ?: 'pending'),
                'backend_uploaded' => false,
                'tts_locked_by' => $leased ? $row->tts_locked_by : null,
                'assigned_at' => $leased ? $row->tts_locked_at : null,
                'updated_at' => $row->updated_at,
                'occurrence_count' => (int) $row->occurrence_count,
                'missing_variants' => [],
            ];
        }
        $last = $rows->last();
        $counts = LangSentence::audioGapCounts($code);
        $nextCursor = $last !== null ? (int) $last->id : $cursorId;

        return [
            'total' => $counts['pending'] + $counts['failed'],
            'page' => 1,
            'per_page' => $perPage,
            'language' => $code,
            'cursor_id' => $cursorId,
            'next_cursor' => $nextCursor,
            'has_more' => $hasMore,
            'progress' => QueueProgress::make($counts['done'], $counts['failed'], $counts['pending'], $nextCursor),
            'items' => $items,
            'summary' => [
                'languages' => $gaps,
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

    /**
     * Passive default-variant resolve for many sentences: one row query per
     * language, then exactly one disk check per item (the cached audio path
     * when the row has one, else the canonical mp3 path). Never enqueues.
     *
     * @param array<int,array{text:string,language:string}> $items
     * @return array<int,array{content_id:string,language:string,exists:bool,url:?string}> same keys as $items
     */
    public function resolvePassiveBatch(array $items): array
    {
        $contentIds = [];
        $rows = [];
        $results = [];

        foreach ($items as $key => $item) {
            $language = AppQyV1TableMaps::normalizeLangCode((string) $item['language']);
            $contentIds[$language][$key] = MediaIngestService::computeContentId((string) $item['text']);
        }
        foreach ($contentIds as $language => $ids) {
            $rows[$language] = $this->tableExists($language)
                ? LangSentence::rowsByContentIds($language, $ids)->keyBy('content_id')->all()
                : [];
        }
        foreach ($contentIds as $language => $ids) {
            foreach ($ids as $key => $contentId) {
                $row = $rows[$language][$contentId] ?? null;
                $cached = $row !== null && $row->has_audio && is_string($row->audio) && $row->audio !== ''
                    ? $row->audio
                    : null;
                $relative = $cached ?? $this->relativePathFor($language, $contentId);
                $full = PathMapper::getAppQyV1SentenceSoundsDir($relative);
                clearstatcache(true, $full);
                $exists = is_file($full) && filesize($full) > 0;
                $results[$key] = [
                    'content_id' => $contentId,
                    'language' => $language,
                    'exists' => $exists,
                    'url' => $exists ? AppQyV1SentenceAudioUrl::forRelative($relative) : null,
                ];
            }
        }

        return array_replace(array_fill_keys(array_keys($items), null), $results);
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
            // A playback text is not library content: it gets audio on request
            // but never joins the audio gap or the library listings.
            'origin' => LangSentence::ORIGIN_ADHOC,
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
