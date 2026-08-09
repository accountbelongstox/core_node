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

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Services\BookTextStatsService;
use App\Services\MediaIngestService;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Rebuild STRANDED v2 books — books that still hold their raw `full_content`
 * backup but lost all their sentences when the shared app_qy_v1_sentences table
 * was dropped (Books v3.1 cut). They render as "无章节" + every verse "—".
 *
 * Recovery RE-SEGMENTS full_content into the v3 chapter -> slot tree using the
 * SAME PHP segmenter the browser-upload v3 path uses
 * (BookTextStatsService::analyzeChapters) and ingests it through the SAME
 * idempotent persistence path (MediaIngestService::ingest, model_version:3). No
 * original file and no pycore are needed; the books row's full_content is the
 * source of truth.
 *
 * STRANDED = full_content non-empty AND NO v3-shaped app_qy_v1_source_sentences
 * row for that source_key (i.e. no row whose corr_id is set). This catches BOTH
 * books with zero source_sentences AND books left holding only ORPHANED v2 slot
 * rows (corr_id / primary_language / lang_content_ids all null) whose text link
 * died when the shared app_qy_v1_sentences table was dropped — those report a
 * sentence COUNT but render every verse empty ("尚未同步文本"). Before
 * re-ingesting, the recovery PURGES the orphaned (corr_id-null) rows for the book
 * so the clean v3 re-ingest does not stack fresh rows on top of dead ones (the
 * old v2 global seq numbering does not line up with the v3 per-chapter seqs, so
 * an in-place upsert alone would double the rows and leave the orphans behind).
 * Once a book is rebuilt every slot carries a corr_id, so the stranded query no
 * longer matches it and the purge deletes nothing (the data state is the
 * self-guard; re-runs are idempotent).
 *
 * A book with EMPTY full_content and no file is unrecoverable here — it is
 * skipped and reported (the FE shows a "re-sync" notice for those).
 */
class AppQyV1RebuildStrandedBooks extends Command
{
    protected $signature = 'appqyv1:rebuild-stranded-books {--book_id= : Rebuild only this book id} {--source_key= : Operate on this source_key (used with --reset)} {--reset : Clear the target book\'s v3 slots+chapters (by --book_id or --source_key) so a fresh re-ingest fully replaces them; does NOT rebuild} {--dry-run : List/preview without writing}';

    protected $description = 'Re-segment + re-ingest stranded v2 books from their full_content backup into the v3 model';

    /**
     * Slots per ingest chunk. Mirrors pycore's _BOOK_CHUNK so each
     * MediaIngestService::ingest call (one DB transaction) stays bounded: a
     * 100k-slot book is split across many short transactions instead of one
     * multi-minute one that could block sys:init or time out and roll back.
     */
    private const INGEST_CHUNK_SLOTS = 1500;

    public function handle(): int
    {
        $bookId = $this->option('book_id');
        $dryRun = (bool) $this->option('dry-run');

        // --reset: clear a book's v3 content so a fresh (e.g. pycore re-extracted)
        // ingest fully replaces it. Distinct from the full_content rebuild below.
        if ((bool) $this->option('reset')) {
            return $this->handleReset($dryRun);
        }

        $result = self::rebuild(
            $bookId !== null && $bookId !== '' ? (int) $bookId : null,
            $dryRun,
            function (string $line) {
                $this->line($line);
            }
        );

        $this->info(sprintf(
            '[rebuild-stranded-books] stranded=%d rebuilt=%d skipped_unrecoverable=%d failed=%d%s',
            $result['stranded'],
            $result['rebuilt'],
            $result['skipped_unrecoverable'],
            $result['failed'],
            $dryRun ? ' (dry-run)' : ''
        ));

        return self::SUCCESS;
    }

    /**
     * --reset handler: resolve the target source_key (from --source_key or
     * --book_id) and clear that book's v3 content so a fresh ingest replaces it.
     */
    private function handleReset(bool $dryRun): int
    {
        $sourceKey = trim((string) ($this->option('source_key') ?? ''));
        $bookId = $this->option('book_id');

        if ($sourceKey === '' && $bookId !== null && $bookId !== '') {
            $book = Book::find((int) $bookId);
            if (!$book) {
                $this->error(sprintf('[reset] book id=%s not found', (string) $bookId));
                return self::FAILURE;
            }
            $sourceKey = (string) $book->source_key;
        }

        if ($sourceKey === '') {
            $this->error('[reset] requires --book_id or --source_key');
            return self::FAILURE;
        }

        $result = self::resetBookContent($sourceKey, $dryRun, function (string $line) {
            $this->line($line);
        });

        $this->info(sprintf(
            '[reset] source_key=%s source_sentences=%d chapters=%d%s',
            $sourceKey,
            $result['source_sentences'],
            $result['chapters'],
            $dryRun ? ' (dry-run)' : ''
        ));

        return self::SUCCESS;
    }

    /**
     * Clear ONE book's v3 content so a fresh ingest fully REPLACES it (the v3
     * ingest is fill-missing and will NOT overwrite an existing slot's text, so a
     * book whose stored content is wrong — e.g. a column-scrambled PDF being
     * re-extracted cleanly by pycore — must be cleared first). Deletes the book's
     * app_qy_v1_source_sentences rows + its per-language chapter rows across every
     * supported language. KEEPS the Book row + full_content + the content-keyed
     * sentences_{lang} rows (those are shared/reused across all sources). Scoped
     * to source_type='book' so no other source type is touched.
     *
     * @return array{source_sentences:int, chapters:int}
     */
    public static function resetBookContent(string $sourceKey, bool $dryRun = false, ?callable $emit = null): array
    {
        $say = static function (string $line) use ($emit): void {
            if ($emit !== null) {
                $emit($line);
            }
        };

        $ssQuery = SourceSentence::where('source_type', 'book')->where('source_key', $sourceKey);
        $ssCount = (int) $ssQuery->count();

        $connection = (new SourceSentence())->getConnectionName();
        $schema = \Illuminate\Support\Facades\Schema::connection($connection);

        // Tally per-language chapter rows for this book (skip absent/empty tables).
        $chapterTables = [];
        $chapterTotal = 0;
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $table = AppQyV1TableMaps::getChapterTableName($lang);
            if (!$schema->hasTable($table)) {
                continue;
            }
            $n = (int) \Illuminate\Support\Facades\DB::connection($connection)->table($table)
                ->where('source_type', 'book')->where('source_key', $sourceKey)->count();
            if ($n > 0) {
                $chapterTables[$table] = $n;
                $chapterTotal += $n;
            }
        }

        if ($dryRun) {
            $say(sprintf('  - WOULD clear %d source_sentences + %d chapter row(s) across %d lang table(s) for source_key=%s',
                $ssCount, $chapterTotal, count($chapterTables), $sourceKey));
            foreach ($chapterTables as $table => $n) {
                $say(sprintf('      %s: %d', $table, $n));
            }
            return ['source_sentences' => $ssCount, 'chapters' => $chapterTotal];
        }

        $ssQuery->delete();
        $clearedChapters = 0;
        foreach ($chapterTables as $table => $n) {
            $clearedChapters += (int) \Illuminate\Support\Facades\DB::connection($connection)->table($table)
                ->where('source_type', 'book')->where('source_key', $sourceKey)->delete();
        }
        $say(sprintf('  - cleared %d source_sentences + %d chapter row(s) for source_key=%s', $ssCount, $clearedChapters, $sourceKey));

        return ['source_sentences' => $ssCount, 'chapters' => $clearedChapters];
    }

    /**
     * Cheap existence check used by the sys:init self-heal: are there any books
     * with non-empty full_content but no v3-shaped (corr_id-bearing)
     * source_sentences — i.e. either zero slots OR only orphaned v2 slots?
     * One bounded query.
     */
    public static function hasStranded(): bool
    {
        return self::strandedQuery()->exists();
    }

    /**
     * Run the rebuild. Reusable from both the command and the sys:init self-heal.
     *
     * @param int|null      $bookId   Limit to a single book id, or null for all.
     * @param bool          $dryRun   When true, only list + count (no writes).
     * @param callable|null $emit     Optional line logger (fn(string): void).
     * @return array{stranded:int, rebuilt:int, skipped_unrecoverable:int, failed:int, rebuilt_ids:array<int,int>}
     */
    public static function rebuild(?int $bookId, bool $dryRun = false, ?callable $emit = null): array
    {
        $stranded = 0;
        $rebuilt = 0;
        $skippedUnrecoverable = 0;
        $failed = 0;
        $rebuiltIds = [];

        $say = static function (string $line) use ($emit): void {
            if ($emit !== null) {
                $emit($line);
            }
        };

        $stats = app(BookTextStatsService::class);
        $ingest = app(MediaIngestService::class);

        $query = self::strandedQuery();
        if ($bookId !== null) {
            $query->where('id', $bookId);
        }

        // Process in id chunks so a large backlog never loads every full_content
        // (long text) into memory at once.
        $query->orderBy('id')->chunkById(50, function ($books) use (
            $dryRun,
            $stats,
            $ingest,
            $say,
            &$stranded,
            &$rebuilt,
            &$skippedUnrecoverable,
            &$failed,
            &$rebuiltIds
        ) {
            foreach ($books as $book) {
                $stranded++;

                $fullContent = (string) ($book->full_content ?? '');
                if (trim($fullContent) === '') {
                    // Unrecoverable: no backup text and no file on the backend.
                    $skippedUnrecoverable++;
                    $say(sprintf('  - SKIP (unrecoverable, empty full_content): book id=%d source_key=%s', (int) $book->id, (string) $book->source_key));
                    continue;
                }

                if ($dryRun) {
                    $say(sprintf('  - STRANDED book id=%d source_key=%s title=%s len=%d', (int) $book->id, (string) $book->source_key, (string) $book->title, mb_strlen($fullContent)));
                    continue;
                }

                try {
                    $payload = self::buildPayload($book, $fullContent, $stats);

                    // Non-empty full_content but nothing segmentable (e.g. a body of
                    // only punctuation/symbols/whitespace, or an unparseable backup):
                    // ingesting it writes ZERO corr_id-bearing rows, so the book would
                    // stay "stranded" and be re-segmented on every sys:init with no
                    // progress. Report it as unrecoverable and skip — without purging
                    // (leave any orphan rows + full_content intact for a later, smarter
                    // re-extraction, e.g. a pycore re-submit).
                    if (count($payload['slots']) === 0) {
                        $skippedUnrecoverable++;
                        $say(sprintf('  - SKIP (unrecoverable, no segmentable slots): book id=%d source_key=%s', (int) $book->id, (string) $book->source_key));
                        continue;
                    }

                    // Ingest the clean v3 rows FIRST, in bounded slot chunks. Two wins:
                    //  - BATCH: each chunk is its OWN MediaIngestService transaction, so a
                    //    huge book (100k+ slots) never runs in a single multi-minute
                    //    transaction — which could block sys:init boot or time out and
                    //    roll the whole rebuild back, re-stranding the book.
                    //  - NO EMPTY WINDOW: writing the fresh rows BEFORE removing the dead
                    //    orphans means a concurrent reader sees the (already broken) book
                    //    gain text and never sees it momentarily empty. A literal single
                    //    wrapping transaction would re-introduce the giant transaction that
                    //    chunking exists to avoid, so ingest-first/purge-last delivers the
                    //    same "never empty" guarantee while staying chunked.
                    self::ingestChunked($ingest, $payload);

                    // Purge any orphaned v2 slot rows the clean re-ingest did not
                    // overwrite in place (corr_id null — text link died with the shared
                    // sentences table; the old v2 global seq numbering does not line up
                    // with the v3 per-chapter seqs, so the upsert key mostly misses them).
                    // Idempotent: a healthy book has no corr_id-null rows -> 0 deleted.
                    $purged = SourceSentence::where('source_type', 'book')
                        ->where('source_key', $book->source_key)
                        ->whereNull('corr_id')
                        ->delete();
                    if ($purged > 0) {
                        $say(sprintf('    purged %d orphaned v2 slot row(s) for source_key=%s', (int) $purged, (string) $book->source_key));
                    }

                    $rebuilt++;
                    $rebuiltIds[] = (int) $book->id;
                    $say(sprintf('  - REBUILT book id=%d source_key=%s chapters=%d slots=%d', (int) $book->id, (string) $book->source_key, count($payload['chapters']), count($payload['slots'])));
                } catch (\Throwable $e) {
                    $failed++;
                    Log::warning('[AppQyV1RebuildStrandedBooks] rebuild failed', [
                        'book_id' => (int) $book->id,
                        'source_key' => (string) $book->source_key,
                        'error' => $e->getMessage(),
                    ]);
                    $say(sprintf('  - FAILED book id=%d source_key=%s: %s', (int) $book->id, (string) $book->source_key, $e->getMessage()));
                }
            }
        });

        return [
            'stranded' => $stranded,
            'rebuilt' => $rebuilt,
            'skipped_unrecoverable' => $skippedUnrecoverable,
            'failed' => $failed,
            'rebuilt_ids' => $rebuiltIds,
        ];
    }

    /**
     * STRANDED detection: Book rows with non-empty full_content AND no
     * v3-shaped app_qy_v1_source_sentences row for that source_key — where
     * "v3-shaped" means corr_id IS NOT NULL. The corr_id is set on every slot
     * the v3 ingest writes (browser-upload, pycore, and this recovery), and is
     * ALWAYS null on the orphaned v2 rows left after the shared-sentences drop,
     * so it is the exact discriminator between "has real text" and "has only dead
     * count". A book with at least one corr_id-bearing row is healthy and
     * excluded. Both Book and SourceSentence are on the appqyv1 connection, so
     * this is a same-connection correlated NOT EXISTS (no cross-DB join).
     */
    private static function strandedQuery()
    {
        $sourceSentencesTable = (new SourceSentence())->getTable();
        $booksTable = (new Book())->getTable();

        return Book::query()
            ->whereNotNull('full_content')
            ->where('full_content', '!=', '')
            ->whereNotExists(function ($q) use ($sourceSentencesTable, $booksTable) {
                $q->select(\Illuminate\Support\Facades\DB::raw(1))
                    ->from($sourceSentencesTable)
                    ->whereColumn($sourceSentencesTable . '.source_key', $booksTable . '.source_key')
                    ->whereNotNull($sourceSentencesTable . '.corr_id');
            });
    }

    /**
     * Ingest a v3 book payload in bounded slot chunks (one MediaIngestService
     * transaction per chunk). The FIRST chunk carries the full source + chapters
     * + its slot window; CONTINUATION chunks carry only {source_key} + a slot
     * window (chapters arrive only in the first chunk — see
     * MediaIngestService::ingestChapters; a {source_key}-only source is a
     * fill-missing no-op on the already-created book row). This mirrors pycore's
     * chunked HTTP ingest exactly, so the two ingest paths behave identically and
     * each chunk boundary is a safe resume point under the fill-missing contract.
     */
    private static function ingestChunked(MediaIngestService $ingest, array $payload): void
    {
        $slots = isset($payload['slots']) && is_array($payload['slots']) ? $payload['slots'] : [];
        $total = count($slots);

        if ($total <= self::INGEST_CHUNK_SLOTS) {
            $ingest->ingest($payload);
            return;
        }

        // First chunk: full source + chapters + the first slot window.
        $first = $payload;
        $first['slots'] = array_slice($slots, 0, self::INGEST_CHUNK_SLOTS);
        $ingest->ingest($first);

        // Continuation chunks: source_key only (+ slot window), no chapters re-sent.
        $sourceKey = (string) ($payload['source']['source_key'] ?? '');
        for ($off = self::INGEST_CHUNK_SLOTS; $off < $total; $off += self::INGEST_CHUNK_SLOTS) {
            $ingest->ingest([
                'source_type' => $payload['source_type'] ?? 'book',
                'model_version' => 3,
                'source' => ['source_key' => $sourceKey],
                'chapters' => [],
                'slots' => array_slice($slots, $off, self::INGEST_CHUNK_SLOTS),
            ]);
        }
    }

    /**
     * Build the model_version:3 ingest payload for one book from its
     * full_content. Segmentation is REUSED from BookTextStatsService (no
     * duplicated segmenter). The monolingual analyzeChapters slots
     * ({grain, seq, text, language}) are mapped to the v3 ingest slot shape
     * ({grain, seq, corr_id, primary_language, langs}) the same way the
     * browser-upload v3 path does; chapters pass through (ingestChapters folds
     * the single `title` into the source language).
     *
     * @return array{source_type:string, model_version:int, source:array, chapters:array, slots:array}
     */
    private static function buildPayload(Book $book, string $fullContent, BookTextStatsService $stats): array
    {
        $lang = AppQyV1TableMaps::normalizeLangCode((string) ($book->language ?: 'en'));
        if ($lang === '') {
            $lang = 'en';
        }

        $sourceKey = (string) $book->source_key;
        $seg = $stats->analyzeChapters($fullContent, $lang);
        $segSlots = isset($seg['slots']) && is_array($seg['slots']) ? $seg['slots'] : [];
        $chapters = isset($seg['chapters']) && is_array($seg['chapters']) ? $seg['chapters'] : [];

        // Map each monolingual segmenter slot to the v3 ingest slot shape: the
        // detected language fills `langs[lang] = text`. corr_id is stable per slot.
        $slots = [];
        foreach ($segSlots as $slot) {
            $grain = isset($slot['grain']) ? (string) $slot['grain'] : 'sentence';
            $seq = isset($slot['seq']) ? (int) $slot['seq'] : 0;
            $chapterIndex = isset($slot['chapter_index']) ? (int) $slot['chapter_index'] : 0;
            $text = isset($slot['text']) ? (string) $slot['text'] : '';
            $slotLang = isset($slot['language']) && $slot['language'] !== '' ? (string) $slot['language'] : $lang;

            $slots[] = [
                'chapter_index' => $chapterIndex,
                'grain' => $grain,
                'seq' => $seq,
                'corr_id' => MediaIngestService::computeCorrId($sourceKey, $grain, $seq),
                'primary_language' => $lang,
                'langs' => [$slotLang => $text],
                'seg_index' => null,
                'sub_idx' => null,
                'start_sec' => null,
                'end_sec' => null,
            ];
        }

        return [
            'source_type' => 'book',
            'model_version' => 3,
            'source' => [
                'source_key' => $sourceKey,
                'title' => $book->title,
                'original_name' => $book->original_name,
                'language' => $lang,
                'selected_languages' => [$lang],
                'full_content' => $fullContent,
            ],
            'chapters' => $chapters,
            'slots' => $slots,
        ];
    }
}
