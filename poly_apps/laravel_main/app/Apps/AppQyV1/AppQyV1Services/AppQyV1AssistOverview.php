<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Models\Book;
use App\Models\GlobalTask;
use App\Models\Subtitle;
use App\Services\MoviePoster\MoviePosterStore;
use App\Services\TimerTasks\AppQyV1CoverGenerationTask;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

trait AppQyV1AssistOverview
{
    /**
     * Single rich aggregate snapshot consumed by pycore's Queue Center overview.
     * Returns the SHARED CONTRACT v2 shape: { generated_at, categories[], workers[] }.
     * Cached (OVERVIEW_TTL) like pendingSnapshot; $fresh=true forces a recompute.
     */
    public const OVERVIEW_SNAPSHOT_KEY = 'appqyv1:assist:overview_snapshot';
    public const OVERVIEW_TTL = 30;

    public function overviewSnapshot(bool $fresh = false): array
    {
        $build = function (): array {
            $cover = $this->coverCounts();
            $poster = $this->posterCounts();
            $wordTranslation = $this->wordTranslationCounts();
            $wordImage = $this->wordImageCounts();
            $wordAudio = $this->wordAudioCounts();
            $sentence = $this->sentenceCounts();
            $subtitleLang = $this->assistRequestGroupCounts('subtitle', 'add_language');
            $bookLang = $this->assistRequestGroupCounts('book', 'add_language');
            $notebookLm = $this->notebookLmCounts();
            $geminiImage = $this->geminiImageCounts();
            $geminiChat = $this->geminiChatCounts();

            // Primary-handler lookup keyed by this overview's category keys.
            // Capability-backed keys read from the canonical GlobalTask map;
            // non-capability keys (subtitle_lang/book_lang = AI translations,
            // cover/notebooklm/gemini_* = mcp-chrome) keep
            // their historical labels. The Task Center and this overview now
            // share a single source of truth for capability routing.
            $handlerForKey = static function (string $key, string $fallback): string {
                $keyToCap = [
                    'word_translation' => \App\Models\GlobalTask::CAPABILITY_TRANSLATE,
                    'word_media' => \App\Models\GlobalTask::CAPABILITY_IMAGE,
                    'word_audio' => \App\Models\GlobalTask::CAPABILITY_AUDIO,
                    'sentence_audio' => \App\Models\GlobalTask::CAPABILITY_SENTENCE_AUDIO,
                    'poster' => \App\Models\GlobalTask::CAPABILITY_POSTER,
                ];
                $cap = $keyToCap[$key] ?? null;
                if ($cap !== null) {
                    return \App\Models\GlobalTask::CAPABILITY_PRIMARY_HANDLER[$cap] ?? $fallback;
                }
                return $fallback;
            };

            $categories = [
                [
                    'key' => 'word_translation',
                    'label' => 'Word Translation',
                    'handler' => $handlerForKey('word_translation', 'pycore'),
                    'pending' => $wordTranslation['pending'],
                    'processing' => $wordTranslation['processing'],
                    'leased' => $wordTranslation['leased'],
                    'total' => $wordTranslation['total'],
                    'by_language' => $wordTranslation['by_language'],
                    'sample' => $wordTranslation['sample'],
                ],
                [
                    'key' => 'word_media',
                    'label' => 'Word Media',
                    'handler' => $handlerForKey('word_media', 'chrome'),
                    'pending' => $wordImage['pending'],
                    'processing' => $wordImage['processing'],
                    'leased' => $wordImage['leased'],
                    'total' => $wordImage['total'],
                    'by_language' => $wordImage['by_language'],
                    'sample' => $wordImage['sample'],
                ],
                [
                    'key' => 'word_audio',
                    'label' => 'Word Audio',
                    'handler' => $handlerForKey('word_audio', 'pycore'),
                    'pending' => $wordAudio['pending'],
                    'processing' => $wordAudio['processing'],
                    'leased' => $wordAudio['leased'],
                    'total' => $wordAudio['total'],
                    'by_language' => $wordAudio['by_language'],
                    'sample' => $wordAudio['sample'],
                ],
                [
                    'key' => 'sentence_audio',
                    'label' => 'Sentence Audio',
                    'handler' => $handlerForKey('sentence_audio', 'pycore'),
                    'pending' => $sentence['pending'],
                    'processing' => $sentence['processing'],
                    'leased' => $sentence['leased'],
                    'total' => $sentence['total'],
                    'by_language' => $sentence['by_language'],
                    'sample' => $sentence['sample'],
                    // Active/primary engine for the lane (qwen3tts-first, GPU-gated).
                    'engine' => $sentence['engine'] ?? null,
                ],
                [
                    'key' => 'subtitle_lang',
                    'label' => 'Subtitle Add-Language',
                    'handler' => 'ai',
                    'pending' => $subtitleLang['pending'],
                    'processing' => $subtitleLang['processing'],
                    'leased' => $subtitleLang['leased'],
                    'total' => $subtitleLang['total'],
                    'by_language' => $subtitleLang['by_language'],
                    'by_status' => $subtitleLang['by_status'],
                    'sample' => $subtitleLang['sample'],
                ],
                [
                    'key' => 'book_lang',
                    'label' => 'Book Add-Language',
                    'handler' => 'ai',
                    'pending' => $bookLang['pending'],
                    'processing' => $bookLang['processing'],
                    'leased' => $bookLang['leased'],
                    'total' => $bookLang['total'],
                    'by_language' => $bookLang['by_language'],
                    'by_status' => $bookLang['by_status'],
                    'sample' => $bookLang['sample'],
                ],
                [
                    'key' => 'cover',
                    'label' => 'Vocabulary Cover',
                    'handler' => 'chrome',
                    'pending' => (int) ($cover['pending'] ?? 0) + (int) ($cover['retry'] ?? 0),
                    'processing' => (int) ($cover['processing'] ?? 0),
                    'leased' => (int) ($cover['leased'] ?? 0),
                    'total' => (int) ($cover['total'] ?? 0),
                    'sample' => $this->coverSample(),
                ],
                [
                    'key' => 'poster',
                    'label' => 'Media Poster',
                    'handler' => $handlerForKey('poster', 'chrome'),
                    'pending' => (int) ($poster['pending'] ?? 0),
                    'processing' => 0,
                    'leased' => (int) ($poster['leased'] ?? 0),
                    'total' => (int) ($poster['total'] ?? 0),
                    'sample' => $this->posterSample(),
                ],
                [
                    'key' => 'notebooklm',
                    'label' => 'NotebookLM',
                    'handler' => 'chrome',
                    'pending' => $notebookLm['pending'],
                    'processing' => $notebookLm['processing'],
                    'leased' => $notebookLm['leased'],
                    'total' => $notebookLm['total'],
                    'sample' => $notebookLm['sample'],
                ],
                [
                    'key' => 'gemini_image',
                    'label' => 'Gemini Image',
                    'handler' => 'chrome',
                    'pending' => $geminiImage['pending'],
                    'processing' => $geminiImage['processing'],
                    'leased' => $geminiImage['leased'],
                    'total' => $geminiImage['total'],
                    'sample' => $geminiImage['sample'],
                ],
                [
                    'key' => 'gemini_chat',
                    'label' => 'Gemini Chat',
                    'handler' => 'chrome',
                    'pending' => $geminiChat['pending'],
                    'processing' => $geminiChat['processing'],
                    'leased' => $geminiChat['leased'],
                    'total' => $geminiChat['total'],
                    'sample' => $geminiChat['sample'],
                ],
            ];

            return [
                'success' => true,
                'generated_at' => now()->toIso8601String(),
                'categories' => $categories,
                'workers' => $this->workers(),
            ];
        };

        if ($fresh) {
            $snapshot = $build();
            \Illuminate\Support\Facades\Cache::put(self::OVERVIEW_SNAPSHOT_KEY, $snapshot, self::OVERVIEW_TTL);
            return $snapshot;
        }

        return \Illuminate\Support\Facades\Cache::remember(
            self::OVERVIEW_SNAPSHOT_KEY,
            self::OVERVIEW_TTL,
            $build
        );
    }

    /**
     * Up to OVERVIEW_SAMPLE_LIMIT pending/retry cover rows for display.
     *
     * @return array<int,array{id:int,title:?string}>
     */
    private function coverSample(): array
    {
        try {
            return AppQyV1VocabularyLibraryModel::query()
                ->whereNotNull('cover_filename')
                ->whereIn('cover_status', ['pending', 'retry', 'processing'])
                ->orderByDesc('cover_priority')
                ->limit(self::OVERVIEW_SAMPLE_LIMIT)
                ->get(['id', 'name'])
                ->map(static fn ($row) => ['id' => (int) $row->id, 'title' => $row->name !== null ? (string) $row->name : null])
                ->all();
        } catch (\Throwable $e) {
            return [];
        }
    }

    /**
     * Up to OVERVIEW_SAMPLE_LIMIT pending/failed poster rows across both media
     * tables for display.
     *
     * @return array<int,array{id:int,title:?string}>
     */
    private function posterSample(): array
    {
        if (!self::posterColumnsReady()) {
            return [];
        }
        $sample = [];
        foreach ([Book::class, Subtitle::class] as $modelClass) {
            if (count($sample) >= self::OVERVIEW_SAMPLE_LIMIT) {
                break;
            }
            try {
                $rows = $modelClass::query()
                    ->whereIn('poster_status', ['pending', 'failed'])
                    ->limit(self::OVERVIEW_SAMPLE_LIMIT - count($sample))
                    ->get(['id', 'title', 'original_name']);
                foreach ($rows as $row) {
                    $title = trim((string) $row->getAttribute('title'));
                    if ($title === '') {
                        $title = trim((string) $row->getAttribute('original_name'));
                    }
                    $sample[] = ['id' => (int) $row->id, 'title' => $title !== '' ? $title : null];
                }
            } catch (\Throwable $e) {
                continue;
            }
        }
        return $sample;
    }

    /** Overview category keys accepted by categoryItems(). */
    public const OVERVIEW_CATEGORY_KEYS = [
        'word_translation', 'word_media', 'word_audio', 'sentence_audio',
        'subtitle_lang', 'book_lang', 'cover', 'poster',
        'notebooklm', 'gemini_image', 'gemini_chat',
    ];

    /** Map overview category key → global_tasks.task_type (when applicable). */
    private const CATEGORY_GLOBAL_TASK_TYPE = [
        'word_translation' => 'word_translation',
        'word_media' => 'word_media',
        'notebooklm' => 'notebooklm',
        'gemini_image' => 'gemini_image',
        'gemini_chat' => 'gemini_chat',
    ];

    /**
     * Unified pending-work snapshot for ALL three assist tracks (cover / tts /
     * translation), cached so third-party workers and the dashboard can poll it
     * cheaply (the raw counts otherwise run several aggregate queries per call).
     *
     * The Octane cover timer (AppQyV1CoverGenerationTask) TOUCHES this every
     * tick with $fresh=false, so the cache stays warm but the (expensive) tts
     * statistics()/cover counts only recompute once per TTL — NOT on every 5s
     * tick. A poller hitting /assist/pending reads the same warm cache. Pass
     * $fresh=true (the ?fresh=1 query) to force an immediate recompute.
     */
    public const PENDING_SNAPSHOT_KEY = 'appqyv1:assist:pending_snapshot';
    // 30s: a pending-work snapshot does not need second-level freshness, and the
    // TTS statistics() aggregate scans large per-language tables — bounding it to
    // ~once / 30s keeps the warm cheap.
    public const PENDING_SNAPSHOT_TTL = 30;

    public function pendingSnapshot(bool $fresh = false): array
    {
        $build = function (): array {
            return [
                'generated_at' => now()->toIso8601String(),
                'enabled' => self::isAssistEnabled(),
                'lease_minutes' => self::LEASE_MINUTES,
                'cover' => $this->coverCounts(),
                'tts' => $this->ttsCounts(),
                'translation' => $this->translationCounts(),
                'poster' => $this->posterCounts(),
            ];
        };

        if ($fresh) {
            $snapshot = $build();
            \Illuminate\Support\Facades\Cache::put(self::PENDING_SNAPSHOT_KEY, $snapshot, self::PENDING_SNAPSHOT_TTL);
            return $snapshot;
        }

        return \Illuminate\Support\Facades\Cache::remember(
            self::PENDING_SNAPSHOT_KEY,
            self::PENDING_SNAPSHOT_TTL,
            $build
        );
    }

    /** Image sniffing: PNG / JPEG / WebP (RIFF) / GIF magic bytes. */
    public static function looksLikeImage(string $bytes): bool
    {
        if (strlen($bytes) < 12) {
            return false;
        }

        return str_starts_with($bytes, "\x89PNG\r\n\x1a\n")
            || str_starts_with($bytes, "\xFF\xD8\xFF")
            || (str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP')
            || str_starts_with($bytes, 'GIF87a')
            || str_starts_with($bytes, 'GIF89a');
    }

    private function clearCoverLease(AppQyV1VocabularyLibraryModel $library): void
    {
        if ($library->assist_claimed_at !== null || $library->assist_claimed_by !== null) {
            $library->assist_claimed_at = null;
            $library->assist_claimed_by = null;
            $library->save();
        }
    }
}
