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
     * fields produced by the Bing assist worker:
     *   - 'phonetic' / 'us_phonetic' / 'uk_phonetic' (strings, fill-missing)
     *   - 'image_urls'  (list of Bing sample-image URLs, fill-missing)
     *   - 'audio_base64' (base64 mp3 of Bing's pronunciation, fill-missing)
     * All rich fields are optional and never clobber existing data.
     *
     * $invalidWords is a list of ['word' => ...] (or bare strings) the worker
     * could not resolve on Bing; each is flagged is_valid=false via markValidity
     * so the enqueue side stops re-queuing it.
     *
     * @param string $taskId         Originating global task id (logging only)
     * @param string $language       Source/library language (name or code)
     * @param string $targetLanguage Target language code (e.g. "zh")
     * @param string $provider       Translation provider label
     * @param array  $translations   List of per-word result entries (see above)
     * @param array  $invalidWords   List of words with no online dictionary entry
     * @return array  ['processed' => int, 'failed' => int, 'invalidated' => int]
     */
    public static function apply(
        string $taskId,
        string $language,
        string $targetLanguage,
        string $provider,
        array $translations,
        array $invalidWords = []
    ): array {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        $processed = 0;
        $failed = 0;
        $invalidated = 0;

        // Audio writes do file I/O, so they are deferred to after the row-lock
        // transaction commits (collected as [md5 => raw mp3 bytes]).
        $audioQueue = [];

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
            &$audioQueue
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

                $imageUrls = $item['image_urls'] ?? [];
                if (!is_array($imageUrls)) {
                    $imageUrls = [];
                }
                $audioBase64 = $item['audio_base64'] ?? null;
                $hasPhonetic = !empty($item['phonetic']) || !empty($item['us_phonetic']) || !empty($item['uk_phonetic']);
                $hasAudio = is_string($audioBase64) && $audioBase64 !== '';

                // An entry must carry at least one usable field. A bare word with
                // nothing attached is a no-op, not a translation.
                if ($word === null || $word === '' ||
                    (!$hasTranslation && !$hasPhonetic && !$imageUrls && !$hasAudio)) {
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

                    // --- Images (fill-missing — store Bing sample-image URLs) ---
                    if (!empty($imageUrls) && empty($entry->image_files)) {
                        $entry->image_files = array_values(array_filter(
                            $imageUrls,
                            static fn ($u) => is_string($u) && $u !== ''
                        ));
                        $entry->image_provider = 'bing';
                        $dirty = true;
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
                    $coordinator->storeWordAudioBytes($langCode, $md5, $bytes, 'bing');
                } catch (\Throwable $e) {
                    Log::warning('[AppQyV1WordTranslationWriteback] audio store failed', [
                        'task_id' => $taskId,
                        'md5' => $md5,
                        'error' => $e->getMessage(),
                    ]);
                }
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
