<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordTranslationWriteback;
use Illuminate\Support\Facades\Log;

/**
 * Word Gemini-Image Task Processor
 *
 * Write-back stage for the `gemini_image` task type (execution_type
 * 'remote_gemini' — its own dedicated lane, pulled by the chrome Task Center
 * Gemini-image worker which drives the chrome_gemini_image MCP tool). It is an
 * ALTERNATIVE image generator for words whose Bing sample images are missing —
 * a sibling of the `word_media` lane (which runs on remote_fast + image).
 *
 * Task contract (SHARED CONTRACT v3):
 *   payload : { prompt, size?, md5?, word?, language? }
 *   result  : { result: { image_base64, mime:'image/png', provider:'gemini' } }
 *
 * The generated image is persisted to the canonical word-images tree and the
 * row's image_files via the SAME validated, fill-missing, idempotent path the
 * Bing lane uses (AppQyV1WordTranslationWriteback::apply, which decodes,
 * magic-byte validates, writes under PathMapper::getAppQyV1WordImagesDir, and
 * flips the image_* state). We reshape the single gemini image into the
 * writeback's translations[] entry shape so the storage code is reused verbatim
 * — no second image-writing implementation.
 */
class WordGeminiImageTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    public function canProcess(GlobalTask $task): bool
    {
        return $task->app_name === 'AppQyV1'
            && $task->task_type === 'gemini_image';
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        if ($isDemoMode) {
            return 0;
        }

        $payload = is_array($task->payload) ? $task->payload : [];

        // Source/library language the dictionary row lives under (e.g. "en").
        $language = $payload['language'] ?? 'en';

        // The word can come from payload.word, or be the first words[] entry
        // (gemini_image enqueue may reuse the word_media payload shape).
        $word = $payload['word'] ?? null;
        if (($word === null || $word === '') && isset($payload['words']) && is_array($payload['words'])) {
            $first = $payload['words'][0] ?? null;
            $word = is_array($first) ? ($first['word'] ?? null) : (is_string($first) ? $first : null);
        }

        if (!is_string($word) || $word === '') {
            Log::warning('[WordGeminiImageTaskProcessor] No word in payload, nothing stored', [
                'task_id' => $task->task_id,
            ]);
            return 0;
        }

        // Worker may nest under result.result (documented) or send flat.
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;
        $imageBase64 = $inner['image_base64'] ?? null;
        $mime = $inner['mime'] ?? 'image/png';
        $provider = $inner['provider'] ?? 'gemini';

        if (!is_string($imageBase64) || $imageBase64 === '') {
            Log::warning('[WordGeminiImageTaskProcessor] No image_base64 in result, nothing stored', [
                'task_id' => $task->task_id,
                'word' => $word,
            ]);
            return 0;
        }

        // Reshape into the writeback's per-word entry shape. image_base64 accepts
        // a list of base64 strings OR { base64, mime? } objects. NOTE: the
        // writeback's normalizeImageBase64() reads only ['base64'] and DROPS the
        // mime — the real file type is decided by magic bytes at store time
        // (imageExtFromMagic), so the mime here is advisory/ignored and a wrong
        // mime cannot mislabel the file. We still pass the object form (with the
        // reported mime) for self-documenting provenance. No translation text,
        // no audio: this is image-only, and apply() is fill-missing (it only
        // writes images when the row has none, never clobbering existing media).
        $translations = [[
            'word' => $word,
            'image_base64' => [[
                'base64' => $imageBase64,
                'mime' => is_string($mime) ? $mime : 'image/png',
            ]],
        ]];

        $outcome = AppQyV1WordTranslationWriteback::apply(
            $task->task_id,
            $language,
            // target_language is irrelevant for an image-only write; pass the
            // source language so getLanguageCode resolves to a valid code.
            $language,
            'gemini:' . (is_string($provider) ? $provider : 'gemini'),
            $translations,
            [],
            []
        );

        Log::info('[WordGeminiImageTaskProcessor] Gemini word image written', [
            'task_id' => $task->task_id,
            'word' => $word,
            'language' => $language,
        ]);

        // processed counts the image-bearing entry persisted (fill-missing: a row
        // that already had an image yields 0, which the result-trust layer treats
        // as an empty store — the image was not newly stored).
        return (int) ($outcome['processed'] ?? 0);
    }

    public function getPriority(): int
    {
        return 10;
    }
}
