<?php

namespace App\Http\Controllers;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MediaSegmentModel as MediaSegment;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangChapterModel as LangChapter;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UploadedDocumentModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioFiles;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Providers\PathMapper;
use App\Services\BookChapterIndexAdapter;
use App\Services\MoviePoster\MoviePosterStore;
use App\Services\MediaIngestStatusService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Media Browse Controller
 *
 * READ-ONLY browse + media-file serving endpoints for the dashboard
 * "Movies/Books browser + player". Public (no auth), mirrors the local
 * worker ingest endpoints. Lists ingested subtitle sources (movies) and
 * books, exposes ordered sentences + segments, and streams clip/audio
 * files from the Laravel static dir.
 */
class MediaBrowseController extends Controller
{
    use ApiResponse;

    /** Relative API base for clip-serve URLs (FE prepends the API host). */
    private const CLIP_URL_BASE = '/api/app_qy_v1/media/clip';

    /**
     * GET /api/app_qy_v1/media/subtitles
     * Paginated list of subtitle (movie) sources.
     */
    public function subtitles(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'language' => 'nullable|string',
            'search' => 'nullable|string',
        ]);

        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 20;

        $posterStore = new MoviePosterStore();
        $paginator = Subtitle::browsePage(
            $validated['language'] ?? null,
            $validated['search'] ?? null,
            $perPage
        )->through(function (Subtitle $subtitle) use ($posterStore) {
            $posterUrl = $posterStore->imageUrlFor($subtitle);
            $imageUrls = $this->resolveImageUrls($subtitle, $posterUrl);
            return [
                'id' => $subtitle->id,
                'source_key' => $subtitle->source_key,
                'title' => $subtitle->title,
                'original_name' => $subtitle->original_name,
                'ascii_name' => $subtitle->ascii_name,
                'language' => $subtitle->language,
                'duration_sec' => $subtitle->duration_sec,
                'subtitle_count' => $subtitle->subtitle_count,
                'segment_count' => $subtitle->segment_count,
                'sentence_count' => $subtitle->sentence_count,
                'synced_at' => $subtitle->synced_at,
                'image_url' => $imageUrls[0] ?? null,
                'image_urls' => $imageUrls,
                'poster_status' => $subtitle->poster_status,
            ];
        });

        return $this->paginated($paginator);
    }

    /**
     * GET /api/app_qy_v1/media/books
     * Paginated list of book sources.
     */
    public function books(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'language' => 'nullable|string',
            'search' => 'nullable|string',
        ]);

        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 20;

        $posterStore = new MoviePosterStore();
        $paginator = Book::browsePage(
            $validated['language'] ?? null,
            $validated['search'] ?? null,
            $perPage
        )->through(function (Book $book) use ($posterStore) {
            $posterUrl = $posterStore->imageUrlFor($book);
            $imageUrls = $this->resolveImageUrls($book, $posterUrl);
            return [
                'id' => $book->id,
                'source_key' => $book->source_key,
                'title' => $book->title,
                'original_name' => $book->original_name,
                'ascii_name' => $book->ascii_name,
                'language' => $book->language,
                'sentence_count' => $book->sentence_count,
                'synced_at' => $book->synced_at,
                'image_url' => $imageUrls[0] ?? null,
                'image_urls' => $imageUrls,
                'poster_status' => $book->poster_status,
            ];
        });

        return $this->paginated($paginator);
    }

    /**
     * GET /api/app_qy_v1/media/documents
     * Paginated list of the AUTHENTICATED user's uploaded documents (the plain-text
     * docs POSTed to /learning/upload). Documents are USER-SCOPED, so this resolves
     * the OPTIONAL sanctum bearer user and returns an EMPTY page when unauthenticated
     * — no 401 — so the public home browse degrades gracefully instead of bouncing to
     * login. Each row's word_count is the size of the vocabulary library the upload
     * produced (uploaded_documents.collection_id → vocabulary_libraries.total_words).
     *
     * NOTE: this is distinct from /vocabulary/libraries (the public word-library list,
     * e.g. "English Coca 60000"). Uploaded documents are a user's own files.
     */
    public function documents(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'language' => 'nullable|string',
            'search' => 'nullable|string',
            'sort' => ['nullable', 'string', Rule::in(AppQyV1UploadedDocumentModel::BROWSE_SORT_KEYS)],
            'order' => 'nullable|string|in:asc,desc',
        ]);

        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 20;
        $sortKey = isset($validated['sort']) ? (string) $validated['sort'] : '';
        $order = isset($validated['order']) ? (string) $validated['order'] : 'desc';

        // Optional auth — documents belong to a user. No user → empty page (NOT 401),
        // matching the paginated() envelope so the FE renders an empty state cleanly.
        $user = auth('sanctum')->user();
        if (!$user) {
            return $this->success([
                'items' => [],
                'total' => 0,
                'per_page' => $perPage,
                'current_page' => 1,
                'last_page' => 1,
            ]);
        }

        $paginator = AppQyV1UploadedDocumentModel::browseForUser(
            (int) $user->id,
            $validated['language'] ?? null,
            $validated['search'] ?? null,
            $sortKey,
            $order,
            $perPage
        )->through(function (AppQyV1UploadedDocumentModel $doc) {
            $library = $doc->library;
            return [
                'id' => $doc->id,
                'title' => $doc->original_name,
                'language' => $doc->language,
                // Size of the vocabulary library this document produced (0 if unlinked).
                'word_count' => $library ? (int) $library->total_words : 0,
                'collection_id' => $doc->collection_id,
                'created_at' => $doc->created_at,
            ];
        });

        return $this->paginated($paginator);
    }

    /**
     * GET /api/app_qy_v1/media/subtitles/{source_key}
     * Detail: subtitle row + ordered segments (with clip URLs) + ordered sentences.
     */
    public function subtitleDetail(Request $request, string $source_key): JsonResponse
    {
        if (!$this->isValidSourceKey($source_key)) {
            return $this->error('Invalid source key', 404);
        }

        $validated = $request->validate([
            'grain' => 'nullable|string|in:cue,sentence,all',
            'per_page' => 'nullable|integer|min:1|max:2000',
            'page' => 'nullable|integer|min:1',
            'chapter_index' => 'nullable|integer|min:0',
        ]);

        $subtitle = Subtitle::findBySourceKey($source_key);
        if (!$subtitle) {
            return $this->error('Subtitle not found', 404);
        }

        $segments = MediaSegment::orderedForSource($source_key)
            ->map(function (MediaSegment $segment) use ($source_key) {
                return [
                    'seg_index' => $segment->seg_index,
                    'start_sec' => $segment->start_sec,
                    'end_sec' => $segment->end_sec,
                    'sub_idx_start' => $segment->sub_idx_start,
                    'sub_idx_end' => $segment->sub_idx_end,
                    'subtitle_count' => $segment->subtitle_count,
                    'mp4_url' => $this->clipUrl($source_key, $segment->mp4),
                    'full_mp4_url' => $this->clipUrl($source_key, $segment->full_mp4),
                    'mp3_url' => $this->clipUrl($source_key, $segment->mp3),
                ];
            })
            ->values();

        $grain = $validated['grain'] ?? 'sentence';
        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 500;
        $chapterIndex = isset($validated['chapter_index']) ? (int) $validated['chapter_index'] : null;
        $sentences = $this->buildSentencesPaginator($source_key, $grain, $perPage, $chapterIndex);

        return $this->success([
            'source' => $subtitle,
            'segments' => $segments,
            'sentences' => $sentences,
        ]);
    }

    /**
     * GET /api/app_qy_v1/media/books/{source_key}
     * Detail: book row + ordered sentences (no segments).
     */
    public function bookDetail(Request $request, string $source_key): JsonResponse
    {
        if (!$this->isValidSourceKey($source_key)) {
            return $this->error('Invalid source key', 404);
        }

        $validated = $request->validate([
            'grain' => 'nullable|string|in:cue,sentence,all',
            'per_page' => 'nullable|integer|min:1|max:2000',
            'page' => 'nullable|integer|min:1',
            // Books v3.1: scope verses to a single chapter (book -> chapter -> verses).
            'chapter_index' => 'nullable|integer|min:0',
        ]);

        $book = Book::findBySourceKey($source_key);
        // Agent-history articles live in app_qy_v1_articles (keyed 'article_<uuid>'),
        // never in books — MediaIngestService deliberately skips source rows for
        // them. Resolve them as source_type='article' so the read-along reader
        // (WfNewBookReader) can open them through this same endpoint.
        $sourceType = 'book';
        $source = $book;
        if (!$source && str_starts_with($source_key, 'article_')) {
            $article = AppQyV1Article::findByArticleId($source_key);
            if ($article) {
                $sourceType = 'article';
                $source = $this->articleAsSource($article);
            }
        }
        if (!$source) {
            return $this->error('Book not found', 404);
        }

        $grain = $validated['grain'] ?? 'sentence';
        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 500;
        $chapterIndex = isset($validated['chapter_index']) ? (int) $validated['chapter_index'] : null;
        $languages = $this->sourceLanguages($sourceType, $source);
        $adaptation = $this->resolveChapterIndex($sourceType, $source_key, $languages, $chapterIndex, $grain);
        $sentences = $this->buildSentencesPaginator($source_key, $grain, $perPage, $adaptation['slot_index']);

        $payload = [
            'source' => $source,
            'chapter_index' => $chapterIndex,
            'sentences' => $sentences,
        ];
        if ($adaptation['adapted']) {
            $payload['chapter_index_adapted'] = true;
            $payload['slot_chapter_index'] = $adaptation['slot_index'];
        }

        return $this->success($payload);
    }

    /**
     * GET /api/app_qy_v1/media/books/{source_key}/chapters
     * Ordered chapter list for a book, MERGED across its per-language chapter
     * tables (Books v3.1 — app_qy_v1_chapters_{lang}). One entry per chapter_index
     * with per-language titles (languages a chapter lacks are null = 留空). Gives
     * the FE a real book -> chapter -> verse tree; verses for one chapter are then
     * fetched via bookDetail?chapter_index=N. A legacy/unstructured book (no
     * per-language chapter rows) returns an empty list, not an error.
     */
    public function bookChapters(Request $request, string $source_key): JsonResponse
    {
        if (!$this->isValidSourceKey($source_key)) {
            return $this->error('Invalid source key', 404);
        }

        $book = Book::findBySourceKey($source_key);
        // Same article fallback as bookDetail (see there): agent-history
        // articles carry their chapter rows under source_type='article'.
        $sourceType = 'book';
        $source = $book;
        if (!$source && str_starts_with($source_key, 'article_')) {
            $article = AppQyV1Article::findByArticleId($source_key);
            if ($article) {
                $sourceType = 'article';
                $source = $this->articleAsSource($article);
            }
        }
        if (!$source) {
            return $this->error('Book not found', 404);
        }

        $languages = $this->sourceLanguages($sourceType, $source);
        $chapters = $this->buildChaptersList($sourceType, $source_key, $languages);

        return $this->success([
            'source_key' => $source_key,
            'languages' => $languages,
            'chapter_count' => count($chapters),
            'chapters' => $chapters,
        ]);
    }

    /**
     * GET /api/app_qy_v1/media/books/{source_key}/ingest-status
     *
     * Public idempotent progress probe for external importers (mcp-chrome, pycore).
     * Text and audio are reported separately so callers can skip existing text
     * while backfilling missing audio clips.
     *
     * Query:
     *   langs              Comma-separated language codes (e.g. zh,en). When set,
     *                      each chapter includes per-lang audio counts + complete flags.
     *   variant_key        Audio variant id (e.g. duoreader_tts, uk_f). Default "" = primary.
     *   include_slots      1|0 — per-slot seq/content_id/audio map (for audio-only resume).
     *   include_text       1|0 — with include_slots, include sentence text for slots missing audio.
     */
    public function bookIngestStatus(Request $request, string $source_key): JsonResponse
    {
        if (!$this->isValidSourceKey($source_key)) {
            return $this->error('Invalid source key', 404);
        }

        $validated = $request->validate([
            'langs' => 'nullable|string|max:200',
            'variant_key' => 'nullable|string|max:64',
            'include_slots' => 'nullable|boolean',
            'include_text' => 'nullable|boolean',
        ]);

        $languages = [];
        if (!empty($validated['langs'])) {
            $languages = array_values(array_filter(array_map(
                'trim',
                explode(',', (string) $validated['langs'])
            )));
        }

        $variantKey = trim((string) ($validated['variant_key'] ?? ''));
        $includeSlots = filter_var($validated['include_slots'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $includeText = filter_var($validated['include_text'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $payload = (new MediaIngestStatusService())->buildBookStatus(
            $source_key,
            $languages,
            $variantKey,
            $includeSlots,
            $includeText
        );

        return $this->success($payload);
    }

    /**
     * GET /api/app_qy_v1/media/documents/{id}
     * Detail: uploaded-document meta + ordered sentences, for the reader.
     *
     * Owner-scoped (needs a bearer token). A document's sentences live in the
     * SAME shared source_sentences store as books, keyed by source_key
     * `doc_{id}` (written by AppQyV1VocabularyDocumentController::extractSentences).
     * They exist only AFTER the document was sentence-extracted; before that the
     * paginator is simply empty (the FE shows a "no readable content" prompt).
     * Per-sentence audio depends on the shared content_id-keyed TTS enrichment.
     */
    public function documentDetail(Request $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return $this->error('Invalid document id', 404);
        }

        $validated = $request->validate([
            'grain' => 'nullable|string|in:cue,sentence,all',
            'per_page' => 'nullable|integer|min:1|max:2000',
            'page' => 'nullable|integer|min:1',
        ]);

        // Documents belong to a user — require auth and ownership.
        $user = auth('sanctum')->user();
        if (!$user) {
            return $this->error('Authentication required', 401);
        }

        $document = AppQyV1UploadedDocumentModel::findOwned((int) $id, (int) $user->id);
        if (!$document) {
            return $this->error('Document not found', 404);
        }

        $library = $document->library;
        $grain = $validated['grain'] ?? 'sentence';
        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 500;
        // Documents are chapterless — always the full flat sentence list.
        $sentences = $this->buildSentencesPaginator('doc_' . (int) $id, $grain, $perPage, null);

        return $this->success([
            'source' => [
                'id' => $document->id,
                'source_key' => 'doc_' . $document->id,
                'title' => $document->original_name,
                'language' => $document->language,
                'word_count' => $library ? (int) $library->total_words : 0,
                'created_at' => $document->created_at,
            ],
            'chapter_index' => null,
            'sentences' => $sentences,
        ]);
    }

    /**
     * GET /api/app_qy_v1/media/clip/{source_key}/{name}
     * Serve a media file from the source's segments dir.
     */
    public function clip(string $source_key, string $name): Response
    {
        if (!$this->isValidSourceKey($source_key)) {
            abort(404);
        }

        // Only a bare filename is allowed: strip any path / traversal.
        $base = basename(str_replace('\\', '/', $name));
        if ($base === '' || $base !== $name || $base === '.' || $base === '..') {
            abort(404);
        }

        $dir = PathMapper::getLaravelStaticDir("media/{$source_key}/segments");
        $path = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $base;

        if (!is_file($path)) {
            abort(404);
        }

        return response()->file($path, [
            'Content-Type' => $this->mimeForName($base),
            'Cache-Control' => 'public, max-age=31536000',
            'Accept-Ranges' => 'bytes',
        ]);
    }

    // ==================== Helpers ====================

    /**
     * Build an ordered (grain, seq) sentences paginator joining
     * SourceSentence (for this source_key) -> per-language LangSentence.
     */
    private function buildSentencesPaginator(string $sourceKey, string $grain, int $perPage, ?int $chapterIndex = null)
    {
        // Books v3.1: the shared `sentence` relation is gone; per-language text is
        // resolved per row via resolveSlotPrimary()/langSentence() below.
        $paginator = SourceSentence::orderedSourcePage($sourceKey, $grain, $chapterIndex, $perPage);

        // Books v3.1: batch-load every per-language sentence row referenced by this
        // page in ONE query per language (previously an N+1 — one query per language
        // per slot, i.e. O(rows x languages) round-trips for a 500-verse chapter).
        $preload = $this->preloadLangRows($paginator->getCollection());

        $paginator->through(function (SourceSentence $link) use ($preload) {
            // Books v3.1: resolve the slot's primary-language sentence from the
            // per-language store via lang_content_ids; the full per-language map
            // is exposed under `languages`. The legacy shared `sentence` relation
            // was removed, so a slot with no v3 correspondence resolves to the
            // per-language row (or null) — never the dropped shared table.
            $v3 = $this->resolveSlotPrimary($link, $preload);
            $sentence = $v3 !== null
                ? $v3['row']
                : $link->langSentence($link->primary_language ?: 'en');

            // Slot metadata carries the verse's real reference (e.g. "1:1") + book
            // for sources seeded as one book with chapter-per-sub-book (the Bible).
            $meta = is_array($link->metadata) ? $link->metadata : [];

            $entry = [
                'grain' => $link->grain,
                'seq' => $link->seq,
                'seg_index' => $link->seg_index,
                'sub_idx' => $link->sub_idx,
                'start_sec' => $link->start_sec,
                'end_sec' => $link->end_sec,
                'ref' => $meta['ref'] ?? null,
                'book' => $meta['book'] ?? null,
                'text' => $sentence->text ?? null,
                'language' => $sentence->language ?? null,
                'explanation' => $sentence->explanation ?? null,
                'grammar' => $sentence->grammar ?? null,
                'ai_commentary' => $sentence->ai_commentary ?? null,
                'special_usage' => $sentence->special_usage ?? null,
                'audio' => $sentence->audio ?? null,
                'occurrence_count' => $sentence->occurrence_count ?? null,
            ];
            if ($v3 !== null) {
                $entry['corr_id'] = $link->corr_id;
                $entry['chapter_index'] = $link->chapter_index;
                $entry['languages'] = $v3['languages'];
            }
            return $entry;
        });

        return [
            'items' => $paginator->items(),
            'total' => $paginator->total(),
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
        ];
    }

    /**
     * Books v3 per-slot resolution for the paginator: read each correspondence
     * language from its per-language sentence table by lang_content_ids, return
     * the primary-language row (for the flat fields) plus the full per-language
     * map. Returns null when the slot has no v3 correspondence (legacy path).
     *
     * @param array<string,array<string,LangSentence>> $preload  [lang][content_id] => row (see preloadLangRows)
     * @return array{row:?LangSentence,languages:array<string,mixed>}|null
     */
    private function resolveSlotPrimary(SourceSentence $link, array $preload = []): ?array
    {
        $map = $link->lang_content_ids;
        if (!is_array($map) || count($map) === 0) {
            return null;
        }

        $languages = [];
        $primaryRow = null;
        $primaryLang = $link->primary_language;

        foreach ($map as $lang => $contentId) {
            $row = null;
            if (!empty($contentId)) {
                $row = $preload[(string) $lang][(string) $contentId] ?? null;
            }

            $languages[$lang] = [
                'text' => $row->text ?? null,
                'audio' => $row->audio ?? null,
                'explanation' => $row->explanation ?? null,
                'has_audio' => $row !== null ? (bool) $row->has_audio : false,
                'tts_status' => $row->tts_status ?? null,
                'audio_files' => $row !== null ? $this->formatSentenceAudioFiles($row) : [],
            ];

            if ($row !== null) {
                $isPrimary = $primaryLang !== null && $primaryLang !== '' && $lang === $primaryLang;
                if ($isPrimary || $primaryRow === null) {
                    $primaryRow = $row;
                }
            }
        }

        return ['row' => $primaryRow, 'languages' => $languages];
    }

    /**
     * Batch-load the per-language sentence rows a page of slots references, one
     * query per language table (keyed by content_id) — the lookup resolveSlotPrimary
     * reads from instead of firing a query per (slot, language).
     *
     * @param  \Illuminate\Support\Collection<int,SourceSentence>  $links
     * @return array<string,array<string,LangSentence>>  [lang][content_id] => row
     */
    private function preloadLangRows($links): array
    {
        // Collect the referenced content_ids per language across the whole page.
        $idsByLang = [];
        foreach ($links as $link) {
            $map = $link->lang_content_ids;
            if (!is_array($map)) {
                continue;
            }
            foreach ($map as $lang => $contentId) {
                if (!empty($contentId)) {
                    $idsByLang[(string) $lang][] = (string) $contentId;
                }
            }
        }

        $out = [];
        foreach ($idsByLang as $lang => $ids) {
            $rows = LangSentence::rowsByContentIds((string) $lang, $ids);
            $byId = [];
            foreach ($rows as $row) {
                $byId[(string) $row->content_id] = $row;
            }
            $out[(string) $lang] = $byId;
        }

        return $out;
    }

    /**
     * Per-variant sentence audio metadata for book-reader language cells.
     *
     * @return array<int,array<string,mixed>>
     */
    private function formatSentenceAudioFiles(LangSentence $sentence): array
    {
        $out = [];
        foreach (AppQyV1SentenceAudioFiles::list($sentence) as $row) {
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

    /**
     * The language codes a source carries, for the chapter merge. Prefers the
     * seed/ingest metadata.seeded_languages; else derives from a sample slot's
     * lang_content_ids map; else falls back to ['en']. Always normalized codes,
     * filtered to the supported set.
     */
    private function sourceLanguages(string $sourceType, $source): array
    {
        $meta = is_array($source->metadata ?? null) ? $source->metadata : [];
        $raw = isset($meta['seeded_languages']) && is_array($meta['seeded_languages'])
            ? $meta['seeded_languages']
            : [];

        if (empty($raw)) {
            $sample = SourceSentence::languageSample($sourceType, $source->source_key);
            if ($sample && is_array($sample->lang_content_ids)) {
                $raw = array_keys($sample->lang_content_ids);
            }
            if ($sample && !empty($sample->primary_language)) {
                $raw[] = $sample->primary_language;
            }
        }

        $out = [];
        foreach ($raw as $lang) {
            $code = AppQyV1TableMaps::normalizeLangCode((string) $lang);
            if ($code !== '' && AppQyV1TableMaps::isLanguageSupported($code) && !in_array($code, $out, true)) {
                $out[] = $code;
            }
        }
        return empty($out) ? ['en'] : $out;
    }

    /**
     * Merge the per-language chapter tables (app_qy_v1_chapters_{lang}) into one
     * ordered list keyed by chapter_index: each entry carries per-language titles
     * (null where a language has no row = 留空) and the chapter's sentence_count.
     * Returns [] for a legacy/unstructured source with no chapter rows.
     */
    private function buildChaptersList(string $sourceType, string $sourceKey, array $languages): array
    {
        $byIndex = [];

        foreach ($languages as $lang) {
            $rows = LangChapter::rowsForSource($lang, $sourceType, $sourceKey);

            foreach ($rows as $row) {
                $ci = (int) $row->chapter_index;
                if (!isset($byIndex[$ci])) {
                    $byIndex[$ci] = [
                        'chapter_index' => $ci,
                        'corr_id' => $row->corr_id,
                        'sentence_count' => 0,
                        'titles' => [],
                    ];
                }
                $byIndex[$ci]['titles'][$lang] = $row->title; // null = 留空
                $count = (int) $row->sentence_count;
                if ($count > $byIndex[$ci]['sentence_count']) {
                    $byIndex[$ci]['sentence_count'] = $count;
                }
            }
        }

        // Ensure every requested language key is present (null where missing).
        foreach ($byIndex as &$chapter) {
            foreach ($languages as $lang) {
                if (!array_key_exists($lang, $chapter['titles'])) {
                    $chapter['titles'][$lang] = null;
                }
            }
        }
        unset($chapter);

        $adapter = app(BookChapterIndexAdapter::class);
        foreach (array_keys($byIndex) as $ci) {
            $metadataIndex = (int) $ci;
            $slotCount = $adapter->slotCountForMetadataChapter(
                $sourceType,
                $sourceKey,
                $languages,
                $metadataIndex
            );
            if ($slotCount <= 0) {
                unset($byIndex[$ci]);
                continue;
            }
            $byIndex[$ci]['sentence_count'] = $slotCount;
            $resolved = $adapter->resolve($sourceType, $sourceKey, $languages, $metadataIndex);
            if ($resolved['adapted']) {
                $byIndex[$ci]['slot_chapter_index'] = $resolved['slot_index'];
            }
        }

        ksort($byIndex);
        return array_values($byIndex);
    }

    /**
     * @return array{slot_index: ?int, requested: ?int, adapted: bool}
     */
    private function resolveChapterIndex(
        string $sourceType,
        string $sourceKey,
        array $languages,
        ?int $requestedChapterIndex,
        string $grain = 'sentence'
    ): array {
        $grainFilter = $grain === 'all' ? 'sentence' : $grain;
        return app(BookChapterIndexAdapter::class)->resolve(
            $sourceType,
            $sourceKey,
            $languages,
            $requestedChapterIndex,
            $grainFilter
        );
    }

    /**
     * Build a relative clip-serve URL for a non-empty segment filename.
     * Returns null when there is no file.
     */
    private function clipUrl(string $sourceKey, ?string $filename): ?string
    {
        if (empty($filename)) {
            return null;
        }
        $base = basename(str_replace('\\', '/', $filename));
        if ($base === '') {
            return null;
        }
        return self::CLIP_URL_BASE . '/' . $sourceKey . '/' . $base;
    }

    /**
     * Synthesize the `source` payload of bookDetail/bookChapters from an
     * app_qy_v1_articles row (agent-history articles have no Book row). The
     * object must expose `source_key` + `metadata` for sourceLanguages() and
     * the display fields the reader shows (title / original_name / language).
     */
    private function articleAsSource(AppQyV1Article $article): object
    {
        return (object) [
            'source_key' => $article->article_id,
            'source_type' => 'article',
            'title' => $article->title,
            'original_name' => $article->title,
            'language' => $article->language,
            'word_count' => $article->word_count,
            'sentence_count' => $article->sentence_count,
            'metadata' => is_array($article->metadata) ? $article->metadata : [],
        ];
    }

    /**
     * Validate that source_key is a sane token.
     */
    private function isValidSourceKey(string $sourceKey): bool
    {
        return $sourceKey !== '' && (bool) preg_match('/^[A-Za-z0-9._-]+$/', $sourceKey);
    }

    /**
     * Merge stored poster URL with additional covers (poster_meta.cover_files,
     * newest first) and metadata cover_url / cover_urls (string or array).
     * The multi-cover set is capped at MoviePosterStore::MAX_COVERS so the FE
     * carousel gets the latest 5 covers per book.
     *
     * @param Book|Subtitle $model
     */
    private function resolveImageUrls($model, ?string $posterUrl): array
    {
        $urls = [];
        if (is_string($posterUrl) && $posterUrl !== '') {
            $urls[] = $posterUrl;
        }

        // Additional covers from the multi-cover store (newest first).
        if ($posterUrl !== null) {
            $store = new MoviePosterStore();
            $additional = $store->additionalCovers($model);
            usort($additional, static fn ($a, $b) => strcmp((string) ($b['fetched_at'] ?? ''), (string) ($a['fetched_at'] ?? '')));
            foreach ($additional as $cover) {
                $filename = (string) ($cover['filename'] ?? '');
                if ($filename !== '') {
                    $urls[] = $store->buildPosterUrl($filename);
                }
            }
        }

        $meta = is_array($model->metadata ?? null) ? $model->metadata : [];
        if (!empty($meta['cover_urls']) && is_array($meta['cover_urls'])) {
            foreach ($meta['cover_urls'] as $u) {
                if (is_string($u) && $u !== '') {
                    $urls[] = $u;
                }
            }
        } elseif (!empty($meta['cover_url']) && is_string($meta['cover_url'])) {
            $urls[] = $meta['cover_url'];
        }

        $unique = [];
        $seen = [];
        foreach ($urls as $u) {
            if (isset($seen[$u])) {
                continue;
            }
            $seen[$u] = true;
            $unique[] = $u;
        }

        return array_slice($unique, 0, 10);
    }

    /**
     * Resolve a Content-Type by file extension.
     */
    private function mimeForName(string $name): string
    {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        switch ($ext) {
            case 'mp4':
                return 'video/mp4';
            case 'mp3':
                return 'audio/mpeg';
            case 'm4a':
                return 'audio/mp4';
            case 'ogg':
            case 'opus':
                return 'audio/ogg';
            case 'webm':
                return 'video/webm';
            case 'srt':
                return 'text/plain';
            default:
                return 'application/octet-stream';
        }
    }
}
