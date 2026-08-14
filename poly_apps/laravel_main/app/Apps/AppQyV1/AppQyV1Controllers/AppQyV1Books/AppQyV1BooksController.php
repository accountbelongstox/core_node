<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Books;

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyLibraryPublicController;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Http\Controllers\Controller;
use App\Models\GlobalTask;
use App\Providers\PathMapper;
use App\Services\BookTextStatsService;
use App\Services\DocumentTextExtractor;
use App\Services\MediaIngestService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Books document pipeline (dashboard).
 *
 * Upload documents -> PHP extracts text -> compute stats -> (on demand) ingest
 * the parsed sentences/words into the SHARED sentence library via the v2 media
 * ingest path (idempotent fill-missing). Same trust posture as the media ingest
 * endpoints: local/no-auth.
 *
 * Staging + caches live under <cache>/pycore/appqyv1/books/{uploadId}/ so the
 * extract pass runs once at upload time and the paginated list + ingest steps
 * reuse the cached analysis (no re-parsing).
 */
class AppQyV1BooksController extends Controller
{
    use ApiResponse;

    /** Documents above this distinct-sentence count ingest asynchronously via a GlobalTask. */
    private const ASYNC_SENTENCE_THRESHOLD = 5000;

    /** Sentence chunk size per progress tick in the async ingest task. */
    private const INGEST_CHUNK_SIZE = 500;

    /** Max preview characters returned per file at upload time. */
    private const PREVIEW_CHARS = 1200;

    private DocumentTextExtractor $extractor;
    private BookTextStatsService $stats;
    private MediaIngestService $ingestService;

    public function __construct(
        DocumentTextExtractor $extractor,
        BookTextStatsService $stats,
        MediaIngestService $ingestService
    ) {
        $this->extractor = $extractor;
        $this->stats = $stats;
        $this->ingestService = $ingestService;
    }

    /**
     * Supported upload formats.
     *
     * GET /api/app_qy_v1/books/supported-formats
     */
    public function supportedFormats(): JsonResponse
    {
        return $this->success([
            'formats' => $this->extractor->supportedFormats(),
        ], 'Supported formats retrieved');
    }

    /**
     * Upload + parse documents. For each file: stage, extract text, compute
     * stats, cache the analysis. Returns per-file stats + preview + an
     * aggregate. Ingestion is a separate step (POST /books/ingest).
     *
     * POST /api/app_qy_v1/books/upload  multipart: files[], language?
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'files' => 'required|array|min:1',
            'files.*' => 'required|file',
            'language' => 'nullable|string',
            'languages' => 'nullable|array',
            'languages.*' => 'string',
        ]);

        $language = (string) $request->input('language', '');
        // Books v3: the checked correspondence languages (>=1). The detected
        // primary language is auto-included even when the FE omits it.
        $selectedLanguages = $this->normalizeSelectedLanguages(
            (array) $request->input('languages', []),
            $language
        );
        $uploadId = (string) Str::uuid();
        $stagingDir = PathMapper::getSharedDownloadCacheDir("pycore/appqyv1/books/{$uploadId}");

        $files = $request->file('files');
        if (!is_array($files)) {
            $files = [$files];
        }

        $fileResults = [];
        $listsByFile = [];

        $aggregate = [
            'char_count' => 0,
            'word_count' => 0,
            'unique_word_count' => 0,
            'sentence_count' => 0,
            'unique_sentence_count' => 0,
            'line_count' => 0,
            'paragraph_count' => 0,
        ];
        // Cross-file distinct sets (by content_id / word) for the aggregate.
        $distinctSentenceIds = [];
        $distinctWords = [];

        $fileIndex = 0;
        foreach ($files as $uploaded) {
            $originalName = (string) $uploaded->getClientOriginalName();
            $ext = strtolower((string) $uploaded->getClientOriginalExtension());
            $asciiName = $this->asciiName($originalName, $fileIndex, $ext);
            $size = (int) $uploaded->getSize();

            $storedPath = rtrim($stagingDir, '/\\') . DIRECTORY_SEPARATOR . $asciiName;

            $error = '';
            $statsOut = null;
            $preview = '';

            // Move the upload into the staging dir (best effort).
            try {
                $uploaded->move($stagingDir, $asciiName);
            } catch (\Throwable $e) {
                $error = 'Failed to stage uploaded file';
                Log::warning('[AppQyV1Books] Failed to stage upload', [
                    'name' => $originalName,
                    'error' => $e->getMessage(),
                ]);
            }

            if ($error === '') {
                $text = $this->extractor->extractText($storedPath);
                if ($text === '') {
                    $error = 'No text could be extracted from this file';
                }

                $analysis = $this->stats->analyze($text, $language);
                $statsOut = $analysis['stats'];
                $preview = mb_substr($text, 0, self::PREVIEW_CHARS);

                // Books v3: chapter -> slot tree (both grains). The effective
                // selected languages always include this file's detected primary.
                $chapterTree = $this->stats->analyzeChapters($text, $language);
                $fileSelected = $this->normalizeSelectedLanguages(
                    $selectedLanguages,
                    (string) $analysis['primary_language']
                );

                // Cache the full analysis (per-file) + lists for list/ingest.
                $cachePayload = [
                    'upload_id' => $uploadId,
                    'original_name' => $originalName,
                    'ascii_name' => $asciiName,
                    'ext' => $ext,
                    'size' => $size,
                    'language' => $language,
                    'selected_languages' => $fileSelected,
                    'content_id' => $analysis['content_id'],
                    'primary_language' => $analysis['primary_language'],
                    'stats' => $analysis['stats'],
                    'sentences' => $analysis['sentences'],
                    'sentence_seq' => $analysis['sentence_seq'],
                    'words' => $analysis['words'],
                    'chapters' => $chapterTree['chapters'],
                    'slots' => $chapterTree['slots'],
                    'full_content' => $text,
                ];
                $this->writeJson(
                    rtrim($stagingDir, '/\\') . DIRECTORY_SEPARATOR . "file_{$fileIndex}.json",
                    $cachePayload
                );
                $listsByFile[$asciiName] = array_merge(
                    ['ascii_name' => $asciiName, 'original_name' => $originalName],
                    $analysis['lists']
                );

                // Aggregate roll-up.
                $aggregate['char_count'] += (int) $statsOut['char_count'];
                $aggregate['word_count'] += (int) $statsOut['word_count'];
                $aggregate['sentence_count'] += (int) $statsOut['sentence_count'];
                $aggregate['line_count'] += (int) $statsOut['line_count'];
                $aggregate['paragraph_count'] += (int) $statsOut['paragraph_count'];

                foreach ($analysis['sentences'] as $sentence) {
                    $distinctSentenceIds[$sentence['content_id']] = true;
                }
                foreach ($analysis['lists']['words'] as $wordRow) {
                    $distinctWords[$wordRow['word']] = true;
                }
            }

            $fileResults[] = [
                'name' => $originalName,
                'ascii_name' => $asciiName,
                'ext' => $ext,
                'size' => $size,
                'stats' => $statsOut,
                'preview' => $preview,
                'error' => $error,
            ];

            $fileIndex++;
        }

        $aggregate['unique_word_count'] = count($distinctWords);
        $aggregate['unique_sentence_count'] = count($distinctSentenceIds);

        // Persist the per-file lists index for /books/list.
        $this->writeJson(
            rtrim($stagingDir, '/\\') . DIRECTORY_SEPARATOR . 'lists.json',
            [
                'upload_id' => $uploadId,
                'language' => $language,
                'files' => $listsByFile,
            ]
        );

        $totals = [
            'files' => count($fileResults),
            'parsed' => count($listsByFile),
        ];

        return $this->success([
            'upload_id' => $uploadId,
            'files' => $fileResults,
            'aggregate' => $aggregate,
            'totals' => $totals,
        ], 'Documents uploaded and parsed');
    }

    /**
     * Paginated drill-down over a cached upload's lists.
     *
     * POST /api/app_qy_v1/books/list
     * { upload_id,
     *   kind: words|unique_words|sentences|unique_sentences|languages|chapters|cues,
     *   start?, limit?, ascii_name?, chapter_index?, languages? }
     *
     * `ascii_name` optionally scopes to a single uploaded file; otherwise the
     * lists are merged across all files in the upload.
     *
     * Books v3 kinds (served from the cached chapter -> slot tree):
     *   - chapters  -> [{chapter_index, title, sentence_count}]
     *   - sentences -> BookSlot[] of grain 'sentence'
     *   - cues      -> BookSlot[] of grain 'cue'
     *   BookSlot = { corr_id, grain, seq, chapter_index, primary_language,
     *                langs: { code: text|null } }; honors chapter_index +
     *   languages[] (the checked correspondence languages).
     */
    public function list(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'upload_id' => 'required|string',
            'kind' => 'required|string|in:words,unique_words,sentences,unique_sentences,languages,chapters,cues',
            'start' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:5000',
            'ascii_name' => 'nullable|string',
            'chapter_index' => 'nullable|integer|min:0',
            'languages' => 'nullable|array',
            'languages.*' => 'string',
        ]);

        $uploadId = $this->sanitizeId($validated['upload_id']);
        $kind = $validated['kind'];
        $start = isset($validated['start']) ? (int) $validated['start'] : 0;
        $limit = isset($validated['limit']) ? (int) $validated['limit'] : 100;
        $asciiName = isset($validated['ascii_name']) ? basename((string) $validated['ascii_name']) : null;
        $chapterIndex = isset($validated['chapter_index']) ? (int) $validated['chapter_index'] : null;
        $languages = (array) $request->input('languages', []);

        // Books v3 slot/chapter kinds read the per-file analysis caches directly
        // (chapter -> slot tree), not the merged display lists.
        if ($kind === 'chapters' || $kind === 'sentences' || $kind === 'cues') {
            return $this->listV3($uploadId, $kind, $asciiName, $chapterIndex, $languages, $start, $limit);
        }

        $listsPath = $this->listsPath($uploadId);
        $lists = $this->readJson($listsPath);
        if ($lists === null) {
            return $this->notFound('Upload not found or expired');
        }

        $merged = $this->mergeLists($lists, $kind, $asciiName);

        $total = count($merged);
        $items = array_slice($merged, $start, $limit);

        return $this->success([
            'kind' => $kind,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => array_values($items),
            'totals' => [
                'total' => $total,
            ],
        ], 'List retrieved');
    }

    /**
     * Serve the Books v3 chapter / slot kinds from the cached chapter -> slot
     * tree (file_*.json). 'chapters' returns the chapter list; 'sentences' /
     * 'cues' return BookSlot[] of the corresponding grain, scoped to a chapter
     * when chapter_index is given and projected onto the requested languages.
     *
     * @param array<int, mixed> $languages
     */
    private function listV3(
        string $uploadId,
        string $kind,
        ?string $asciiName,
        ?int $chapterIndex,
        array $languages,
        int $start,
        int $limit
    ): JsonResponse {
        $stagingDir = PathMapper::getSharedDownloadCacheDir("pycore/appqyv1/books/{$uploadId}");
        $fileCaches = $this->loadFileCaches($stagingDir);
        if (empty($fileCaches)) {
            return $this->notFound('Upload not found or expired');
        }

        // ---- Chapter list (Books v3.1: per-language titles) ----
        if ($kind === 'chapters') {
            $chapters = [];
            foreach ($fileCaches as $cache) {
                if ($asciiName !== null && (string) ($cache['ascii_name'] ?? '') !== $asciiName) {
                    continue;
                }
                $primaryLanguage = $this->normalizeLangCode((string) ($cache['primary_language'] ?? 'en'));
                if ($primaryLanguage === '') {
                    $primaryLanguage = 'en';
                }
                $cachedSelected = isset($cache['selected_languages']) && is_array($cache['selected_languages'])
                    ? $cache['selected_languages']
                    : [];
                $selectedLanguages = $this->normalizeSelectedLanguages(
                    !empty($languages) ? $languages : $cachedSelected,
                    $primaryLanguage
                );

                $fileChapters = isset($cache['chapters']) && is_array($cache['chapters']) ? $cache['chapters'] : [];
                foreach ($fileChapters as $chapter) {
                    // The PHP parser is monolingual: the primary language carries
                    // the detected title; other selected languages are null (留空).
                    $primaryTitle = isset($chapter['title']) ? (string) $chapter['title'] : null;
                    $titles = [];
                    foreach ($selectedLanguages as $code) {
                        $titles[$code] = ($code === $primaryLanguage) ? $primaryTitle : null;
                    }
                    $chapters[] = [
                        'ascii_name' => (string) ($cache['ascii_name'] ?? ''),
                        'chapter_index' => (int) ($chapter['chapter_index'] ?? 0),
                        // Resolved primary-language title for FE convenience.
                        'title' => $primaryTitle,
                        'primary_language' => $primaryLanguage,
                        'titles' => $titles,
                        'sentence_count' => (int) ($chapter['sentence_count'] ?? 0),
                    ];
                }
            }
            $total = count($chapters);
            $items = array_slice($chapters, $start, $limit);
            return $this->success([
                'kind' => $kind,
                'total' => $total,
                'start' => $start,
                'limit' => $limit,
                'items' => array_values($items),
                'totals' => ['total' => $total],
            ], 'List retrieved');
        }

        // ---- Slot kinds: 'sentences' (grain sentence) / 'cues' (grain cue) ----
        $grain = $kind === 'cues' ? 'cue' : 'sentence';

        $slotRows = [];
        foreach ($fileCaches as $cache) {
            if ($asciiName !== null && (string) ($cache['ascii_name'] ?? '') !== $asciiName) {
                continue;
            }
            $sourceKey = 'book_' . (string) ($cache['content_id'] ?? '');
            $primaryLanguage = (string) ($cache['primary_language'] ?? 'en');

            // Effective correspondence languages for projection.
            $cachedSelected = isset($cache['selected_languages']) && is_array($cache['selected_languages'])
                ? $cache['selected_languages']
                : [];
            $selectedLanguages = $this->normalizeSelectedLanguages(
                !empty($languages) ? $languages : $cachedSelected,
                $primaryLanguage
            );

            $slots = isset($cache['slots']) && is_array($cache['slots']) ? $cache['slots'] : [];
            foreach ($slots as $slot) {
                if ((string) ($slot['grain'] ?? '') !== $grain) {
                    continue;
                }
                if ($chapterIndex !== null && (int) ($slot['chapter_index'] ?? 0) !== $chapterIndex) {
                    continue;
                }

                $built = $this->buildV3Slot($sourceKey, $slot, $primaryLanguage, $selectedLanguages);
                $slotRows[] = [
                    'corr_id' => $built['corr_id'],
                    'grain' => $built['grain'],
                    'seq' => $built['seq'],
                    'chapter_index' => $built['chapter_index'],
                    'primary_language' => $built['primary_language'],
                    'langs' => $built['langs'],
                ];
            }
        }

        $total = count($slotRows);
        $items = array_slice($slotRows, $start, $limit);

        return $this->success([
            'kind' => $kind,
            'grain' => $grain,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => array_values($items),
            'totals' => ['total' => $total],
        ], 'List retrieved');
    }

    /**
     * Ingest a staged upload into the shared sentence library + word
     * dictionaries via the v2 media ingest path.
     *
     * POST /api/app_qy_v1/books/ingest  { upload_id, language? }
     *
     * Large documents (> ASYNC_SENTENCE_THRESHOLD distinct sentences across the
     * upload) run asynchronously through a GlobalTask and return { task_id };
     * otherwise ingestion runs synchronously and returns per-book counts.
     */
    public function ingest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'upload_id' => 'required|string',
            'language' => 'nullable|string',
            'languages' => 'nullable|array',
            'languages.*' => 'string',
        ]);

        $uploadId = $this->sanitizeId($validated['upload_id']);
        $languageOverride = isset($validated['language']) ? (string) $validated['language'] : '';
        // Books v3: the checked correspondence languages override (>=1 when sent).
        $languagesOverride = $this->normalizeSelectedLanguages(
            (array) $request->input('languages', []),
            $languageOverride
        );

        $stagingDir = PathMapper::getSharedDownloadCacheDir("pycore/appqyv1/books/{$uploadId}");
        $fileCaches = $this->loadFileCaches($stagingDir);
        if (empty($fileCaches)) {
            return $this->notFound('Upload not found or expired');
        }

        // Decide sync vs async by total distinct sentence volume.
        $totalSentences = 0;
        foreach ($fileCaches as $cache) {
            $totalSentences += count($cache['sentences']);
        }

        if ($totalSentences > self::ASYNC_SENTENCE_THRESHOLD) {
            $task = GlobalTask::createTaskRecord([
                'task_id' => (string) Str::uuid(),
                'app_name' => 'app_qy_v1',
                'task_type' => 'books_ingest',
                'execution_type' => GlobalTask::executionType('local_timer'),
                'status' => GlobalTask::status('processing'),
                'progress' => 0.0,
                'payload' => [
                    'upload_id' => $uploadId,
                    'language' => $languageOverride,
                    'languages' => $languagesOverride,
                    'total_sentences' => $totalSentences,
                ],
            ]);

            // Run the heavy ingest AFTER the response is sent (Octane terminating)
            // so the request returns immediately with the task_id; the frontend
            // polls /task/{id}/status. Failures mark the task FAILED (never leave
            // it stuck in 'processing').
            app()->terminating(function () use ($fileCaches, $languageOverride, $languagesOverride, $task) {
                try {
                    $this->runIngest($fileCaches, $languageOverride, $languagesOverride, $task);
                } catch (\Throwable $e) {
                    $task->status = GlobalTask::status('failed');
                    $task->error = $e->getMessage();
                    $task->saveRecord();
                    Log::error('[AppQyV1Books] async book ingest failed', [
                        'task_id' => $task->task_id,
                        'error' => $e->getMessage(),
                    ]);
                }
            });

            return $this->success([
                'task_id' => $task->task_id,
                'async' => true,
            ], 'Book ingest started');
        }

        $books = $this->runIngest($fileCaches, $languageOverride, $languagesOverride, null);

        return $this->success([
            'books' => $books,
            'async' => false,
        ], 'Books ingested successfully');
    }

    /**
     * Build the model_version:3 payload for each staged file and ingest it via
     * MediaIngestService (which upserts per-language sentence tables, chapters and
     * correspondence slots). When $task is provided, progress is updated 0-100 as
     * chunks complete; returns the per-book summary either way.
     *
     * v3 payload shape (BOOKS_FEATURE_SPECIFICATION.md §7): the first chunk carries
     * the source (with selected_languages) + chapters[]; every chunk carries an
     * ordered slot slice. Each slot:
     *   { chapter_index, grain, seq, corr_id=sha1(source_key|grain|seq),
     *     primary_language, langs:{code: text|null} } — for a PHP-parsed (single
     *     language) book only the primary language is filled; the other selected
     *     languages are null (留空) so the FE renders a blank correspondence.
     *
     * @param array<int, array>     $fileCaches
     * @param array<int, string>    $languagesOverride
     * @return array<int, array{source_key:string, original_name:string, sentences:int, words:int}>
     */
    private function runIngest(array $fileCaches, string $languageOverride, array $languagesOverride, ?GlobalTask $task): array
    {
        $books = [];

        // Total chunks across all files for global progress (over slots now).
        $totalChunks = 0;
        foreach ($fileCaches as $cache) {
            $slotCount = isset($cache['slots']) && is_array($cache['slots']) ? count($cache['slots']) : 0;
            $totalChunks += max(1, (int) ceil($slotCount / self::INGEST_CHUNK_SIZE));
        }
        $doneChunks = 0;

        foreach ($fileCaches as $cache) {
            $primaryLanguage = $this->normalizeLangCode(
                $languageOverride !== '' ? $languageOverride : (string) $cache['primary_language']
            );
            if ($primaryLanguage === '') {
                $primaryLanguage = 'en';
            }
            $sourceKey = 'book_' . $cache['content_id'];

            // Effective selected correspondence languages: the ingest-call override
            // when sent, else the cached upload selection, always including primary.
            $cachedSelected = isset($cache['selected_languages']) && is_array($cache['selected_languages'])
                ? $cache['selected_languages']
                : [];
            $selectedLanguages = $this->normalizeSelectedLanguages(
                !empty($languagesOverride) ? $languagesOverride : $cachedSelected,
                $primaryLanguage
            );

            $slots = isset($cache['slots']) && is_array($cache['slots']) ? $cache['slots'] : [];
            $sentenceSlots = 0;
            foreach ($slots as $slot) {
                if (($slot['grain'] ?? '') === 'sentence') {
                    $sentenceSlots++;
                }
            }
            $wordCount = 0;
            foreach ($cache['words'] as $items) {
                $wordCount += count($items);
            }

            // Books v3.1: chapters carry a per-language titles map. The PHP parser
            // is monolingual, so only the primary language title is filled; other
            // selected languages get a null title (留空).
            $cachedChapters = isset($cache['chapters']) && is_array($cache['chapters']) ? $cache['chapters'] : [];
            $chapters = [];
            foreach ($cachedChapters as $chapter) {
                $titles = [];
                foreach ($selectedLanguages as $code) {
                    $titles[$code] = ($code === $primaryLanguage)
                        ? (isset($chapter['title']) ? (string) $chapter['title'] : null)
                        : null;
                }
                $chapters[] = [
                    'chapter_index' => (int) ($chapter['chapter_index'] ?? 0),
                    'sentence_count' => (int) ($chapter['sentence_count'] ?? 0),
                    'titles' => $titles,
                ];
            }

            // First chunk carries the source + chapters; subsequent chunks carry
            // only their slot slice so progress can advance on large books.
            $chunks = array_chunk($slots, self::INGEST_CHUNK_SIZE);
            if (empty($chunks)) {
                $chunks = [[]];
            }

            $first = true;
            foreach ($chunks as $chunk) {
                $payloadSlots = [];
                foreach ($chunk as $slot) {
                    $payloadSlots[] = $this->buildV3Slot($sourceKey, $slot, $primaryLanguage, $selectedLanguages);
                }

                $payload = [
                    'source_type' => 'book',
                    'model_version' => 3,
                    'source' => [
                        'source_key' => $sourceKey,
                        'content_id' => $cache['content_id'],
                        'title' => (string) $cache['original_name'],
                        'original_name' => (string) $cache['original_name'],
                        'ascii_name' => (string) $cache['ascii_name'],
                        'language' => $primaryLanguage,
                        'selected_languages' => $selectedLanguages,
                        'full_content' => $first ? (string) $cache['full_content'] : '',
                        'sentence_seq' => $first ? $cache['sentence_seq'] : [],
                        'word_ids' => $first ? $this->buildWordIds($cache['words']) : [],
                        'sentence_count' => $sentenceSlots,
                        'metadata' => [
                            'source' => 'dashboard_books',
                            'upload_id' => (string) $cache['upload_id'],
                            'ext' => (string) $cache['ext'],
                        ],
                    ],
                    'chapters' => $first ? $chapters : [],
                    'slots' => $payloadSlots,
                ];

                $this->ingestService->ingest($payload);

                $first = false;
                $doneChunks++;

                if ($task !== null && $totalChunks > 0) {
                    $task->progress = round(($doneChunks / $totalChunks) * 100, 2);
                    $task->saveRecord();
                }
            }

            $books[] = [
                'source_key' => $sourceKey,
                'original_name' => (string) $cache['original_name'],
                'sentences' => $sentenceSlots,
                'words' => $wordCount,
            ];
        }

        if ($task !== null) {
            $task->status = GlobalTask::status('completed');
            $task->progress = 100.0;
            $task->result = ['books' => $books];
            $task->completed_at = now();
            $task->saveRecord();
        }

        return $books;
    }

    /**
     * Build one v3 correspondence slot for the ingest payload from a cached slot.
     * For a PHP-parsed monolingual book only the primary language is filled; the
     * other selected languages are null (留空 — empty correspondence).
     *
     * @param array<string, mixed> $slot
     * @param array<int, string>   $selectedLanguages
     * @return array<string, mixed>
     */
    private function buildV3Slot(string $sourceKey, array $slot, string $primaryLanguage, array $selectedLanguages): array
    {
        $grain = isset($slot['grain']) ? (string) $slot['grain'] : 'sentence';
        $seq = isset($slot['seq']) ? (int) $slot['seq'] : 0;
        $chapterIndex = isset($slot['chapter_index']) ? (int) $slot['chapter_index'] : 0;
        $text = isset($slot['text']) ? (string) $slot['text'] : '';
        // The slot's detected language; fall back to the book primary.
        $slotLang = isset($slot['language']) && $slot['language'] !== '' ? (string) $slot['language'] : $primaryLanguage;

        // The PHP parser yields one language per slot; fill that language, leave
        // every other selected language null so the slot still renders a blank.
        $langs = [];
        foreach ($selectedLanguages as $code) {
            $langs[$code] = ($code === $slotLang) ? $text : null;
        }
        // Guarantee the slot's own language is represented even if not in Lsel.
        if (!array_key_exists($slotLang, $langs)) {
            $langs[$slotLang] = $text;
        }

        return [
            'chapter_index' => $chapterIndex,
            'grain' => $grain,
            'seq' => $seq,
            'corr_id' => MediaIngestService::computeCorrId($sourceKey, $grain, $seq),
            'primary_language' => $primaryLanguage,
            'langs' => $langs,
            'seg_index' => null,
            'sub_idx' => null,
            'start_sec' => null,
            'end_sec' => null,
        ];
    }

    /**
     * Normalize a checked-languages list to deduped 2/3-letter codes, always
     * including the (normalized) primary language as the first entry. Accepts
     * names or codes; an empty selection yields just the primary.
     *
     * @param array<int, mixed> $languages
     * @return array<int, string>
     */
    private function normalizeSelectedLanguages(array $languages, string $primary): array
    {
        $out = [];
        $primaryCode = $this->normalizeLangCode($primary);
        if ($primaryCode !== '') {
            $out[] = $primaryCode;
        }
        foreach ($languages as $lang) {
            $code = $this->normalizeLangCode((string) $lang);
            if ($code !== '' && !in_array($code, $out, true)) {
                $out[] = $code;
            }
        }
        if (empty($out)) {
            $out[] = 'en';
        }
        return $out;
    }

    /** Normalize a language name/code to a code (delegates to AppQyV1TableMaps — §2). */
    private function normalizeLangCode(string $language): string
    {
        return AppQyV1TableMaps::normalizeLangCode($language);
    }

    /**
     * Build the v2 word_ids map { lang: [content_id, ...] } from the distinct
     * words map { lang: [{content_id, content}] }.
     *
     * @param array<string, array<int, array{content_id:string, content:string}>> $words
     * @return array<string, array<int, string>>
     */
    private function buildWordIds(array $words): array
    {
        $wordIds = [];
        foreach ($words as $lang => $items) {
            $ids = [];
            foreach ($items as $item) {
                if (isset($item['content_id'])) {
                    $ids[] = (string) $item['content_id'];
                }
            }
            $wordIds[$lang] = $ids;
        }
        return $wordIds;
    }

    /**
     * Merge a single kind of list across files (or scope to one file).
     *
     * @return array<int, array>
     */
    private function mergeLists(array $lists, string $kind, ?string $asciiName): array
    {
        $files = isset($lists['files']) && is_array($lists['files']) ? $lists['files'] : [];

        // words/unique_words read the same 'words' source list (distinct words);
        // unique_words is the same set (words list is already distinct per file).
        $sourceKey = $kind;
        if ($kind === 'words' || $kind === 'unique_words') {
            $sourceKey = 'words';
        }

        $merged = [];
        foreach ($files as $name => $fileLists) {
            if ($asciiName !== null && $name !== $asciiName) {
                continue;
            }
            if (!isset($fileLists[$sourceKey]) || !is_array($fileLists[$sourceKey])) {
                continue;
            }
            foreach ($fileLists[$sourceKey] as $row) {
                $merged[] = $row;
            }
        }

        // Cross-file distinctness for word/sentence/language kinds.
        if ($kind === 'words' || $kind === 'unique_words') {
            $merged = $this->mergeWordFrequencies($merged);
        } elseif ($kind === 'unique_sentences') {
            $merged = $this->dedupeByKey($merged, 'content_id');
        } elseif ($kind === 'languages') {
            $merged = $this->mergeLanguages($merged);
        }

        return $merged;
    }

    /**
     * Collapse word rows ({word,count,...}) across files by summing counts,
     * then sort by count desc.
     */
    private function mergeWordFrequencies(array $rows): array
    {
        $acc = [];
        foreach ($rows as $row) {
            $word = isset($row['word']) ? (string) $row['word'] : '';
            if ($word === '') {
                continue;
            }
            if (!isset($acc[$word])) {
                $acc[$word] = ['word' => $word, 'count' => 0, 'language' => $row['language'] ?? ''];
            }
            $acc[$word]['count'] += (int) ($row['count'] ?? 0);
        }
        $out = array_values($acc);
        usort($out, function ($a, $b) {
            if ($a['count'] !== $b['count']) {
                return $b['count'] <=> $a['count'];
            }
            return strcmp((string) $a['word'], (string) $b['word']);
        });
        return $out;
    }

    /**
     * Merge language breakdown rows across files by summing chars per script,
     * then recompute ratios and sort by chars desc.
     */
    private function mergeLanguages(array $rows): array
    {
        $acc = [];
        $total = 0;
        foreach ($rows as $row) {
            $script = isset($row['script']) ? (string) $row['script'] : '';
            if ($script === '') {
                continue;
            }
            if (!isset($acc[$script])) {
                $acc[$script] = ['script' => $script, 'code' => $row['code'] ?? '', 'chars' => 0, 'ratio' => 0.0];
            }
            $acc[$script]['chars'] += (int) ($row['chars'] ?? 0);
            $total += (int) ($row['chars'] ?? 0);
        }
        foreach ($acc as &$row) {
            $row['ratio'] = $total > 0 ? round($row['chars'] / $total, 4) : 0.0;
        }
        unset($row);
        $out = array_values($acc);
        usort($out, fn ($a, $b) => $b['chars'] <=> $a['chars']);
        return $out;
    }

    /**
     * Deduplicate a list of rows by a key, keeping first occurrence.
     */
    private function dedupeByKey(array $rows, string $key): array
    {
        $seen = [];
        $out = [];
        foreach ($rows as $row) {
            $k = isset($row[$key]) ? (string) $row[$key] : '';
            if ($k === '' || isset($seen[$k])) {
                continue;
            }
            $seen[$k] = true;
            $out[] = $row;
        }
        return $out;
    }

    /**
     * Load every per-file analysis cache (file_*.json) for an upload, in order.
     *
     * @return array<int, array>
     */
    private function loadFileCaches(string $stagingDir): array
    {
        $caches = [];
        $index = 0;
        while (true) {
            $path = rtrim($stagingDir, '/\\') . DIRECTORY_SEPARATOR . "file_{$index}.json";
            if (!is_file($path)) {
                break;
            }
            $data = $this->readJson($path);
            if ($data !== null) {
                $caches[] = $data;
            }
            $index++;
        }
        return $caches;
    }

    /** Absolute path of the lists.json index for an upload. */
    private function listsPath(string $uploadId): string
    {
        $stagingDir = PathMapper::getSharedDownloadCacheDir("pycore/appqyv1/books/{$uploadId}");
        return rtrim($stagingDir, '/\\') . DIRECTORY_SEPARATOR . 'lists.json';
    }

    /** Write a value as pretty JSON; logs (never throws) on failure. */
    private function writeJson(string $path, $value): void
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if ($json === false) {
            Log::warning('[AppQyV1Books] Failed to encode JSON cache', ['path' => $path]);
            return;
        }
        if (@file_put_contents($path, $json) === false) {
            Log::warning('[AppQyV1Books] Failed to write JSON cache', ['path' => $path]);
        }
    }

    /** Read a JSON cache file into an array, or null when missing/invalid. */
    private function readJson(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if ($raw === false) {
            return null;
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    /**
     * Build a filesystem-safe ascii filename for a staged upload. Falls back to
     * an index-based name when the original has no safe characters.
     */
    private function asciiName(string $originalName, int $index, string $ext): string
    {
        $base = pathinfo($originalName, PATHINFO_FILENAME);
        $slug = Str::slug($base);
        if ($slug === '') {
            $slug = 'file';
        }
        $slug = substr($slug, 0, 80);
        $suffix = $ext !== '' ? ('.' . preg_replace('/[^a-z0-9]/', '', strtolower($ext))) : '';
        return $index . '_' . $slug . $suffix;
    }

    /** Strip anything that is not a safe id char (uuid / slug). */
    private function sanitizeId(string $id): string
    {
        return preg_replace('/[^A-Za-z0-9_\-]/', '', $id);
    }
}
