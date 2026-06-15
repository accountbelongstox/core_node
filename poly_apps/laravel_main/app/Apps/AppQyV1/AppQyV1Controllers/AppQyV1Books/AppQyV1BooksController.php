<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Books;

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary\AppQyV1VocabularyLibraryPublicController;
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
 * Staging + caches live under core_node/.data/appqyv1/books/{uploadId}/ so the
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
        ]);

        $language = (string) $request->input('language', '');
        $uploadId = (string) Str::uuid();
        $stagingDir = PathMapper::getCoreNodeDataDir("appqyv1/books/{$uploadId}");

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

                // Cache the full analysis (per-file) + lists for list/ingest.
                $cachePayload = [
                    'upload_id' => $uploadId,
                    'original_name' => $originalName,
                    'ascii_name' => $asciiName,
                    'ext' => $ext,
                    'size' => $size,
                    'language' => $language,
                    'content_id' => $analysis['content_id'],
                    'primary_language' => $analysis['primary_language'],
                    'stats' => $analysis['stats'],
                    'sentences' => $analysis['sentences'],
                    'sentence_seq' => $analysis['sentence_seq'],
                    'words' => $analysis['words'],
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
     * { upload_id, kind: words|unique_words|sentences|unique_sentences|languages,
     *   start?, limit?, ascii_name? }
     *
     * `ascii_name` optionally scopes to a single uploaded file; otherwise the
     * lists are merged across all files in the upload.
     */
    public function list(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'upload_id' => 'required|string',
            'kind' => 'required|string|in:words,unique_words,sentences,unique_sentences,languages',
            'start' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:5000',
            'ascii_name' => 'nullable|string',
        ]);

        $uploadId = $this->sanitizeId($validated['upload_id']);
        $kind = $validated['kind'];
        $start = isset($validated['start']) ? (int) $validated['start'] : 0;
        $limit = isset($validated['limit']) ? (int) $validated['limit'] : 100;
        $asciiName = isset($validated['ascii_name']) ? basename((string) $validated['ascii_name']) : null;

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
        ]);

        $uploadId = $this->sanitizeId($validated['upload_id']);
        $languageOverride = isset($validated['language']) ? (string) $validated['language'] : '';

        $stagingDir = PathMapper::getCoreNodeDataDir("appqyv1/books/{$uploadId}");
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
            $task = GlobalTask::create([
                'task_id' => (string) Str::uuid(),
                'app_name' => 'app_qy_v1',
                'task_type' => 'books_ingest',
                'execution_type' => GlobalTask::EXECUTION_LOCAL_TIMER,
                'status' => GlobalTask::STATUS_PROCESSING,
                'progress' => 0.0,
                'payload' => [
                    'upload_id' => $uploadId,
                    'language' => $languageOverride,
                    'total_sentences' => $totalSentences,
                ],
            ]);

            // Run the heavy ingest AFTER the response is sent (Octane terminating)
            // so the request returns immediately with the task_id; the frontend
            // polls /task/{id}/status. Failures mark the task FAILED (never leave
            // it stuck in 'processing').
            app()->terminating(function () use ($fileCaches, $languageOverride, $task) {
                try {
                    $this->runIngest($fileCaches, $languageOverride, $task);
                } catch (\Throwable $e) {
                    $task->status = GlobalTask::STATUS_FAILED;
                    $task->error = $e->getMessage();
                    $task->save();
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

        $books = $this->runIngest($fileCaches, $languageOverride, null);

        return $this->success([
            'books' => $books,
            'async' => false,
        ], 'Books ingested successfully');
    }

    /**
     * Build the v2 payload for each staged file and ingest it. When $task is
     * provided, progress is updated 0-100 as chunks complete and the result is
     * stored on the task; returns the per-book summary either way.
     *
     * @param array<int, array> $fileCaches
     * @return array<int, array{source_key:string, original_name:string, sentences:int, words:int}>
     */
    private function runIngest(array $fileCaches, string $languageOverride, ?GlobalTask $task): array
    {
        $books = [];

        // Total chunks across all files for global progress.
        $totalChunks = 0;
        foreach ($fileCaches as $cache) {
            $sentenceCount = count($cache['sentences']);
            $totalChunks += max(1, (int) ceil($sentenceCount / self::INGEST_CHUNK_SIZE));
        }
        $doneChunks = 0;

        foreach ($fileCaches as $cache) {
            $language = $languageOverride !== '' ? $languageOverride : (string) $cache['primary_language'];
            $sourceKey = 'book_' . $cache['content_id'];

            $sentences = $cache['sentences'];
            $sentenceCount = count($sentences);
            $wordCount = 0;
            foreach ($cache['words'] as $items) {
                $wordCount += count($items);
            }

            // First chunk carries the source + word maps + full payload metadata;
            // subsequent chunks carry only their sentence slice so progress can
            // advance on large books without one giant transaction.
            $chunks = array_chunk($sentences, self::INGEST_CHUNK_SIZE);
            if (empty($chunks)) {
                $chunks = [[]];
            }

            $first = true;
            foreach ($chunks as $chunk) {
                $payload = [
                    'source_type' => 'book',
                    'model_version' => 2,
                    'source' => [
                        'source_key' => $sourceKey,
                        'content_id' => $cache['content_id'],
                        'title' => (string) $cache['original_name'],
                        'original_name' => (string) $cache['original_name'],
                        'ascii_name' => (string) $cache['ascii_name'],
                        'language' => $language,
                        'full_content' => $first ? (string) $cache['full_content'] : '',
                        'sentence_seq' => $first ? $cache['sentence_seq'] : [],
                        'word_ids' => $first ? $this->buildWordIds($cache['words']) : [],
                        'sentence_count' => $sentenceCount,
                        'metadata' => [
                            'source' => 'dashboard_books',
                            'upload_id' => (string) $cache['upload_id'],
                            'ext' => (string) $cache['ext'],
                        ],
                    ],
                    'sentences' => $chunk,
                    'words' => $first ? $cache['words'] : [],
                ];

                $this->ingestService->ingest($payload);

                $first = false;
                $doneChunks++;

                if ($task !== null && $totalChunks > 0) {
                    $task->progress = round(($doneChunks / $totalChunks) * 100, 2);
                    $task->save();
                }
            }

            $books[] = [
                'source_key' => $sourceKey,
                'original_name' => (string) $cache['original_name'],
                'sentences' => $sentenceCount,
                'words' => $wordCount,
            ];
        }

        if ($task !== null) {
            $task->status = GlobalTask::STATUS_COMPLETED;
            $task->progress = 100.0;
            $task->result = ['books' => $books];
            $task->completed_at = now();
            $task->save();
        }

        return $books;
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
        $stagingDir = PathMapper::getCoreNodeDataDir("appqyv1/books/{$uploadId}");
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
