<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Events\WordTranslatedEvent;
use App\Events\TranslationTaskCompletedEvent;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Word Translation Write-back
 *
 * Single source of truth for persisting word_translation results into the
 * canonical dictionary table (tts_cache_{lang}, AppQyV1LangDictionaryModel).
 * Used by both WordTranslationTaskProcessor (worker results) and the Laravel
 * AI self-filler timer.
 *
 * To keep the read side of the loop intact, each word is written in two shapes:
 *   1. translations[target_language] = translation
 *      Flat map read by the FE status endpoint and by the statistics aggregate
 *      (with_translation counter).
 *   2. translations['word_translation'] gets a [target_language, translation]
 *      pair appended. This is the exact structure
 *      AppQyV1VocabularyLibraryPublicController::getLibraryWords decodes
 *      (it surfaces $trans[1] of every word_translation entry), so the words
 *      list endpoint shows the translation without further changes.
 *
 * has_translation is set true and translation_provider records the source
 * (google / openrouter:model / etc.).
 */
class AppQyV1WordTranslationWriteback
{
    /**
     * Persist a batch of word results for one (language, target_language) pair.
     * Rows are matched by md5(word); a missing row is created minimally so a
     * translation is never lost.
     *
     * Each entry is ['word' => ..., 'translation' => ...] plus optional rich
     * fields produced by the Bing assist worker. AUDIO and IMAGES are
     * BINARY/BASE64 only — the Bing media URLs are not fetchable server-side, so
     * the chrome side captures the bytes in-page; there is NO server-side URL
     * fetch here. All rich fields are optional and never clobber existing data
     * (fill-missing):
     *   - 'phonetic' / 'us_phonetic' / 'uk_phonetic' (strings)
     *   - 'image_base64' (Bing sample images: base64 string list, or a list of
     *     { base64, mime? }) -> decoded, validated by magic bytes, stored as
     *     LOCAL files; their relative paths go into image_files
     *   - 'audio_base64' (base64 mp3 of Bing's pronunciation) -> stored via
     *     AppQyV1DictionaryTTSCoordinator::storeWordAudioBytes
     *
     * $invalidWords is a list of ['word' => ...] (or bare strings) the worker
     * could not resolve on Bing (confirmed no-entry); each is flagged
     * is_valid=false via markValidity so the enqueue side stops re-queuing it.
     *
     * $regionRedirectWords is the same shape: words that persistently landed on a
     * non-dict (region/redirect) page after retries. They are flagged invalid
     * too, but with validity_source='region-redirect' so the cause is auditable
     * and distinguishable from a confirmed no-entry.
     *
     * @param string $taskId              Originating global task id (logging only)
     * @param string $language            Source/library language (name or code)
     * @param string $targetLanguage      Target language code (e.g. "zh")
     * @param string $provider            Translation provider label
     * @param array  $translations        List of per-word result entries (see above)
     * @param array  $invalidWords        Words with no online dictionary entry
     * @param array  $regionRedirectWords Words stuck on a region/redirect page
     * @return array  ['processed' => int, 'failed' => int, 'invalidated' => int]
     */
    public static function apply(
        string $taskId,
        string $language,
        string $targetLanguage,
        string $provider,
        array $translations,
        array $invalidWords = [],
        array $regionRedirectWords = []
    ): array {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        $processed = 0;
        $failed = 0;
        $invalidated = 0;
        // Binaries actually written to disk after commit — reported back to the
        // worker so it can log the backend's audio/image reception result.
        $audioSaved = 0;
        $imagesSaved = 0;

        // Audio writes do file I/O, so they are deferred to after the row-lock
        // transaction commits (collected as [md5 => raw mp3 bytes]).
        $audioQueue = [];

        // Image writes also do file I/O; deferred to after-commit, collected as
        // [md5 => ['content' => word, 'images' => [base64 entries]]].
        $imageQueue = [];

        // Map each word to its md5 once (was a findByMd5 per word).
        $md5ByWord = [];
        foreach ($translations as $item) {
            $word = $item['word'] ?? null;
            if (is_string($word) && $word !== '') {
                $md5ByWord[$word] = md5($word);
            }
        }

        // Words successfully persisted in this batch, queued for after-commit
        // broadcast. The word.translated signal must fire AFTER the dictionary
        // write commits, never while the row lock is held, so collect here and
        // emit once the transaction has committed.
        $broadcastQueue = [];

        // Atomic read-modify-write: two workers writing DIFFERENT target languages
        // of the SAME word would otherwise both read the same translations JSON,
        // each add their key, and the last save would clobber the other's key.
        // Run the whole batch inside ONE transaction on the dictionary connection
        // and SELECT ... FOR UPDATE the rows so concurrent writers serialize on
        // them. One batch lock per call (whereIn result order) -> no cross-row
        // ordering deadlock. Run on the model's own connection (the processor's
        // outer transaction is on the default/global_tasks connection; the
        // self-filler path calls apply() with no surrounding transaction at all).
        $connName = AppQyV1LangDictionaryModel::forLanguage($langCode)->getConnectionName();

        DB::connection($connName)->transaction(function () use (
            $translations,
            $md5ByWord,
            $langCode,
            $targetCode,
            $provider,
            $taskId,
            &$processed,
            &$failed,
            &$broadcastQueue,
            &$audioQueue,
            &$imageQueue
        ) {
            // Pre-load every word's dictionary row in ONE locked query. Enqueue
            // already created these rows, so they almost always exist; a rare miss
            // falls back to createOrFind in the loop.
            $rows = empty($md5ByWord)
                ? collect()
                : AppQyV1LangDictionaryModel::forLanguage($langCode)
                    ->whereIn('md5', array_values($md5ByWord))
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('md5');

            foreach ($translations as $item) {
                $word = $item['word'] ?? null;
                $translationText = $item['translation'] ?? null;
                $hasTranslation = is_string($translationText) && $translationText !== '';

                // Images are BASE64-ONLY (same rule as audio): the Bing image URLs
                // are not fetchable server-side, so the chrome side captures the
                // bytes in-page and submits image_base64. Each entry is a base64
                // string or { base64, mime? }. No image-URL fetch anywhere.
                $imageBase64 = self::normalizeImageBase64($item);
                $hasImages = !empty($imageBase64);

                // Audio is BASE64-ONLY: the Bing pronunciation URL is not openable
                // server-side (it requires the live page referrer/session), so the
                // chrome side captures the bytes in-page and submits audio_base64.
                // No audio_url download anywhere.
                $audioBase64 = $item['audio_base64'] ?? null;
                $hasPhonetic = !empty($item['phonetic']) || !empty($item['us_phonetic']) || !empty($item['uk_phonetic']);
                $hasAudio = is_string($audioBase64) && $audioBase64 !== '';

                // An entry must carry at least one usable field. A bare word with
                // nothing attached is a no-op, not a translation.
                if ($word === null || $word === '' ||
                    (!$hasTranslation && !$hasPhonetic && !$hasImages && !$hasAudio)) {
                    $failed++;
                    continue;
                }

                try {
                    $entry = $rows->get($md5ByWord[$word] ?? md5($word));

                    // Create a minimal row if the word is not in the dictionary
                    // yet, so a freshly enqueued word still receives its
                    // translation. createOrFind issues its own SELECT/INSERT inside
                    // this transaction; re-read it FOR UPDATE so the merge below is
                    // also lock-protected against a concurrent target writer.
                    if (!$entry) {
                        AppQyV1LangDictionaryModel::createOrFind($langCode, $word);
                        $entry = AppQyV1LangDictionaryModel::forLanguage($langCode)
                            ->where('md5', md5($word))
                            ->lockForUpdate()
                            ->first();
                        if ($entry) {
                            $rows->put($entry->md5, $entry);
                        }
                    }

                    if (!$entry) {
                        $failed++;
                        continue;
                    }

                    $dirty = false;

                    // --- Translation text (when the worker found definitions) ---
                    if ($hasTranslation) {
                        $current = $entry->translations;
                        if (!is_array($current)) {
                            $current = [];
                        }

                        // 1. Flat map keyed by target language (status endpoint reads
                        //    this).
                        $current[$targetCode] = $translationText;

                        // 2. Nested word_translation list (getLibraryWords reads
                        //    $trans[1]).
                        $wordTranslation = [];
                        if (isset($current['word_translation']) && is_array($current['word_translation'])) {
                            $wordTranslation = $current['word_translation'];
                        }

                        $replaced = false;
                        foreach ($wordTranslation as $idx => $pair) {
                            if (is_array($pair) && isset($pair[0]) && $pair[0] === $targetCode) {
                                $wordTranslation[$idx] = [$targetCode, $translationText];
                                $replaced = true;
                                break;
                            }
                        }
                        if (!$replaced) {
                            $wordTranslation[] = [$targetCode, $translationText];
                        }
                        $current['word_translation'] = array_values($wordTranslation);

                        $entry->translations = $current;
                        $entry->has_translation = true;
                        $entry->translation_provider = $provider;
                        $dirty = true;

                        // Queue the multi-worker coordination signal (Phase-C
                        // `word.translated`) for after-commit. It must not fire
                        // while the row lock is held.
                        $broadcastQueue[] = [
                            'word' => $word,
                            'translation' => $translationText,
                        ];
                    }

                    // --- Phonetics (fill-missing — never overwrite existing) ---
                    if (!empty($item['phonetic']) && empty($entry->phonetic)) {
                        $entry->phonetic = $item['phonetic'];
                        $dirty = true;
                    }
                    if (!empty($item['us_phonetic']) && empty($entry->us_phonetic)) {
                        $entry->us_phonetic = $item['us_phonetic'];
                        $dirty = true;
                    }
                    if (!empty($item['uk_phonetic']) && empty($entry->uk_phonetic)) {
                        $entry->uk_phonetic = $item['uk_phonetic'];
                        $dirty = true;
                    }

                    // --- Images: queue base64 for after-commit file storage ---
                    // Fill-missing — only when the row has no images yet; the
                    // decode/validate/write-file + image_files update happens after
                    // the lock is released (file I/O must not run under the lock).
                    if ($hasImages && empty($entry->image_files)) {
                        $imageQueue[$entry->md5] = [
                            'content' => $entry->content,
                            'images' => $imageBase64,
                        ];
                    }

                    if ($dirty) {
                        $entry->save();
                    }

                    // --- Audio: decode now, persist after commit (file I/O) ---
                    if ($hasAudio && empty($entry->has_audio)) {
                        $bytes = base64_decode($audioBase64, true);
                        if ($bytes !== false && $bytes !== '') {
                            $audioQueue[$entry->md5] = $bytes;
                        }
                    }

                    $processed++;
                } catch (\Throwable $e) {
                    Log::error('[AppQyV1WordTranslationWriteback] Failed to write translation', [
                        'task_id' => $taskId,
                        'word' => $word,
                        'error' => $e->getMessage(),
                    ]);
                    $failed++;
                }
            }
        });

        // After the dictionary write has committed (lock released), announce each
        // freshly persisted word so every other pycore worker can SKIP it
        // ("one finished -> others skip"). Best-effort only; the dictionary row is
        // the source of truth, so a broadcast failure must never fail write-back.
        foreach ($broadcastQueue as $signal) {
            $word = $signal['word'];
            $translationText = $signal['translation'];
            self::broadcastSafely(static function () use ($word, $langCode, $targetCode, $translationText, $provider) {
                event(new WordTranslatedEvent(
                    $word,
                    $langCode,
                    $targetCode,
                    $translationText,
                    $provider
                ));
            }, 'word.translated', $taskId, $word);
        }

        // Persist Bing pronunciation audio after the lock is released — file I/O
        // must not run inside the row-lock transaction. The coordinator validates
        // MP3 magic, writes to the deterministic EdgeTTS path, and flips has_audio
        // (fill-missing). Best-effort: an audio failure never fails translation.
        if (!empty($audioQueue)) {
            $coordinator = new AppQyV1DictionaryTTSCoordinator();
            foreach ($audioQueue as $md5 => $bytes) {
                try {
                    if ($coordinator->storeWordAudioBytes($langCode, $md5, $bytes, 'bing')) {
                        $audioSaved++;
                    }
                } catch (\Throwable $e) {
                    Log::warning('[AppQyV1WordTranslationWriteback] audio store failed', [
                        'task_id' => $taskId,
                        'md5' => $md5,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        // Persist Bing sample images after the lock is released — file I/O must
        // not run inside the row-lock transaction. Each queued image is decoded,
        // validated by magic bytes, written to the local word-images dir, and the
        // resulting LOCAL relative paths are stored into image_files (fill-missing,
        // re-checked: only when the row still has no images). Best-effort: an image
        // failure never fails translation.
        foreach ($imageQueue as $md5 => $payload) {
            try {
                $imagesSaved += self::storeWordImages($langCode, (string) $md5, $payload['content'] ?? '', $payload['images'] ?? []);
            } catch (\Throwable $e) {
                Log::warning('[AppQyV1WordTranslationWriteback] image store failed', [
                    'task_id' => $taskId,
                    'md5' => $md5,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Flag words the worker could not resolve on Bing as invalid so the
        // enqueue side stops re-queuing them (getWordsNeedingTranslation /
        // stackWords both filter is_valid). markValidity is its own UPDATE and
        // invalidates the metrics cache.
        foreach ($invalidWords as $invalid) {
            $invalidWord = is_array($invalid) ? ($invalid['word'] ?? null) : $invalid;
            if (!is_string($invalidWord) || $invalidWord === '') {
                continue;
            }
            try {
                $marked = AppQyV1LangDictionaryModel::markValidity(
                    $langCode,
                    md5($invalidWord),
                    false,
                    'bing-assist',
                    'No Bing dictionary result'
                );
                if ($marked) {
                    $invalidated++;
                }
            } catch (\Throwable $e) {
                Log::warning('[AppQyV1WordTranslationWriteback] markValidity failed', [
                    'task_id' => $taskId,
                    'word' => $invalidWord,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Flag words stuck on a Bing region/redirect (non-dict) page after retries
        // as invalid too, with a distinct source so the cause stays auditable. They
        // become placeholder rows (is_valid=false, has_translation=false) that the
        // enqueue side skips, ending the infinite region-redirect re-queue loop.
        foreach ($regionRedirectWords as $redirect) {
            $redirectWord = is_array($redirect) ? ($redirect['word'] ?? null) : $redirect;
            if (!is_string($redirectWord) || $redirectWord === '') {
                continue;
            }
            try {
                $marked = AppQyV1LangDictionaryModel::markValidity(
                    $langCode,
                    md5($redirectWord),
                    false,
                    'region-redirect',
                    'Bing region/redirect — no dictionary page'
                );
                if ($marked) {
                    $invalidated++;
                }
            } catch (\Throwable $e) {
                Log::warning('[AppQyV1WordTranslationWriteback] region-redirect markValidity failed', [
                    'task_id' => $taskId,
                    'word' => $redirectWord,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Translation writes change has_translation coverage -> invalidate the
        // cached dashboard dictionary metrics for the source language.
        if ($processed > 0) {
            AppQyV1LangDictionaryModel::forgetMetricsCache($langCode);
        }

        Log::info('[AppQyV1WordTranslationWriteback] Word translations written', [
            'task_id' => $taskId,
            'language' => $langCode,
            'target_language' => $targetCode,
            'provider' => $provider,
            'processed' => $processed,
            'failed' => $failed,
            'invalidated' => $invalidated,
        ]);

        // Signal that this task's batch is fully written back (Phase-C
        // `task.completed`). Authoritative completion is still the global task
        // status set by the HTTP result endpoint; this is the real-time hint.
        if ($processed > 0) {
            self::broadcastSafely(static function () use ($taskId, $targetCode, $processed) {
                event(new TranslationTaskCompletedEvent($taskId, $targetCode, $processed));
            }, 'task.completed', $taskId, null);
        }

        return [
            'processed' => $processed,
            'failed' => $failed,
            'invalidated' => $invalidated,
        ];
    }

    /**
     * Normalize an entry's image payload into a flat list of base64 strings.
     * Accepts `image_base64` as a list of base64 strings OR a list of
     * { base64, mime? } objects (mime is advisory only — the real type is
     * decided by magic bytes at store time). Returns [] when absent/empty.
     *
     * @return array<int, string>  base64 strings
     */
    private static function normalizeImageBase64(array $item): array
    {
        $raw = $item['image_base64'] ?? null;
        if ($raw === null) {
            return [];
        }
        if (is_string($raw)) {
            $raw = [$raw];
        }
        if (!is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $img) {
            if (is_string($img) && $img !== '') {
                $out[] = $img;
            } elseif (is_array($img) && isset($img['base64']) && is_string($img['base64']) && $img['base64'] !== '') {
                $out[] = $img['base64'];
            }
        }
        return $out;
    }

    /**
     * Decode + validate + store a word's Bing sample images as LOCAL files, then
     * write their relative paths into image_files (fill-missing).
     *
     * Mirrors AppQyV1DictionaryTTSCoordinator::storeWordAudioBytes: the row is
     * re-read here (after the lock released), and images are written ONLY when the
     * row still has none — existing images are never clobbered. Each base64 entry
     * is decoded, validated by image magic bytes (PNG/JPEG/GIF/WebP), and written
     * to PathMapper::getAppQyV1WordImagesDir("{lang}/word/{md5}_{i}.{ext}"). The
     * stored image_files value is the list of bare relative paths (served via
     * AppQyV1ImageUrl). No external image-URL fetch anywhere.
     *
     * @param array<int, string> $base64List
     * @return int Number of image files actually written (0 when none/skipped).
     */
    private static function storeWordImages(string $langCode, string $md5, string $content, array $base64List): int
    {
        if ($md5 === '' || empty($base64List)) {
            return 0;
        }

        $entry = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('md5', $md5)
            ->first();
        if (!$entry) {
            return 0;
        }
        // Fill-missing: never clobber existing images.
        if (!empty($entry->image_files)) {
            return 0;
        }

        $baseDir = PathMapper::getAppQyV1WordImagesDir($langCode . '/word');
        FileSystemManager::ensureDirectoryExists($baseDir);

        $relativePaths = [];
        $index = 0;
        foreach ($base64List as $b64) {
            // Strip an optional data-URI prefix ("data:image/png;base64,....").
            if (is_string($b64) && str_starts_with($b64, 'data:')) {
                $comma = strpos($b64, ',');
                if ($comma !== false) {
                    $b64 = substr($b64, $comma + 1);
                }
            }
            $bytes = base64_decode((string) $b64, true);
            if ($bytes === false || $bytes === '' || strlen($bytes) < 64) {
                continue;
            }

            $ext = self::imageExtFromMagic($bytes);
            if ($ext === null) {
                // Not a recognized image (PNG/JPEG/GIF/WebP) — reject.
                continue;
            }

            $suffix = $index === 0 ? '' : ('_' . $index);
            $relative = $langCode . '/word/' . $md5 . $suffix . '.' . $ext;
            $fullPath = PathMapper::getAppQyV1WordImagesDir($relative);
            FileSystemManager::ensureDirectoryExists(dirname($fullPath));

            if (@file_put_contents($fullPath, $bytes) === false) {
                continue;
            }
            clearstatcache(true, $fullPath);
            if (!file_exists($fullPath) || filesize($fullPath) !== strlen($bytes)) {
                @unlink($fullPath);
                continue;
            }

            $relativePaths[] = $relative;
            $index++;
        }

        if (empty($relativePaths)) {
            return;
        }

        // Re-check fill-missing right before the write (a concurrent path may have
        // filled images between the read above and now).
        $entry->refresh();
        if (!empty($entry->image_files)) {
            return;
        }
        $entry->image_files = $relativePaths;
        $entry->image_provider = 'bing';

        // Reflect queue completion on the image_* process-state columns (mirrors
        // the tts_* completion transition) so the image queue/coordinator sees
        // the row as done. Guarded with hasAttribute-style isset so a host whose
        // image_* migration has not run yet still stores images without error.
        if (\Illuminate\Support\Facades\Schema::connection($entry->getConnectionName())
            ->hasColumn($entry->getTable(), 'image_status')) {
            $entry->image_status = 'completed';
            $entry->image_completed_at = now();
            $entry->image_locked_at = null;
            $entry->image_locked_by = null;
        }

        $entry->save();

        Log::info('[AppQyV1WordTranslationWriteback] Word images stored', [
            'language' => $langCode,
            'md5' => $md5,
            'count' => count($relativePaths),
        ]);
    }

    /**
     * Decide an image file extension from magic bytes. Returns null when the
     * bytes are not a recognized raster image (PNG / JPEG / GIF / WebP).
     */
    private static function imageExtFromMagic(string $bytes): ?string
    {
        $len = strlen($bytes);
        if ($len < 12) {
            return null;
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (substr($bytes, 0, 8) === "\x89PNG\x0d\x0a\x1a\x0a") {
            return 'png';
        }
        // JPEG: FF D8 FF
        if (substr($bytes, 0, 3) === "\xff\xd8\xff") {
            return 'jpg';
        }
        // GIF: "GIF87a" / "GIF89a"
        if (substr($bytes, 0, 6) === 'GIF87a' || substr($bytes, 0, 6) === 'GIF89a') {
            return 'gif';
        }
        // WebP: "RIFF"...."WEBP"
        if (substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP') {
            return 'webp';
        }
        return null;
    }

    /**
     * Run a broadcast closure best-effort. Reverb is a signaling layer on top of
     * the reliable HTTP work transport, so any broadcast failure (Reverb down,
     * etc.) is logged and swallowed rather than allowed to fail the write-back.
     */
    private static function broadcastSafely(
        callable $broadcast,
        string $eventName,
        string $taskId,
        ?string $word
    ): void {
        $fire = static function () use ($broadcast, $eventName, $taskId, $word): void {
            try {
                $broadcast();
            } catch (\Throwable $e) {
                Log::warning('[AppQyV1WordTranslationWriteback] broadcast failed', [
                    'event' => $eventName,
                    'task_id' => $taskId,
                    'word' => $word,
                    'error' => $e->getMessage(),
                ]);
            }
        };

        // The write-back runs inside the worker-result DB transaction (which holds
        // a row lock on the global task). A ShouldBroadcastNow event is a
        // SYNCHRONOUS HTTP round-trip to Reverb, so firing it inline would hold
        // that lock for the whole round-trip (x40 words/task) and pin an Octane
        // worker. Defer to after-commit when inside a transaction (it also avoids
        // announcing a word that a later rollback would undo); fire immediately
        // otherwise. Guarded so it degrades to immediate on any older runtime.
        try {
            $connection = \Illuminate\Support\Facades\DB::connection();
            if (method_exists($connection, 'afterCommit') && $connection->transactionLevel() > 0) {
                $connection->afterCommit($fire);
                return;
            }
        } catch (\Throwable $e) {
            // Fall through to an immediate best-effort broadcast.
        }

        $fire();
    }
}
