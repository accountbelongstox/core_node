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

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1ImageUrl;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * Word-image queue service — the IMAGE twin of AppQyV1UnifiedTTSQueueService.
 *
 * Queue-less by design: the image generation PROCESS state lives on the
 * canonical per-language dictionary row ({prefix}_tts_cache_{lang},
 * AppQyV1LangDictionaryModel) in the image_* columns (image_status /
 * image_priority / image_locked_* / image_attempts / image_requested_at /
 * image_completed_at), exactly mirroring the tts_* columns.
 *
 * add()/addBatch() semantics match the TTS queue add (so the FE + pycore see one
 * model):
 *   - already_available : the image file is on disk -> nothing to do.
 *   - moved_to_front    : re-request with position 'beginning' assigns a
 *                         MAX(image_priority)+1 ticket.
 *   - queued            : marked image_status='pending' with image_priority at
 *                         least PRIORITY_DEFAULT.
 *
 * IMAGES ARE BASE64-ONLY end to end: the resolved image bytes are produced by
 * the Bing-assist worker / chrome side (the Bing image URLs are not fetchable
 * server-side) and persisted by AppQyV1WordTranslationWriteback from the
 * word_media task result. This service only manages the QUEUE/priority state and
 * the file-first existence check; it never fetches an image URL.
 */
class AppQyV1WordImageQueueService
{
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    /** Default priority floor applied when a word is queued without 'beginning'. */
    const PRIORITY_DEFAULT = 30;

    /**
     * Add a batch of words to the image queue.
     *
     * @param array  $words    List of ['word' => ..., 'language' => ...] entries.
     * @param string $position 'beginning' (move-to-front) | 'end' (default).
     * @return array { success, total, results:[ per-word add result ] }
     */
    public function addBatch(array $words, string $position = 'end'): array
    {
        $results = [];
        $entries = $position === 'beginning' ? array_reverse($words, true) : $words;
        $prepared = [];
        $hashesByLanguage = [];
        $rowsByLanguage = [];

        foreach ($entries as $index => $entry) {
            $word = is_array($entry) ? ($entry['word'] ?? null) : null;
            $language = is_array($entry) ? ($entry['language'] ?? null) : null;

            if (!is_string($word) || $word === '' || !is_string($language) || $language === '') {
                $results[] = [
                    'success' => false,
                    'error' => 'Missing required fields (word, language)',
                    'index' => $index,
                ];
                continue;
            }

            $trimmedWord = trim($word);
            if ($trimmedWord === '') {
                $results[] = [
                    'success' => false,
                    'error' => 'Empty word',
                    'index' => $index,
                    'word' => $word,
                ];
                continue;
            }

            $langCode = AppQyV1DictionaryService::getLanguageCode($language);
            $hash = md5($trimmedWord);
            $prepared[] = [
                'index' => $index,
                'word' => $trimmedWord,
                'language' => $langCode,
                'hash' => $hash,
            ];
            $hashesByLanguage[$langCode][] = $hash;
        }

        foreach ($hashesByLanguage as $langCode => $hashes) {
            $rowsByLanguage[$langCode] = AppQyV1LangDictionaryModel::rowsByHashes($langCode, $hashes)
                ->keyBy('md5');
        }

        foreach ($prepared as $item) {
            $entry = $rowsByLanguage[$item['language']]->get($item['hash']);
            if (!$entry) {
                $entry = AppQyV1LangDictionaryModel::newImageQueueEntry($item['language'], $item['word']);
                $rowsByLanguage[$item['language']]->put($item['hash'], $entry);
            }
            $result = $this->addResolved($item['word'], $item['language'], $entry, $position);
            $result['index'] = $item['index'];
            $result['word'] = $item['word'];
            $results[] = $result;
        }
        usort($results, static fn (array $left, array $right): int =>
            ((int) ($left['index'] ?? 0)) <=> ((int) ($right['index'] ?? 0))
        );

        return [
            'success' => true,
            'total' => count($words),
            'results' => $results,
        ];
    }

    /**
     * Add one word to the image queue (idempotent against the canonical row).
     *
     * @param string $word
     * @param string $language Language code or full name.
     * @param string $position 'beginning' | 'end'
     * @return array
     */
    public function add(string $word, string $language, string $position = 'end'): array
    {
        $word = trim($word);
        if ($word === '') {
            return ['success' => false, 'error' => 'Empty word'];
        }

        // Accept a full NAME ("english") OR a 2-letter CODE ("en") interchangeably.
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);

        $md5 = md5($word);
        $entry = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);

        return $this->addResolved($word, $langCode, $entry, $position);
    }

    private function addResolved(
        string $word,
        string $langCode,
        ?AppQyV1LangDictionaryModel $entry,
        string $position
    ): array {

        // A local image is final only after mcp-chrome has submitted it. Legacy
        // files remain visible while a Chrome replacement is queued.
        if ($entry && $this->imageOnDisk($entry) && $this->submittedByMcp($entry)) {
            return [
                'success' => true,
                'status' => 'already_available',
                'word' => $word,
                'language' => $langCode,
                'image_url' => $this->firstImageUrl($entry),
            ];
        }

        // Auto-create a minimal dictionary row when absent so a freshly enqueued
        // word still receives its image (mirrors the TTS queue's auto-create).
        if (!$entry) {
            $entry = AppQyV1LangDictionaryModel::newImageQueueEntry($langCode, $word);
        }

        $status = $this->markRowPending($entry, $position);

        return [
            'success' => true,
            'status' => $status,
            'word' => $word,
            'language' => $langCode,
            'position' => $position,
        ];
    }

    /**
     * Move a queried word to the FRONT of the image queue (on-query
     * prioritization). Only touches a row that still lacks an image; cheap and
     * non-blocking (callers swallow failures).
     */
    public function bumpToFront(string $word, string $language): bool
    {
        $word = trim($word);
        if ($word === '') {
            return false;
        }

        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $entry = AppQyV1LangDictionaryModel::findByMd5($langCode, md5($word));
        if (!$entry) {
            // Nothing to bump yet — the resolve/add path creates the row.
            return false;
        }

        // Only a Chrome-submitted image is terminal.
        if ($this->imageOnDisk($entry) && $this->submittedByMcp($entry)) {
            return false;
        }

        $this->markRowPending($entry, 'beginning');
        return true;
    }

    /**
     * Flip a dictionary row to image_status='pending' and return the external
     * add-status string (queued | moved_to_front). Mirrors the TTS queue's
     * markRowPending on the image_* columns.
     */
    private function markRowPending(AppQyV1LangDictionaryModel $row, string $position): string
    {
        $moveToFront = $position === 'beginning';
        $status = $moveToFront ? 'moved_to_front' : 'queued';

        $row->markImagePending($moveToFront, self::PRIORITY_DEFAULT);

        return $status;
    }

    /**
     * File-first: true only when at least one image_files entry resolves to a
     * real file on disk under the canonical word-images dir.
     */
    private function imageOnDisk(AppQyV1LangDictionaryModel $row): bool
    {
        $imageFiles = $row->image_files;
        if (!is_array($imageFiles) || empty($imageFiles)) {
            return false;
        }

        foreach ($imageFiles as $imageFile) {
            $relative = $this->relativeOf($imageFile);
            if ($relative === null) {
                continue;
            }
            $fullPath = PathMapper::getAppQyV1WordImagesDir($relative);
            if (is_file($fullPath)) {
                return true;
            }
        }

        return false;
    }

    private function submittedByMcp(AppQyV1LangDictionaryModel $row): bool
    {
        return $row->hasImageMcpSubmissionColumn()
            && $row->getAttribute('image_mcp_submitted_at') !== null;
    }

    /**
     * Public URL of the first image_files entry that resolves to a file on disk,
     * or null. Uses AppQyV1ImageUrl so absolute http(s) entries pass through.
     */
    private function firstImageUrl(AppQyV1LangDictionaryModel $row): ?string
    {
        $imageFiles = $row->image_files;
        if (!is_array($imageFiles)) {
            return null;
        }

        foreach ($imageFiles as $imageFile) {
            $relative = $this->relativeOf($imageFile);
            if ($relative === null) {
                continue;
            }
            $fullPath = PathMapper::getAppQyV1WordImagesDir($relative);
            if (is_file($fullPath)) {
                return AppQyV1ImageUrl::forEntry($imageFile);
            }
        }

        return null;
    }

    /**
     * Extract the bare relative path from a heterogeneous image_files entry
     * (string OR { path }/{ url }). Absolute URLs return null (not on-disk).
     */
    private function relativeOf($entry): ?string
    {
        $raw = null;
        if (is_string($entry)) {
            $raw = $entry;
        } elseif (is_array($entry)) {
            if (isset($entry['path']) && is_string($entry['path'])) {
                $raw = $entry['path'];
            } elseif (isset($entry['url']) && is_string($entry['url'])) {
                $raw = $entry['url'];
            }
        }

        if (!is_string($raw) || $raw === '') {
            return null;
        }
        // Absolute or already-served URLs are not local relative paths.
        if (preg_match('#^https?://#i', $raw) === 1 || str_starts_with($raw, '//') || str_starts_with($raw, '/')) {
            return null;
        }

        return ltrim($raw, '/');
    }
}
